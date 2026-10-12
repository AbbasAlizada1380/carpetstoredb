import React, { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";
import { FaFilePdf, FaFileExcel } from "react-icons/fa";

moment.locale("en");
const BASE_URL = import.meta.env.VITE_BASE_URL;

const SingleBillDownload = ({ billId, billNumber }) => {
  const [loading, setLoading] = useState(false);

  const fetchBill = async () => {
    const response = await axios.get(`${BASE_URL}/bill/${billId}`);
    const payload = response.data;
    return payload?.bill ?? payload;
  };

  // ─── Helper: resolve category & type from a sell ───
  const getCategoryName = (sell) => {
    return (
      sell.category?.name ||
      sell.categoryDetail?.name ||
      sell.Category?.name ||
      "---"
    );
  };

  const getTypeName = (sell) => {
    return (
      sell.type?.name ||
      sell.categoryDetail?.type?.name ||
      sell.Category?.type?.name ||
      "---"
    );
  };

const handlePDFDownload = async () => {
  try {
    setLoading(true);
    const bill = await fetchBill();
    if (!bill) {
      alert("فاکتور یافت نشد");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setR2L(false);

    doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
    doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
    doc.setFont("Vazirmatn");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // ─── Header ───
    doc.setFontSize(18);
    doc.text("فاکتور فروش", pageWidth - margin, 50, { align: "right" });

    doc.setFontSize(12);
    doc.text(`شماره: ${bill.billNumber}`, pageWidth - margin, 80, { align: "right" });

    const buyerName = bill.buyer?.fullname || "---";
    const billDate = moment(bill.date).format("YYYY/MM/DD");
    const statusText =
      bill.status === "paid"
        ? "پرداخت شده"
        : bill.status === "partial"
        ? "پرداخت جزئی"
        : "پرداخت نشده";

    doc.text(`خریدار: ${buyerName}`, pageWidth - margin, 105, { align: "right" });
    doc.text(`تاریخ: ${billDate}`, pageWidth - margin, 125, { align: "right" });
    doc.text(`وضعیت: ${statusText}`, pageWidth - margin, 145, { align: "right" });
    if (bill.notes) {
      doc.text(`یادداشت: ${bill.notes}`, pageWidth - margin, 165, { align: "right" });
    }

    const sells = bill.sells || bill.sellRecords || [];
    const tableStartY = bill.notes ? 190 : 175;

    if (sells.length === 0) {
      doc.text("هیچ قلم فروشی وجود ندارد.", pageWidth - margin, tableStartY, {
        align: "right",
      });
    } else {
      // ✅ 9 headers
      const headers = [
        [
          "نمبر",
          "کد کالا",
          "نوع",
          "دسته‌بندی",
          "رنگ",
          "طول (متر)",
          "مساحت (م²)",
          "قیمت واحد (؋)",
          "مبلغ کل (؋)",
        ],
      ];

      // ✅ 9 cells per row
      const body = sells.map((sell, idx) => [
        idx + 1,
        sell.income?.lotNumber || sell.incomeId || "---",
        getTypeName(sell),
        getCategoryName(sell),
        sell.income?.color || "---",
        sell.length,
        sell.area,
        sell.unit_price,
        sell.total,
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: headers,
        body: body,
        theme: "grid",
        tableWidth: contentWidth,
        margin: { left: margin, right: margin },
        styles: {
          font: "Vazirmatn",
          fontSize: 9,
          halign: "center",
          valign: "middle",
          cellPadding: 5,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: 20,
          fontStyle: "normal",
          halign: "center",
        },
        // ✅ 9 column styles, sum = 1.00
        columnStyles: {
          0: { cellWidth: contentWidth * 0.05 }, // نمبر
          1: { cellWidth: contentWidth * 0.11 }, // کد کالا
          2: { cellWidth: contentWidth * 0.12 }, // نوع
          3: { cellWidth: contentWidth * 0.13 }, // دسته‌بندی
          4: { cellWidth: contentWidth * 0.09 }, // رنگ
          5: { cellWidth: contentWidth * 0.10 }, // طول
          6: { cellWidth: contentWidth * 0.11 }, // مساحت
          7: { cellWidth: contentWidth * 0.14 }, // قیمت واحد
          8: { cellWidth: contentWidth * 0.15 }, // مبلغ کل
        },
      });

      const finalY = doc.lastAutoTable.finalY + 25;
      doc.setFontSize(12);
      doc.text(`جمع کل: ${bill.totalAmount} ؋`, pageWidth - margin, finalY, {
        align: "right",
      });
      doc.text(
        `پرداخت شده: ${bill.paidAmount} ؋`,
        pageWidth - margin,
        finalY + 20,
        { align: "right" }
      );
      doc.text(
        `باقیمانده: ${bill.remainingAmount} ؋`,
        pageWidth - margin,
        finalY + 40,
        { align: "right" }
      );
    }

    doc.save(`bill_${bill.billNumber}.pdf`);
  } catch (err) {
    console.error(err);
    alert("خطا در ایجاد PDF");
  } finally {
    setLoading(false);
  }
};

  const handleExcelDownload = async () => {
    try {
      setLoading(true);
      const bill = await fetchBill();
      if (!bill) {
        alert("فاکتور یافت نشد");
        return;
      }

      const workbook = XLSX.utils.book_new();
      const sells = bill.sells || bill.sellRecords || [];

      const summaryData = [
        ["فاکتور فروش"],
        ["شماره فاکتور", bill.billNumber],
        ["خریدار", bill.buyer?.fullname || "---"],
        ["تاریخ", moment(bill.date).format("YYYY/MM/DD")],
        [
          "وضعیت",
          bill.status === "paid"
            ? "پرداخت شده"
            : bill.status === "partial"
            ? "پرداخت جزئی"
            : "پرداخت نشده",
        ],
        ["یادداشت", bill.notes || "---"],
        [],
        [
          "ردیف",
          "کد کالا",
          "نوع",
          "دسته‌بندی",
          "طول (متر)",
          "مساحت (م²)",
          "قیمت واحد (؋)",
          "مبلغ کل (؋)",
        ],
      ];

      sells.forEach((sell, idx) => {
        summaryData.push([
          idx + 1,
          sell.income?.lotNumber || sell.incomeId || "---",
          getTypeName(sell),
          getCategoryName(sell),
          sell.length,
          sell.area,
          sell.unit_price,
          sell.total,
        ]);
      });

      summaryData.push([], ["جمع کل", "", "", "", "", "", "", bill.totalAmount]);
      summaryData.push(["پرداخت شده", "", "", "", "", "", "", bill.paidAmount]);
      summaryData.push(["باقیمانده", "", "", "", "", "", "", bill.remainingAmount]);

      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      worksheet["!cols"] = [
        { wch: 8 },   // ردیف
        { wch: 18 },  // کد کالا
        { wch: 18 },  // نوع
        { wch: 18 },  // دسته‌بندی
        { wch: 12 },  // طول
        { wch: 12 },  // مساحت
        { wch: 15 },  // قیمت واحد
        { wch: 15 },  // مبلغ کل
      ];

      // RTL worksheet view (Persian Excel users expect this)
      worksheet["!dir"] = "rtl";

      XLSX.utils.book_append_sheet(workbook, worksheet, "فاکتور");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `bill_${bill.billNumber}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePDFDownload}
        disabled={loading}
        className="text-red-600 hover:text-red-800 transition"
        title="دانلود PDF فاکتور"
      >
        <FaFilePdf className="h-5 w-5" />
      </button>
      <button
        onClick={handleExcelDownload}
        disabled={loading}
        className="text-green-600 hover:text-green-800 transition"
        title="دانلود Excel فاکتور"
      >
        <FaFileExcel className="h-5 w-5" />
      </button>
    </div>
  );
};

export default SingleBillDownload;