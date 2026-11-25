// components/accounting/SingleIncomeBillDownload.jsx
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

const statusText = (status) =>
  status === "paid"
    ? "پرداخت شده"
    : status === "partial"
      ? "پرداخت جزئی"
      : "پرداخت نشده";

const SingleIncomeBillDownload = ({ billId }) => {
  const [loading, setLoading] = useState(false);

  const fetchBill = async () => {
    const response = await axios.get(`${BASE_URL}/incomebill/${billId}`);
    const payload = response.data;
    return payload?.bill ?? payload;
  };

  // ─── Extract both arrays from any of the possible keys ─────────────────
  const extractRows = (bill) => {
    const incomes = Array.isArray(bill.incomeRecords)
      ? bill.incomeRecords
      : Array.isArray(bill.Incomes)
        ? bill.Incomes
        : [];

    const bincomes = Array.isArray(bill.bincomeRecords)
      ? bill.bincomeRecords
      : Array.isArray(bill.BIncomes)
        ? bill.BIncomes
        : [];

    return { incomes, bincomes };
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

      const { incomes, bincomes } = extractRows(bill);
      const hasIncomes = incomes.length > 0;
      const hasBIncomes = bincomes.length > 0;
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
      doc.text("فاکتور خرید (ورودی)", pageWidth - margin, 50, { align: "right" });

      doc.setFontSize(12);
      doc.text(`شماره: ${bill.billNumber}`, pageWidth - margin, 80, { align: "right" });

      const customerName = bill.customer?.fullname || "---";
      const billDate = moment(bill.createdAt).format("YYYY/MM/DD");

      doc.text(`مشتری: ${customerName}`, pageWidth - margin, 105, { align: "right" });
      doc.text(`تاریخ: ${billDate}`, pageWidth - margin, 125, { align: "right" });
      doc.text(`وضعیت: ${statusText(bill.status)}`, pageWidth - margin, 145, { align: "right" });
      doc.text(`نرخ دالر: ${bill.DV ?? "---"}`, pageWidth - margin, 165, { align: "right" });
      if (bill.notes) {
        doc.text(`یادداشت: ${bill.notes}`, pageWidth - margin, 185, { align: "right" });
      }

      let currentY = bill.notes ? 210 : 190;

      // ─── Carpet incomes section ─────────────────────────────────────────
      if (hasIncomes) {
        doc.setFontSize(13);
        doc.text("دریافت فرش", pageWidth - margin, currentY, { align: "right" });
        currentY += 12;

        const headers = [
          [
            "نمبر",
            "کد کالا",
            "نوع",
            "دسته‌بندی",
            "رنگ",
            "عرض (متر)",
            "طول (متر)",
            "مساحت (m²)",
            `قیمت واحد (${billSymbol})`,
            `مبلغ کل (${billSymbol})`,
          ],
        ];

        const body = incomes.map((inc, idx) => [
          idx + 1,
          inc.lotNumber || inc.id || "---",
          inc.type?.name || "---",
          inc.category?.name || "---",
          inc.color || "---",
          inc.width,
          inc.length,
          inc.area,
          inc.unit_price,
          inc.amount,
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
            fontSize: 8,
            halign: "center",
            valign: "middle",
            cellPadding: 4,
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [230, 230, 230],
            textColor: 20,
            fontStyle: "normal",
            halign: "center",
          },
        });

        currentY = doc.lastAutoTable.finalY + 20;
      }

      // ─── Blanket / foam incomes section ─────────────────────────────────
      if (hasBIncomes) {
        if (!hasIncomes) currentY = bill.notes ? 210 : 190;

        doc.setFontSize(13);
        doc.text("دریافت بلنکت / فوم", pageWidth - margin, currentY, { align: "right" });
        currentY += 12;

        const headers = [
          [
            "نمبر",
            "شناسه موجودی",
            "نوع",
            "دسته‌بندی",
            "وزن / تعداد",
            `قیمت واحد (${billSymbol})`,
            `مبلغ کل (${billSymbol})`,
          ],
        ];

        const body = bincomes.map((b, idx) => [
          idx + 1,
          b.id || "---",
          b.type?.name || "---",
          b.category?.name || "---",
          b.weight ?? b.amount ?? "---",
          b.unitPrice ?? b.unit_price,
          b.totalPrice ?? b.total,
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
            0: { cellWidth: contentWidth * 0.06 },
            1: { cellWidth: contentWidth * 0.14 },
            2: { cellWidth: contentWidth * 0.16 },
            3: { cellWidth: contentWidth * 0.18 },
            4: { cellWidth: contentWidth * 0.12 },
            5: { cellWidth: contentWidth * 0.16 },
            6: { cellWidth: contentWidth * 0.18 },
          },
        });

        currentY = doc.lastAutoTable.finalY + 20;
      }

      // ─── Empty state ────────────────────────────────────────────────────
      if (!hasIncomes && !hasBIncomes) {
        doc.text("هیچ قلم خریدی وجود ندارد.", pageWidth - margin, currentY, {
          align: "right",
        });
      } else {
        // ─── Totals (bill-level) ──────────────────────────────────────────
        doc.setFontSize(12);
        doc.text(
          `جمع کل: ${bill.totalAmount} ${billSymbol}`,
          pageWidth - margin,
          currentY,
          { align: "right" }
        );
        if (Number(bill.discount_percent) > 0) {
          doc.text(
            `تخفیف (${bill.discount_percent}%): ${bill.discounted_amount} ${billSymbol}`,
            pageWidth - margin,
            currentY + 20,
            { align: "right" }
          );
          currentY += 20;
        }
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

      doc.save(`income_bill_${bill.billNumber}.pdf`);
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

      const { incomes, bincomes } = extractRows(bill);
      const hasIncomes = incomes.length > 0;
      const hasBIncomes = bincomes.length > 0;
      const billSymbol = symbolFor(bill.isAfn);

      const workbook = XLSX.utils.book_new();

      const summaryData = [
        ["فاکتور خرید (ورودی)"],
        ["شماره فاکتور", bill.billNumber],
        ["مشتری", bill.customer?.fullname || "---"],
        ["تاریخ", moment(bill.createdAt).format("YYYY/MM/DD")],
        ["وضعیت", statusText(bill.status)],
        ["واحد پول", bill.isAfn ? "افغانی (؋)" : "دالر ($)"],
        ["نرخ دالر", bill.DV ?? "---"],
        ["یادداشت", bill.notes || "---"],
        [],
      ];

      if (hasIncomes) {
        summaryData.push(["دریافت فرش"]);
        summaryData.push([
          "ردیف",
          "کد کالا",
          "نوع",
          "دسته‌بندی",
          "رنگ",
          "عرض (متر)",
          "طول (متر)",
          "مساحت (m²)",
          `قیمت واحد (${billSymbol})`,
          `مبلغ کل (${billSymbol})`,
        ]);
        incomes.forEach((inc, idx) => {
          summaryData.push([
            idx + 1,
            inc.lotNumber || inc.id || "---",
            inc.type?.name || "---",
            inc.category?.name || "---",
            inc.color || "---",
            inc.width,
            inc.length,
            inc.area,
            inc.unit_price,
            inc.amount,
          ]);
        });
        summaryData.push([]);
      }

      if (hasBIncomes) {
        summaryData.push(["دریافت بلنکت / فوم"]);
        summaryData.push([
          "ردیف",
          "شناسه موجودی",
          "نوع",
          "دسته‌بندی",
          "وزن / تعداد",
          `قیمت واحد (${billSymbol})`,
          `مبلغ کل (${billSymbol})`,
        ]);
        bincomes.forEach((b, idx) => {
          summaryData.push([
            idx + 1,
            b.id || "---",
            b.type?.name || "---",
            b.category?.name || "---",
            b.weight ?? b.amount ?? "---",
            b.unitPrice ?? b.unit_price,
            b.totalPrice ?? b.total,
          ]);
        });
        summaryData.push([]);
      }

      if (!hasIncomes && !hasBIncomes) {
        summaryData.push(["هیچ قلم خریدی وجود ندارد"]);
        summaryData.push([]);
      }

      summaryData.push(["جمع کل", "", "", "", "", "", "", "", "", bill.totalAmount]);
      summaryData.push([
        "تخفیف",
        bill.discount_percent,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        bill.discounted_amount,
      ]);
      summaryData.push(["پرداخت شده", "", "", "", "", "", "", "", "", bill.paidAmount]);
      summaryData.push(["باقیمانده", "", "", "", "", "", "", "", "", bill.remainingAmount]);

      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      worksheet["!cols"] = [
        { wch: 8 },   // ردیف
        { wch: 16 },  // کد کالا / شناسه
        { wch: 16 },  // نوع
        { wch: 16 },  // دسته‌بندی
        { wch: 12 },  // رنگ / وزن
        { wch: 12 },  // عرض
        { wch: 12 },  // طول
        { wch: 12 },  // مساحت
        { wch: 15 },  // قیمت واحد
        { wch: 15 },  // مبلغ کل
      ];
      worksheet["!dir"] = "rtl";

      XLSX.utils.book_append_sheet(workbook, worksheet, "فاکتور خرید");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `income_bill_${bill.billNumber}.xlsx`);
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

export default SingleIncomeBillDownload;