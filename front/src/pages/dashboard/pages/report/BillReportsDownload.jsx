import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";

moment.locale("en");
const BASE_URL = import.meta.env.VITE_BASE_URL;

const BillReportsDownload = () => {
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch customers on mount (limit to 300)
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/buyer?limit=300`);
        setCustomers(res.data.buyers || []);
      } catch (err) {
        console.error("Error fetching customers:", err);
        alert("خطا در دریافت لیست مشتریان");
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  const fetchFilteredBills = async () => {
    const params = new URLSearchParams();
    if (customerId) params.append("customerId", customerId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    // Assuming backend has a /bill/filter endpoint that returns { success: true, bills: [...], pagination: {...} }
    const response = await axios.get(`${BASE_URL}/bill/filter?${params.toString()}`);
    return response.data.bills; // array of bills
  };

  const handlePDFDownload = async () => {
    try {
      setLoading(true);
      const bills = await fetchFilteredBills();

      if (!bills || bills.length === 0) {
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
      const selectedCustomer = customers.find(c => c.id === parseInt(customerId));
      if (selectedCustomer) filterDesc.push(`مشتری: ${selectedCustomer.fullname}`);
      else if (customerId) filterDesc.push(`مشتری ID: ${customerId}`);
      if (startDate) filterDesc.push(`از تاریخ: ${startDate}`);
      if (endDate) filterDesc.push(`تا تاریخ: ${endDate}`);
      const filterText = filterDesc.length ? ` - فیلتر: ${filterDesc.join(" - ")}` : "";

      doc.setFontSize(14);
      doc.text(
        `گزارش فاکتورهای فروش (بیل)${filterText} (تاریخ: ${today})`,
        doc.internal.pageSize.getWidth() - 40,
        40,
        { align: "right" }
      );

      // Table headers
      const headers = [
        ["شماره فاکتور", "خریدار", "تاریخ", "جمع کل (؋)", "پرداخت شده (؋)", "باقیمانده (؋)", "وضعیت", "یادداشت"]
      ];
      const body = bills.map(b => [
        b.billNumber,
        b.buyer?.fullname || `خریدار ${b.buyerId}`,
        moment(b.createdAt).format("YYYY/MM/DD"),
        b.totalAmount,
        b.paidAmount,
        b.remainingAmount,
        b.status === "paid" ? "پرداخت شده" : (b.status === "partial" ? "پرداخت جزئی" : "پرداخت نشده"),
        b.notes || "-",
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
      const totalAmount = bills.reduce((sum, b) => sum + parseFloat(b.totalAmount), 0);
      const totalPaid = bills.reduce((sum, b) => sum + parseFloat(b.paidAmount), 0);
      const totalRemaining = bills.reduce((sum, b) => sum + parseFloat(b.remainingAmount), 0);
      doc.setFontSize(11);
      doc.text(
        `جمع کل فاکتورها: ${totalAmount.toFixed(2)} ؋ | کل پرداختی: ${totalPaid.toFixed(2)} ؋ | کل باقیمانده: ${totalRemaining.toFixed(2)} ؋`,
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

      doc.save(`bills_${moment().format("YYYY-MM-DD")}.pdf`);
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
      const bills = await fetchFilteredBills();

      if (!bills || bills.length === 0) {
        alert("هیچ داده‌ای یافت نشد");
        return;
      }

      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const filterDesc = [];
      const selectedCustomer = customers.find(c => c.id === parseInt(customerId));
      if (selectedCustomer) filterDesc.push(`مشتری: ${selectedCustomer.fullname}`);
      else if (customerId) filterDesc.push(`مشتری ID: ${customerId}`);
      if (startDate) filterDesc.push(`از تاریخ: ${startDate}`);
      if (endDate) filterDesc.push(`تا تاریخ: ${endDate}`);
      const filterText = filterDesc.join(" - ");

      const summaryData = [
        ["گزارش فاکتورهای فروش (بیل)"],
        ["تاریخ گزارش", moment().format("YYYY/MM/DD")],
        ["فیلترها", filterText],
        [],
        ["شماره فاکتور", "خریدار", "تاریخ", "جمع کل (؋)", "پرداخت شده (؋)", "باقیمانده (؋)", "وضعیت", "یادداشت", "تاریخ ایجاد", "زمان ایجاد"],
      ];

      bills.forEach(b => {
        summaryData.push([
          b.billNumber,
          b.buyer?.fullname || b.buyerId,
          moment(b.date).format("YYYY/MM/DD"),
          b.totalAmount,
          b.paidAmount,
          b.remainingAmount,
          b.status === "paid" ? "پرداخت شده" : (b.status === "partial" ? "پرداخت جزئی" : "پرداخت نشده"),
          b.notes || "-",
          moment(b.createdAt).format("YYYY/MM/DD"),
          moment(b.createdAt).format("HH:mm:ss"),
        ]);
      });

      const totalAmount = bills.reduce((sum, b) => sum + parseFloat(b.totalAmount), 0);
      const totalPaid = bills.reduce((sum, b) => sum + parseFloat(b.paidAmount), 0);
      const totalRemaining = bills.reduce((sum, b) => sum + parseFloat(b.remainingAmount), 0);
      summaryData.push([], ["جمع کل", "", "", totalAmount.toFixed(2), totalPaid.toFixed(2), totalRemaining.toFixed(2), "", "", "", ""]);

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "فاکتورها");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `bills_${moment().format("YYYY-MM-DD")}.xlsx`);
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
        {/* Customer dropdown */}
        <div>
          <label className="block text-sm font-medium">انتخاب مشتری (اختیاری)</label>
          {loadingCustomers ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-40 border rounded px-3 py-2 bg-gray-100">در حال بارگیری...</div>
            </div>
          ) : (
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="border rounded px-3 py-2 w-48"
            >
              <option className="text-black" value="">-- همه مشتریان --</option>
              {customers.map(c => (
                <option className="text-black" key={c.id} value={c.id}>
                  {c.fullname} (ID: {c.id})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date range */}
        <div>
          <label className="block text-sm font-medium">از تاریخ</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">تا تاریخ</label>
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
          disabled={loading || loadingCustomers}
          className="bg-cyan-800 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "در حال ساخت PDF..." : "دانلود PDF"}
        </button>
        <button
          onClick={handleExcelDownload}
          disabled={loading || loadingCustomers}
          className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "در حال ساخت Excel..." : "دانلود Excel"}
        </button>
      </div>
    </div>
  );
};

export default BillReportsDownload;