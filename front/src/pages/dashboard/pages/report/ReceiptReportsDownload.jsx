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

const ReceiptReportsDownload = () => {
  const [loading, setLoading] = useState(false);
  const [buyerId, setBuyerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [buyers, setBuyers] = useState([]); // optional: fetch buyers list for dropdown

  // Optional: fetch buyers list for dropdown (you can implement if needed)
  // useEffect(() => { fetchBuyers(); }, []);

  const fetchFilteredReceipts = async () => {
    const params = new URLSearchParams();
    if (buyerId) params.append("buyerId", buyerId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const response = await axios.get(`${BASE_URL}/receipt/filter?${params.toString()}`);
    return response.data;
  };

  const handlePDFDownload = async () => {
    try {
      setLoading(true);
      const receipts = await fetchFilteredReceipts();

      if (!receipts || receipts.length === 0) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setR2L(false);
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const today = moment().format("YYYY/MM/DD");
      const filterDesc = [];
      if (buyerId) filterDesc.push(`خریدار ID: ${buyerId}`);
      if (startDate) filterDesc.push(`از تاریخ: ${startDate}`);
      if (endDate) filterDesc.push(`تا تاریخ: ${endDate}`);
      const filterText = filterDesc.length ? ` - فیلتر: ${filterDesc.join(" - ")}` : "";

      doc.setFontSize(14);
      doc.text(
        `گزارش رسیدهای خریداران${filterText} (تاریخ: ${today})`,
        doc.internal.pageSize.getWidth() - 40,
        40,
        { align: "right" }
      );

      // Table headers
      const headers = [["ID", "خریدار", "مبلغ (؋)", "توضیحات", "تاریخ ایجاد"]];
      const body = receipts.map(r => [
        r.id,
        r.buyer?.fullname || `خریدار ${r.buyerId}`,
        r.amountofmoney,
        r.description || "-",
        moment(r.createdAt).format("YYYY/MM/DD"),
      ]);

      autoTable(doc, {
        startY: 70,
        head: headers,
        body: body,
        theme: "grid",
        styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
        headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
        margin: { left: 30, right: 30 },
      });

      const finalY = doc.lastAutoTable.finalY + 20;
      const totalAmount = receipts.reduce((sum, r) => sum + parseFloat(r.amountofmoney), 0);
      doc.setFontSize(11);
      doc.text(
        `مجموع مبلغ: ${totalAmount.toFixed(2)} ؋`,
        doc.internal.pageSize.getWidth() - 40,
        finalY,
        { align: "right" }
      );

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`${i}/${pageCount}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 30, { align: "right" });
      }

      doc.save(`receipts_${moment().format("YYYY-MM-DD")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت یا ایجاد PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    try {
      setLoading(true);
      const receipts = await fetchFilteredReceipts();

      if (!receipts || receipts.length === 0) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const filterDesc = [];
      if (buyerId) filterDesc.push(`خریدار ID: ${buyerId}`);
      if (startDate) filterDesc.push(`از تاریخ: ${startDate}`);
      if (endDate) filterDesc.push(`تا تاریخ: ${endDate}`);
      const filterText = filterDesc.join(" - ");

      const summaryData = [
        ["گزارش رسیدهای خریداران"],
        ["تاریخ گزارش", moment().format("YYYY/MM/DD")],
        ["فیلترها", filterText],
        [],
        ["ID", "خریدار", "مبلغ (؋)", "توضیحات", "تاریخ ایجاد", "زمان ایجاد"],
      ];

      receipts.forEach(r => {
        summaryData.push([
          r.id,
          r.buyer?.fullname || r.buyerId,
          r.amountofmoney,
          r.description || "-",
          moment(r.createdAt).format("YYYY/MM/DD"),
          moment(r.createdAt).format("HH:mm:ss"),
        ]);
      });

      const totalAmount = receipts.reduce((sum, r) => sum + parseFloat(r.amountofmoney), 0);
      summaryData.push([], ["جمع کل", "", totalAmount.toFixed(2), "", "", ""]);

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "رسیدها");

      // Optional: separate sheet per buyer if needed (you can add later)

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `receipts_${moment().format("YYYY-MM-DD")}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("خطا در دریافت یا ایجاد Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* <div>
          <label className="block text-sm font-medium">شناسه خریدار (اختیاری)</label>
          <input
            type="number"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="border rounded px-3 py-2 w-40"
            placeholder="مثلاً 5"
          />
        </div> */}
        <div>
          <label className="block text-sm font-medium">از تاریخ (شمسی)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">تا تاریخ (شمسی)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>
      <div className="flex gap-4">
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
    </div>
  );
};

export default ReceiptReportsDownload;