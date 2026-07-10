import React, { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";

import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";

moment.locale("en");

const BASE_URL = import.meta.env.VITE_BASE_URL;

const ExpenseDateDownload = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!from || !to) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }

    try {
      setLoading(true);

      const { data } = await axios.get(`${BASE_URL}/expense/date_range`, {
        params: { from, to },
      });

      // Guard: if no expenses at all
      if (!data?.expenses || data.expenses.length === 0) {
        alert("هیچ هزینه‌ای در این بازه یافت نشد");
        return;
      }

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      doc.setR2L(false);

      // Add Font
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const formattedFrom = moment(from).format("YYYY/MM/DD");
      const formattedTo = moment(to).format("YYYY/MM/DD");
      const today = moment().format("YYYY/MM/DD");

      // ─── Title ──────────────────────────────────────────────────
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginRight = 40;

      doc.setFontSize(14);
      doc.text(
        `گزارش هزینه‌ها از ${formattedFrom} تا ${formattedTo}`,
        pageWidth - marginRight,
        120,
        { align: "right" }
      );
      doc.setFontSize(10);
      doc.text(`تاریخ صدور: ${today}`, pageWidth - marginRight, 140, { align: "right" });

      let startY = 160;

      // ─── Helper: add a table for a group ─────────────────────
      const addExpenseTable = (items, title, isCalculated) => {
        if (!items || items.length === 0) {
          // Skip if empty
          return;
        }

        // Section title
        doc.setFontSize(12);
        doc.text(title, pageWidth - marginRight, startY, { align: "right" });
        startY += 20;

        const headers = [
          ["مبلغ (؋)", "بابت", "توسط", "تاریخ", "شماره"],
        ];
        const body = items.map((expense) => [
          Number(expense.amount).toLocaleString(),
          expense.purpose || "—",
          expense.by || "نامشخص",
          moment(expense.createdAt).format("YYYY/MM/DD"),
          expense.id.toString(),
        ]);

        autoTable(doc, {
          startY,
          head: headers,
          body: body,
          theme: "grid",
          styles: {
            font: "Vazirmatn",
            fontSize: 9,
            halign: "center",
            valign: "middle",
            cellPadding: 6,
          },
          headStyles: {
            font: "Vazirmatn",
            fontStyle: "normal",
            fillColor: isCalculated ? [40, 160, 90] : [200, 160, 40], // green for calculated, orange/yellow for non
            textColor: [255, 255, 255],
            fontSize: 9,
            halign: "center",
          },
          margin: { left: 30, right: 30, bottom: 40 },
        });

        startY = doc.lastAutoTable.finalY + 15;
      };

      // ─── 1. Calculated Expenses ──────────────────────────────
      const calculatedItems = data.calculated?.items || [];
      if (calculatedItems.length > 0) {
        addExpenseTable(calculatedItems, "هزینه‌های محاسبه شده", true);
      }

      // ─── 2. Non-Calculated Expenses ──────────────────────────
      const nonCalculatedItems = data.nonCalculated?.items || [];
      if (nonCalculatedItems.length > 0) {
        addExpenseTable(nonCalculatedItems, "هزینه‌های محاسبه نشده", false);
      }

      // ─── Summary ──────────────────────────────────────────────
      const totalCalculated = data.calculated?.total || 0;
      const totalNonCalculated = data.nonCalculated?.total || 0;
      const totalAll = data.totalAmount || 0;
      const countCalculated = data.calculated?.count || 0;
      const countNonCalculated = data.nonCalculated?.count || 0;

      doc.setFontSize(11);
      doc.text(`مجموع هزینه‌های محاسبه شده: ${totalCalculated.toLocaleString()} ؋  (${countCalculated} مورد)`, pageWidth - marginRight, startY, { align: "right" });
      startY += 20;
      doc.text(`مجموع هزینه‌های محاسبه نشده: ${totalNonCalculated.toLocaleString()} ؋  (${countNonCalculated} مورد)`, pageWidth - marginRight, startY, { align: "right" });
      startY += 20;
      doc.setFontSize(12);
      doc.setTextColor(0, 100, 0);
      doc.text(`جمع کل هزینه‌ها: ${totalAll.toLocaleString()} ؋`, pageWidth - marginRight, startY, { align: "right" });
      doc.setTextColor(0, 0, 0);

      // ─── Page numbers ────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`${i}/${pageCount}`, pageWidth - marginRight, pageHeight - 40, { align: "right" });
      }

      doc.save(`Expenses_${formattedFrom}_to_${formattedTo}_${today}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت اطلاعات هزینه‌ها");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
        />
        <span className="text-gray-500">تا</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
        />
      </div>

      <button
        onClick={handleDownload}
        disabled={loading}
        className="bg-cyan-800 text-white px-6 py-2 rounded hover:bg-cyan-700 disabled:bg-gray-400 w-full sm:w-auto"
      >
        {loading ? "در حال ساخت PDF..." : "دانلود گزارش هزینه‌ها"}
      </button>
    </div>
  );
};

export default ExpenseDateDownload;