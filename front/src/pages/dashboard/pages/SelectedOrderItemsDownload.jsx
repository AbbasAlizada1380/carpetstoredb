import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";

import VazirmatnTTF from "../../../../public/ttf/Vazirmatn.js";

const SelectedOrderItemsDownload = ({ items }) => {
  const [loading, setLoading] = useState(false);

  const toFaNumber = (value) => {
    if (value === null || value === undefined) return "";
    return value.toString().replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };

  const handleDownload = () => {
    if (!items || items.length === 0) {
      alert("هیچ سفارشی انتخاب نشده");
      return;
    }

    setLoading(true);

    const doc = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
    });

    // 🔹 VERY IMPORTANT for Persian/Dari
    doc.setR2L(false);

    // Font
    doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
    doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
    doc.setFont("Vazirmatn");

    // Title
    doc.setFontSize(14);
    doc.text(
      "گزارش سفارشات انتخاب‌شده",
      550,
      120,
      { align: "right" }
    );

    // 🔹 RTL headers (RIGHT → LEFT)
    const headers = [
      ["دریافتی", "تعداد", "قیمت", "مبلغ", "تاریخ", "سایز", "نام فایل", "شماره"]
    ];

    // 🔹 RTL body
    const body = items.map((item) => [
      toFaNumber(item.receipt),
      toFaNumber(item.qnty),
      toFaNumber(item.price),
      toFaNumber(item.money),
      moment(item.createdAt).format("jYYYY/jMM/jDD"),
      toFaNumber(item.size),
      item.fileName || "—",
      toFaNumber(item.id),
    ]);

    autoTable(doc, {
      startY: 142,
      margin: { top: 142 },

      head: headers,
      body: body,

      theme: "grid",

      styles: {
        font: "Vazirmatn",
        fontSize: 10,
        halign: "center",
        valign: "middle",
      },

      headStyles: {
        font: "Vazirmatn",
        fontStyle: "normal",
        fillColor: [220, 220, 220],
        textColor: 20,
        halign: "center",
      },
    });

    // Summary
    const totalMoney = items.reduce(
      (sum, i) => sum + Number(i.money || 0),
      0
    );

    const today = moment().format("jYYYY/jMM/jDD");
    const y = doc.lastAutoTable.finalY + 30;

    doc.setFontSize(11);
    doc.text(
      `تعداد سفارشات: ${items.length.toLocaleString("fa-AF")}`,
      550,
      y,
      { align: "right" }
    );
    doc.text(
      `مجموع مبلغ: ${totalMoney.toLocaleString("fa-AF")}`,
      550,
      y + 18,
      { align: "right" }
    );
    doc.text(
      `صادر شده: ${today}`,
      550,
      y + 36,
      { align: "right" }
    );

    doc.save(
      `selected-orders-${moment().format("jYYYY-jMM-jDD")}.pdf`
    );

    setLoading(false);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="w-full bg-cyan-800 text-white px-4 py-3 rounded 
           transition hover:bg-cyan-700"

    >
      {loading ? "در حال ساخت PDF..." : "چاپ سفارشات انتخاب‌شده"}
    </button>

  );
};

export default SelectedOrderItemsDownload;
