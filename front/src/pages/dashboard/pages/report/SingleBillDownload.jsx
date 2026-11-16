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

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");

const SingleBillDownload = ({ billId, billNumber }) => {
  const [loading, setLoading] = useState(false);

  const fetchBill = async () => {
    const response = await axios.get(`${BASE_URL}/bill/${billId}`);
    const payload = response.data;
    return payload?.bill ?? payload;
  };

  // ─── Carpet helpers ─────────────────────────────────────────────────────
  const getSellCategoryName = (sell) =>
    sell.category?.name ||
    sell.categoryDetail?.name ||
    sell.Category?.name ||
    "---";

  const getSellTypeName = (sell) =>
    sell.type?.name ||
    sell.categoryDetail?.type?.name ||
    sell.Category?.type?.name ||
    "---";

  // ─── Blanket helpers ───────────────────────────────────────────────────
  const getBSaleCategoryName = (b) =>
    b.category?.name || b.categoryDetail?.name || "---";

  const getBSaleTypeName = (b) =>
    b.type?.name || b.category?.type?.name || b.categoryDetail?.type?.name || "---";

  // ─── Extract both arrays from any of the possible keys ─────────────────
  const extractRows = (bill) => {
    const sells = Array.isArray(bill.sells)
      ? bill.sells
      : Array.isArray(bill.sellRecords)
        ? bill.sellRecords
        : [];

    const bsales = Array.isArray(bill.bsales)
      ? bill.bsales
      : Array.isArray(bill.bsaleRecords)
        ? bill.bsaleRecords
        : [];

    return { sells, bsales };
  };

  // ─── PDF ────────────────────────────────────────────────────────────────
  const handlePDFDownload = async () => {
    try {
      setLoading(true);
      const bill = await fetchBill();
      if (!bill) {
        alert("فاکتور یافت نشد");
        return;
      }

      const { sells, bsales } = extractRows(bill);
      const hasSells = sells.length > 0;
      const hasBSales = bsales.length > 0;
      const billSymbol = symbolFor(bill.isAfn);

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

      let currentY = bill.notes ? 190 : 175;

      // ─── Carpet section (unchanged) ─────────────────────────────────────
      if (hasSells) {
        doc.setFontSize(13);
        doc.text("فروش فرش", pageWidth - margin, currentY, { align: "right" });
        currentY += 12;

        const headers = [
          [
            "نمبر",
            "کد کالا",
            "نوع",
            "دسته‌بندی",
            "رنگ",
            "طول (متر)",
            "مساحت (m²)",
            `قیمت واحد (${billSymbol})`,
            `مبلغ کل (${billSymbol})`,
          ],
        ];

        const body = sells.map((sell, idx) => [
          idx + 1,
          sell.income?.lotNumber || sell.incomeId || "---",
          getSellTypeName(sell),
          getSellCategoryName(sell),
          sell.income?.color || "---",
          sell.length,
          sell.area,
          sell.unit_price,
          sell.total,
        ]);

        autoTable(doc, {
          startY: currentY,
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
          columnStyles: {
            0: { cellWidth: contentWidth * 0.05 },
            1: { cellWidth: contentWidth * 0.11 },
            2: { cellWidth: contentWidth * 0.12 },
            3: { cellWidth: contentWidth * 0.13 },
            4: { cellWidth: contentWidth * 0.09 },
            5: { cellWidth: contentWidth * 0.10 },
            6: { cellWidth: contentWidth * 0.11 },
            7: { cellWidth: contentWidth * 0.14 },
            8: { cellWidth: contentWidth * 0.15 },
          },
        });

        currentY = doc.lastAutoTable.finalY + 20;
      }

      // ─── Blanket section (receipt/remaind removed) ──────────────────────
      if (hasBSales) {
        if (!hasSells) currentY = bill.notes ? 190 : 175;

        doc.setFontSize(13);
        doc.text("فروش بلنکت", pageWidth - margin, currentY, { align: "right" });
        currentY += 12;

        // ✅ 7 columns: نمبر، شناسه موجودی، نوع، دسته‌بندی، تعداد، قیمت واحد، مبلغ کل
        const headers = [
          [
            "نمبر",
            "شناسه موجودی",
            "نوع",
            "دسته‌بندی",
            "تعداد",
            `قیمت واحد (${billSymbol})`,
            `مبلغ کل (${billSymbol})`,
          ],
        ];

        const body = bsales.map((b, idx) => [
          idx + 1,
          b.bExist?.id || b.bexistId || "---",
          getBSaleTypeName(b),
          getBSaleCategoryName(b),
          b.quantity,
          b.unit_price,
          b.total,
        ]);

        autoTable(doc, {
          startY: currentY,
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
          // ✅ 7 columns, sum = 1.00
          columnStyles: {
            0: { cellWidth: contentWidth * 0.06 }, // نمبر
            1: { cellWidth: contentWidth * 0.14 }, // شناسه موجودی
            2: { cellWidth: contentWidth * 0.16 }, // نوع
            3: { cellWidth: contentWidth * 0.18 }, // دسته‌بندی
            4: { cellWidth: contentWidth * 0.12 }, // تعداد
            5: { cellWidth: contentWidth * 0.16 }, // قیمت واحد
            6: { cellWidth: contentWidth * 0.18 }, // مبلغ کل
          },
        });

        currentY = doc.lastAutoTable.finalY + 20;
      }

      // ─── Empty state ────────────────────────────────────────────────────
      if (!hasSells && !hasBSales) {
        doc.text("هیچ قلم فروشی وجود ندارد.", pageWidth - margin, currentY, {
          align: "right",
        });
      } else {
        // ─── Totals (bill-level — still show receipt & remaind once) ────
        doc.setFontSize(12);
        doc.text(
          `جمع کل: ${bill.totalAmount} ${billSymbol}`,
          pageWidth - margin,
          currentY,
          { align: "right" }
        );
        doc.text(
          `پرداخت شده: ${bill.paidAmount} ${billSymbol}`,
          pageWidth - margin,
          currentY + 20,
          { align: "right" }
        );
        doc.text(
          `باقیمانده: ${bill.remainingAmount} ${billSymbol}`,
          pageWidth - margin,
          currentY + 40,
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

  // ─── Excel ──────────────────────────────────────────────────────────────
  const handleExcelDownload = async () => {
    try {
      setLoading(true);
      const bill = await fetchBill();
      if (!bill) {
        alert("فاکتور یافت نشد");
        return;
      }

      const { sells, bsales } = extractRows(bill);
      const hasSells = sells.length > 0;
      const hasBSales = bsales.length > 0;
      const billSymbol = symbolFor(bill.isAfn);

      const workbook = XLSX.utils.book_new();

      // ─── Summary header ─────────────────────────────────────────────────
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
        ["واحد پول", bill.isAfn ? "افغانی (؋)" : "دالر ($)"],
        ["یادداشت", bill.notes || "---"],
        [],
      ];

      // ─── Carpet section (unchanged) ─────────────────────────────────────
      if (hasSells) {
        summaryData.push(["فروش فرش"]);
        summaryData.push([
          "ردیف",
          "کد کالا",
          "نوع",
          "دسته‌بندی",
          "رنگ",
          "طول (متر)",
          "مساحت (m²)",
          `قیمت واحد (${billSymbol})`,
          `مبلغ کل (${billSymbol})`,
        ]);

        sells.forEach((sell, idx) => {
          summaryData.push([
            idx + 1,
            sell.income?.lotNumber || sell.incomeId || "---",
            getSellTypeName(sell),
            getSellCategoryName(sell),
            sell.income?.color || "---",
            sell.length,
            sell.area,
            sell.unit_price,
            sell.total,
          ]);
        });
        summaryData.push([]);
      }

      // ─── Blanket section (receipt/remaind removed) ──────────────────────
      if (hasBSales) {
        summaryData.push(["فروش بلنکت"]);
        // ✅ 7 columns — no دریافتی, no باقیمانده
        summaryData.push([
          "ردیف",
          "شناسه موجودی",
          "نوع",
          "دسته‌بندی",
          "تعداد",
          `قیمت واحد (${billSymbol})`,
          `مبلغ کل (${billSymbol})`,
        ]);

        bsales.forEach((b, idx) => {
          summaryData.push([
            idx + 1,
            b.bExist?.id || b.bexistId || "---",
            getBSaleTypeName(b),
            getBSaleCategoryName(b),
            b.quantity,
            b.unit_price,
            b.total,
          ]);
        });
        summaryData.push([]);
      }

      // ─── Empty state ────────────────────────────────────────────────────
      if (!hasSells && !hasBSales) {
        summaryData.push(["هیچ قلم فروشی وجود ندارد"]);
        summaryData.push([]);
      }

      // ─── Totals (bill-level) ────────────────────────────────────────────
      summaryData.push(["جمع کل", "", "", "", "", "", "", "", bill.totalAmount]);
      summaryData.push(["پرداخت شده", "", "", "", "", "", "", "", bill.paidAmount]);
      summaryData.push(["باقیمانده", "", "", "", "", "", "", "", bill.remainingAmount]);

      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      worksheet["!cols"] = [
        { wch: 8 },   // ردیف
        { wch: 18 },  // کد کالا / شناسه موجودی
        { wch: 18 },  // نوع
        { wch: 18 },  // دسته‌بندی
        { wch: 10 },  // رنگ / تعداد
        { wch: 12 },  // طول / قیمت واحد
        { wch: 12 },  // مساحت
        { wch: 15 },  // قیمت واحد
        { wch: 15 },  // مبلغ کل
      ];

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