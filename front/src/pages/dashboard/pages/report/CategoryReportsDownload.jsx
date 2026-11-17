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

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

// Safely parse any numeric-ish value
const parseNumber = (val) => {
  if (val === undefined || val === null) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

// Normalize the API response into a single shape
const normalizeApiResponse = (apiData) => {
  if (!apiData) {
    return {
      categories: [],
      totals: { afn: 0, usd: 0, afnEquivalent: 0 },
    };
  }

  if (typeof apiData === "object" && !Array.isArray(apiData)) {
    const categories = apiData.categories || [];
    // Prefer the new `totals` object
    if (apiData.totals) {
      return {
        categories,
        totals: {
          afn: parseNumber(apiData.totals.afn),
          usd: parseNumber(apiData.totals.usd),
          afnEquivalent: parseNumber(apiData.totals.afnEquivalent),
        },
      };
    }
    // Legacy: only `totalStockValue` (assumed AFN-equivalent)
    return {
      categories,
      totals: {
        afn: 0,
        usd: 0,
        afnEquivalent: parseNumber(apiData.totalStockValue),
      },
    };
  }

  if (Array.isArray(apiData)) {
    const totals = apiData.reduce(
      (acc, cat) => {
        acc.afn += parseNumber(cat.summary?.stockValueAfn);
        acc.usd += parseNumber(cat.summary?.stockValueUsd);
        acc.afnEquivalent += parseNumber(cat.summary?.stockValueAfnEquivalent);
        return acc;
      },
      { afn: 0, usd: 0, afnEquivalent: 0 }
    );
    return { categories: apiData, totals };
  }

  return { categories: [], totals: { afn: 0, usd: 0, afnEquivalent: 0 } };
};

const CategoryReportsDownload = () => {
  const [loading, setLoading] = useState(false);

  // ─── PDF ────────────────────────────────────────────────────────────────
  const handlePDFDownload = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${BASE_URL}/category/reports`);
      const { categories, totals } = normalizeApiResponse(response.data);

      if (!categories.length) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      const totalCategories = categories.length;
      const totalIncomes = categories.reduce(
        (s, c) => s + (c.summary?.totalExistingIncomes || 0),
        0
      );

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setR2L(false);
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const today = moment().format("YYYY/MM/DD");
      const pageWidth = doc.internal.pageSize.getWidth();

      // ─── Title ───
      doc.setFontSize(14);
      doc.text(
        `گزارش موجودی کالاها بر اساس دسته‌بندی (تاریخ: ${today})`,
        pageWidth - 40,
        40,
        { align: "right" }
      );

      // ─── Overall totals header ───
      doc.setFontSize(10);
      doc.text(
        `جمع کل:  ${totals.afn.toLocaleString()} ؋  +  ${totals.usd.toLocaleString()} $  ` +
        `(معادل ${totals.afnEquivalent.toLocaleString()} ؋)`,
        pageWidth - 40,
        58,
        { align: "right" }
      );

      let startY = 80;

      // ─── Per category ───
      for (const category of categories) {
        const categoryName = category.name;
        const typeName = category.type?.name || "بدون نوع";
        const incomes = category.existingIncomes || [];
        const incomeCount = incomes.length;
        const catAfn = parseNumber(category.summary?.stockValueAfn);
        const catUsd = parseNumber(category.summary?.stockValueUsd);
        const catEquiv = parseNumber(
          category.summary?.stockValueAfnEquivalent ??
          category.summary?.totalStockValue
        );

        // New page if near the bottom
        if (startY > 640) {
          doc.addPage();
          startY = 40;
        }

        // Category header (per-currency breakdown)
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text(
          `دسته: ${categoryName} , نوع: ${typeName} , تعداد: ${incomeCount}`,
          pageWidth - 40,
          startY,
          { align: "right" }
        );
        startY += 16;
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(
          `ارزش دسته:  ${catAfn.toLocaleString()} ؋  +  ${catUsd.toLocaleString()} $  ` +
          `معادل ${catEquiv.toLocaleString()} ؋`,
          pageWidth - 40,
          startY,
          { align: "right" }
        );
        startY += 18;
        doc.setTextColor(0, 0, 0);

        if (incomes.length === 0) {
          doc.text("هیچ درآمد موجودی برای این دسته وجود ندارد.", pageWidth - 40, startY, {
            align: "right",
          });
          startY += 20;
        } else {
          // Table rows — each row uses its own currency symbol
          const headers = [
            [
              "ID",
              "طول (m)",
              "عرض (m)",
              "مساحت (m²)",
              "قیمت واحد",
              "واحد",
              "ارزش",
              "رنگ",
              "درجه",
              "شماره لات",
              "تاریخ ایجاد",
            ],
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
              symbolFor(inc.isAfn),
              `${itemValue.toLocaleString()} ${symbolFor(inc.isAfn)}`,
              inc.color,
              inc.degree || "-",
              inc.lotNumber,
              moment(inc.createdAt).format("YYYY/MM/DD"),
            ];
          });

          autoTable(doc, {
            startY,
            head: headers,
            body,
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
              6: { halign: "right" }, // value column
            },
            margin: { left: 30, right: 30 },
          });

          startY = doc.lastAutoTable.finalY + 20;
        }

        // ─── Separator line after each category ───
        if (startY > 640) {
          doc.addPage();
          startY = 40;
        }
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.line(30, startY, pageWidth - 30, startY);
        startY += 15;
      }

      // ─── Summary footer ───
      const finalY = Math.min(
        startY + 30,
        doc.internal.pageSize.getHeight() - 40
      );
      doc.setFontSize(11);
      doc.text(
        `خلاصه: ${totalCategories} دسته، ${totalIncomes} کالا — ` +
        `${totals.afn.toLocaleString()} ؋ + ${totals.usd.toLocaleString()} $ ` +
        `(معادل ${totals.afnEquivalent.toLocaleString()} ؋)`,
        pageWidth - 40,
        finalY,
        { align: "right" }
      );

      // ─── Page numbers ───
      const pageCount = doc.internal.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`${i}/${pageCount}`, pageWidth - 40, pageHeight - 30, {
          align: "right",
        });
      }

      doc.save(`category_inventory_${moment().format("YYYY-MM-DD")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت یا تولید PDF");
    } finally {
      setLoading(false);
    }
  };

  // ─── Excel ──────────────────────────────────────────────────────────────
  const handleExcelDownload = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${BASE_URL}/category/reports`);
      const { categories, totals } = normalizeApiResponse(response.data);

      if (!categories.length) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      const workbook = XLSX.utils.book_new();

      // ─── 1. Summary sheet (per-currency) ───
      const summaryData = [
        ["گزارش موجودی کالاها بر اساس دسته‌بندی"],
        ["تاریخ گزارش", moment().format("YYYY/MM/DD")],
        [
          "جمع کل (معادل افغانی)",
          `${totals.afnEquivalent.toLocaleString()} ؋`,
        ],
        [
          "جمع کل (افغانی + دالر)",
          `${totals.afn.toLocaleString()} ؋ + ${totals.usd.toLocaleString()} $`,
        ],
        [],
        [
          "دسته",
          "نوع",
          "تعداد کالاها",
          "ارزش (افغانی)",
          "ارزش (دالر)",
          "معادل افغانی",
          "شناسه‌های کالا (لیست کوتاه)",
        ],
      ];

      categories.forEach((cat) => {
        const incomeIds = (cat.existingIncomes || [])
          .map((inc) => inc.id)
          .join(", ");
        summaryData.push([
          cat.name,
          cat.type?.name || "بدون نوع",
          cat.summary?.totalExistingIncomes || 0,
          parseNumber(cat.summary?.stockValueAfn),
          parseNumber(cat.summary?.stockValueUsd),
          parseNumber(
            cat.summary?.stockValueAfnEquivalent ??
            cat.summary?.totalStockValue
          ),
          incomeIds,
        ]);
      });

      summaryData.push(
        [],
        ["خلاصه کلی"],
        ["تعداد کل دسته‌ها", categories.length],
        [
          "تعداد کل کالاهای موجود",
          categories.reduce(
            (s, c) => s + (c.summary?.totalExistingIncomes || 0),
            0
          ),
        ],
        ["جمع افغانی", totals.afn],
        ["جمع دالر", totals.usd],
        ["معادل افغانی کل", totals.afnEquivalent]
      );

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [
        { wch: 25 }, // دسته
        { wch: 20 }, // نوع
        { wch: 15 }, // تعداد
        { wch: 18 }, // افغانی
        { wch: 18 }, // دالر
        { wch: 18 }, // معادل
        { wch: 40 }, // IDs
      ];
      summarySheet["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(workbook, summarySheet, "خلاصه");

      // ─── 2. One sheet per category ───
      for (const category of categories) {
        const catName = category.name;
        const typeName = category.type?.name || "بدون نوع";
        const incomes = category.existingIncomes || [];
        const catAfn = parseNumber(category.summary?.stockValueAfn);
        const catUsd = parseNumber(category.summary?.stockValueUsd);
        const catEquiv = parseNumber(
          category.summary?.stockValueAfnEquivalent ??
          category.summary?.totalStockValue
        );

        if (incomes.length === 0) {
          const emptySheet = XLSX.utils.aoa_to_sheet([
            [`دسته: ${catName} (نوع: ${typeName})`],
            ["هیچ کالای موجودی وجود ندارد."],
          ]);
          emptySheet["!dir"] = "rtl";
          let sheetName = catName.slice(0, 31).replace(/[\\/*?:]/g, "_");
          XLSX.utils.book_append_sheet(workbook, emptySheet, sheetName);
          continue;
        }

        const tableData = [
          [
            `دسته: ${catName} (نوع: ${typeName})`,
          ],
          [
            `ارزش دسته:  ${catAfn.toLocaleString()} ؋  +  ${catUsd.toLocaleString()} $  ` +
            `(معادل ${catEquiv.toLocaleString()} ؋)`,
          ],
          [],
          [
            "ID",
            "طول (m)",
            "عرض (m)",
            "مساحت (m²)",
            "قیمت واحد",
            "واحد",
            "ارزش",
            "رنگ",
            "درجه",
            "شماره لات",
            "شناسه مشتری",
            "تاریخ ایجاد",
          ],
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
            symbolFor(inc.isAfn),
            itemValue,
            inc.color,
            inc.degree || "-",
            inc.lotNumber,
            inc.customerId,
            moment(inc.createdAt).format("YYYY/MM/DD"),
          ]);
        });

        // Footer
        tableData.push(
          [],
          ["جمع ارزش این دسته:", "", "", "", "", "", catAfn, catUsd, "", "", "", ""]
        );

        const worksheet = XLSX.utils.aoa_to_sheet(tableData);
        worksheet["!cols"] = [
          { wch: 10 }, // ID
          { wch: 12 }, // Length
          { wch: 12 }, // Width
          { wch: 12 }, // Area
          { wch: 12 }, // Unit price
          { wch: 8 },  // Currency
          { wch: 18 }, // Value
          { wch: 12 }, // Color
          { wch: 10 }, // Degree
          { wch: 18 }, // LotNumber
          { wch: 15 }, // CustomerId
          { wch: 12 }, // CreatedAt
        ];
        worksheet["!dir"] = "rtl";
        let sheetName = `${catName}_${typeName}`
          .slice(0, 31)
          .replace(/[\\/*?:]/g, "_");
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
        className="bg-cyan-800 text-white px-4 py-2 rounded hover:bg-cyan-700 disabled:opacity-50"
      >
        {loading ? "در حال ساخت PDF..." : "دانلود PDF"}
      </button>
      <button
        onClick={handleExcelDownload}
        disabled={loading}
        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50"
      >
        {loading ? "در حال ساخت Excel..." : "دانلود Excel"}
      </button>
    </div>
  );
};

export default CategoryReportsDownload;