import React, { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";

import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";

moment.locale("en");

const BASE_URL = import.meta.env.VITE_BASE_URL;

// Safely parse any numeric-ish value
const parseNumber = (val) => {
  if (val === undefined || val === null) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");

const BillDateDownload = () => {
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

      const { data } = await axios.get(`${BASE_URL}/bill/date_range`, {
        params: { from, to },
      });

      const bills = data?.bills || [];

      if (bills.length === 0) {
        alert("هیچ بلی در این بازه یافت نشد");
        return;
      }

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      doc.setR2L(false);

      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const formattedFrom = moment(from).format("YYYY/MM/DD");
      const formattedTo = moment(to).format("YYYY/MM/DD");
      const today = moment().format("YYYY/MM/DD");

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginRight = 40;

      // ─── Title (page 1) ──────────────────────────────────────────
      doc.setFontSize(14);
      doc.text(
        `گزارش بلی‌ها از ${formattedFrom} تا ${formattedTo}`,
        pageWidth - marginRight,
        120,
        { align: "right" }
      );
      doc.setFontSize(10);
      doc.text(`تاریخ صدور: ${today}`, pageWidth - marginRight, 140, {
        align: "right",
      });

      let startY = 160;

      // ─── Group bills by currency ─────────────────────────────────
      // Adjust these field names if your API returns different shape.
      const afnBills = bills.filter((b) => b.isAfn === true || b.isAfn === 1);
      const usdBills = bills.filter((b) => !(b.isAfn === true || b.isAfn === 1));

      // ─── Helper: add a table for a group ─────────────────────────
      const addBillTable = (items, title, isAfn, fillColor) => {
        if (!items || items.length === 0) return false;

        // Page break if near bottom
        if (startY > pageHeight - 120) {
          doc.addPage();
          startY = 60;
        }

        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(title, pageWidth - marginRight, startY, { align: "right" });
        startY += 20;

        const headers = [
          [
            "شماره",
            "مشتری",
            "بابت",
            "توسط",
            "تاریخ",
            `مبلغ (${symbolFor(isAfn)})`,
          ],
        ];
        const body = items.map((bill) => [
          bill.id?.toString() || "—",
          bill.customer?.name || bill.customerName || "—",
          bill.purpose || "—",
          bill.by || "نامشخص",
          moment(bill.createdAt).format("YYYY/MM/DD"),
          parseNumber(bill.amount).toLocaleString(),
        ]);

        autoTable(doc, {
          startY,
          head: headers,
          body,
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
            fillColor,
            textColor: [255, 255, 255],
            fontSize: 9,
            halign: "center",
          },
          columnStyles: {
            5: { halign: "right" }, // amount column
          },
          margin: { left: 30, right: 30, bottom: 40 },
        });

        startY = doc.lastAutoTable.finalY + 15;
        return true;
      };

      // ─── 1. AFN bills ────────────────────────────────────────────
      const renderedAfn = addBillTable(afnBills, "بلی‌های افغانی", true, [
        40, 100, 160,
      ]);

      // ─── 2. USD bills ────────────────────────────────────────────
      const renderedUsd = addBillTable(usdBills, "بلی‌های دالری", false, [
        120, 80, 40,
      ]);

      // ─── Summary ─────────────────────────────────────────────────
      const totalAfn = afnBills.reduce(
        (s, b) => s + parseNumber(b.amount),
        0
      );
      const totalUsd = usdBills.reduce(
        (s, b) => s + parseNumber(b.amount),
        0
      );

      if (renderedAfn || renderedUsd) {
        // Page break if summary would overflow
        if (startY > pageHeight - 140) {
          doc.addPage();
          startY = 60;
        }

        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(
          `مجموع افغانی: ${totalAfn.toLocaleString()} ؋  (${afnBills.length} مورد)`,
          pageWidth - marginRight,
          startY,
          { align: "right" }
        );
        startY += 20;
        doc.text(
          `مجموع دالر: ${totalUsd.toLocaleString()} $  (${usdBills.length} مورد)`,
          pageWidth - marginRight,
          startY,
          { align: "right" }
        );
        startY += 20;
        doc.setFontSize(12);
        doc.setTextColor(0, 100, 0);
        doc.text(
          `تعداد کل بلی‌ها: ${bills.length} مورد`,
          pageWidth - marginRight,
          startY,
          { align: "right" }
        );
        doc.setTextColor(0, 0, 0);
      }

      // ─── Page numbers ────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`${i}/${pageCount}`, pageWidth - marginRight, pageHeight - 40, {
          align: "right",
        });
      }

      doc.save(`Bills_${formattedFrom}_to_${formattedTo}_${today}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت اطلاعات بلی‌ها");
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
        {loading ? "در حال ساخت PDF..." : "دانلود گزارش بلی‌ها"}
      </button>
    </div>
  );
};

export default BillDateDownload;