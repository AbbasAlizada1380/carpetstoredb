import React, { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";

moment.locale("en");
const BASE_URL = import.meta.env.VITE_BASE_URL;

const CategoryReportsDownload = () => {
  const [loading, setLoading] = useState(false);

  // Helper to parse numeric values safely
  const parseNumber = (val) => {
    if (val === undefined || val === null) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const handlePDFDownload = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${BASE_URL}/category/reports`);
      // Support both old (array) and new (object) API response
      const apiData = response.data;
      let categories = [];
      let overallTotalStock = 0;
      if (apiData && typeof apiData === "object" && !Array.isArray(apiData)) {
        categories = apiData.categories || [];
        overallTotalStock = apiData.totalStockValue ?? 0;
      } else if (Array.isArray(apiData)) {
        categories = apiData;
        overallTotalStock = categories.reduce(
          (sum, cat) => sum + (cat.summary?.totalStockValue || 0),
          0
        );
      }

      if (!categories.length) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      // Prepare overall totals
      const totalCategories = categories.length;
      const totalIncomes = categories.reduce(
        (sum, cat) => sum + (cat.summary?.totalExistingIncomes || 0),
        0
      );

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      doc.setR2L(false);

      // Add font
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      // Title
      const today = moment().format("YYYY/MM/DD");
      doc.setFontSize(14);
      doc.text(
        `گزارش موجودی کالاها بر اساس دسته‌بندی (تاریخ: ${today})`,
        doc.internal.pageSize.getWidth() - 40,
        40,
        { align: "right" }
      );

      let startY = 70;
      let currentPage = 1;

      for (const category of categories) {
        const categoryName = category.name;
        const typeName = category.type?.name || "بدون نوع";
        const incomes = category.existingIncomes || [];
        const incomeCount = incomes.length;
        const categoryStockValue = category.summary?.totalStockValue || 0;

        // Check if we need a new page
        if (startY > 650) {
          doc.addPage();
          startY = 40;
          currentPage++;
        }

        // Category header (now includes total stock value for category)
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(
          `دسته: ${categoryName} (نوع: ${typeName}) - تعداد کالا: ${incomeCount} - ارزش موجودی: ${categoryStockValue.toLocaleString()} دالر`,
          doc.internal.pageSize.getWidth() - 40,
          startY,
          { align: "right" }
        );
        startY += 20;

        if (incomes.length === 0) {
          doc.text("هیچ درآمد موجودی برای این دسته وجود ندارد.", doc.internal.pageSize.getWidth() - 40, startY, {
            align: "right",
          });
          startY += 20;
          continue;
        }

        // Prepare table data for this category with value columns
        const headers = [
          ["ID", "طول (m)", "عرض (m)", "مساحت (m²)", "قیمت واحد", "ارزش (دالر)", "رنگ", "درجه", "شماره لات",  "تاریخ ایجاد"],
        ];
        const body = incomes.map((inc) => {
          const area = parseNumber(inc.area);
          const unitPrice = parseNumber(inc.unit_price);
          const itemValue = area * unitPrice;
          return [
            inc.id,
            inc.length,
            inc.width,
            area,
            unitPrice,
            itemValue.toLocaleString(),
            inc.color,
            inc.degree || "-",
            inc.lotNumber,
            moment(inc.createdAt).format("YYYY/MM/DD"),
          ];
        });

        // Render table
        autoTable(doc, {
          startY: startY,
          head: headers,
          body: body,
          theme: "grid",
          styles: {
            font: "Vazirmatn",
            fontSize: 8,
            halign: "center",
            valign: "middle",
          },
          headStyles: {
            fillColor: [220, 220, 220],
            textColor: 20,
            fontStyle: "normal",
          },
          columnStyles: {
            5: { halign: "right" }, // value column
          },
          margin: { left: 30, right: 30 },
        });

        startY = doc.lastAutoTable.finalY + 20;
      }

      // Add summary footer with total stock value
      const finalY = Math.min(startY + 40, doc.internal.pageSize.getHeight() - 40);
      doc.setFontSize(11);
      doc.text(
        `خلاصه: ${totalCategories} دسته، ${totalIncomes} کالا - ارزش کل موجودی: ${overallTotalStock.toLocaleString()} دالر`,
        doc.internal.pageSize.getWidth() - 40,
        finalY,
        { align: "right" }
      );

      // Add page numbers
      const pageCount = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(
          `${i}/${pageCount}`,
          pageWidth - 40,
          pageHeight - 30,
          { align: "right" }
        );
      }

      doc.save(`category_inventory_${moment().format("YYYY-MM-DD")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت یا تولید PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${BASE_URL}/category/reports`);
      let categories = [];
      let overallTotalStock = 0;
      const apiData = response.data;
      if (apiData && typeof apiData === "object" && !Array.isArray(apiData)) {
        categories = apiData.categories || [];
        overallTotalStock = apiData.totalStockValue ?? 0;
      } else if (Array.isArray(apiData)) {
        categories = apiData;
        overallTotalStock = categories.reduce(
          (sum, cat) => sum + (cat.summary?.totalStockValue || 0),
          0
        );
      }

      if (!categories.length) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      const workbook = XLSX.utils.book_new();

      // 1. Summary sheet with per-category stock values and overall total
      const summaryData = [
        ["گزارش موجودی کالاها بر اساس دسته‌بندی"],
        ["تاریخ گزارش", moment().format("YYYY/MM/DD")],
        [],
        ["دسته", "نوع", "تعداد کالاها", "ارزش موجودی (دالر)", "شناسه‌های کالا (لیست کوتاه)"],
      ];

      categories.forEach((cat) => {
        const incomeIds = cat.existingIncomes.map((inc) => inc.id).join(", ");
        const stockValue = cat.summary?.totalStockValue || 0;
        summaryData.push([
          cat.name,
          cat.type?.name || "بدون نوع",
          cat.summary?.totalExistingIncomes || 0,
          stockValue,
          incomeIds,
        ]);
      });

      summaryData.push(
        [],
        ["خلاصه کلی"],
        ["تعداد کل دسته‌ها", categories.length],
        ["تعداد کل کالاهای موجود", categories.reduce((s, c) => s + (c.summary?.totalExistingIncomes || 0), 0)],
        ["ارزش کل موجودی (دالر)", overallTotalStock]
      );

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "خلاصه");

      // 2. Separate sheet for each category (detailed incomes with values)
      for (const category of categories) {
        const catName = category.name;
        const typeName = category.type?.name || "بدون نوع";
        const incomes = category.existingIncomes || [];

        if (incomes.length === 0) {
          const emptySheet = XLSX.utils.aoa_to_sheet([
            [`دسته: ${catName} (نوع: ${typeName})`],
            ["هیچ کالای موجودی وجود ندارد."],
          ]);
          let sheetName = catName.slice(0, 31).replace(/[\\/*?:]/g, "_");
          XLSX.utils.book_append_sheet(workbook, emptySheet, sheetName);
          continue;
        }

        const tableData = [
          [`دسته: ${catName} (نوع: ${typeName}) - ارزش موجودی: ${(category.summary?.totalStockValue || 0).toLocaleString()} دالر`],
          [],
          ["ID", "طول (m)", "عرض (m)", "مساحت (m²)", "قیمت واحد", "ارزش (دالر)", "رنگ", "درجه", "شماره لات", "شناسه مشتری", "تاریخ ایجاد"],
        ];

        incomes.forEach((inc) => {
          const area = parseNumber(inc.area);
          const unitPrice = parseNumber(inc.unit_price);
          const itemValue = area * unitPrice;
          tableData.push([
            inc.id,
            inc.length,
            inc.width,
            area,
            unitPrice,
            itemValue,
            inc.color,
            inc.degree || "-",
            inc.lotNumber,
            inc.customerId,
            moment(inc.createdAt).format("YYYY/MM/DD"),
          ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(tableData);
        worksheet["!cols"] = [
          { wch: 10 }, // ID
          { wch: 12 }, // Length
          { wch: 12 }, // Width
          { wch: 12 }, // Area
          { wch: 12 }, // Unit price
          { wch: 18 }, // Value
          { wch: 12 }, // Color
          { wch: 10 }, // Degree
          { wch: 18 }, // LotNumber
          { wch: 15 }, // CustomerId
          { wch: 12 }, // CreatedAt
        ];
        let sheetName = `${catName}_${typeName}`.slice(0, 31).replace(/[\\/*?:]/g, "_");
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `category_inventory_${moment().format("YYYY-MM-DD")}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت یا تولید Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex items-center gap-4">
      <button
        onClick={handlePDFDownload}
        disabled={loading}
        className="bg-cyan-800 text-white px-4 py-2 rounded"
      >
        {loading ? "در حال ساخت PDF..." : "دانلود PDF"}
      </button>
      <button
        onClick={handleExcelDownload}
        disabled={loading}
        className="bg-green-700 text-white px-4 py-2 rounded"
      >
        {loading ? "در حال ساخت Excel..." : "دانلود Excel"}
      </button>
    </div>
  );
};

export default CategoryReportsDownload;