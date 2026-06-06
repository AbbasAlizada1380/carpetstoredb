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

const PaymentReportsDownload = () => {
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
        const res = await axios.get(`${BASE_URL}/customer?limit=300`);
        // API returns { customers: [...], pagination: {...} }
        setCustomers(res.data.customers || []);
      } catch (err) {
        console.error("Error fetching customers:", err);
        alert("خطا در دریافت لیست مشتریان");
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  const fetchFilteredPayments = async () => {
    const params = new URLSearchParams();
    if (customerId) params.append("customerId", customerId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const response = await axios.get(`${BASE_URL}/pay/filter?${params.toString()}`);
    return response.data.data; // { data: [...], pagination: {...} }
  };

  const handlePDFDownload = async () => {
    try {
      setLoading(true);
      const payments = await fetchFilteredPayments();

      if (!payments || payments.length === 0) {
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
        `گزارش پرداخت‌های مشتریان${filterText} (تاریخ: ${today})`,
        doc.internal.pageSize.getWidth() - 40,
        40,
        { align: "right" }
      );

      // Table headers
      const headers = [["ID", "مشتری", "مبلغ (؋)", "توضیحات", "تاریخ ایجاد"]];
      const body = payments.map(p => [
        p.id,
        p.customer?.fullname || `مشتری ${p.customerId}`,
        p.amountofmoney,
        p.description || "-",
        moment(p.createdAt).format("YYYY/MM/DD"),
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
      const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amountofmoney), 0);
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

      doc.save(`payments_${moment().format("YYYY-MM-DD")}.pdf`);
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
      const payments = await fetchFilteredPayments();

      if (!payments || payments.length === 0) {
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
        ["گزارش پرداخت‌های مشتریان"],
        ["تاریخ گزارش", moment().format("YYYY/MM/DD")],
        ["فیلترها", filterText],
        [],
        ["ID", "مشتری", "مبلغ (؋)", "توضیحات", "تاریخ ایجاد", "زمان ایجاد"],
      ];

      payments.forEach(p => {
        summaryData.push([
          p.id,
          p.customer?.fullname || p.customerId,
          p.amountofmoney,
          p.description || "-",
          moment(p.createdAt).format("YYYY/MM/DD"),
          moment(p.createdAt).format("HH:mm:ss"),
        ]);
      });

      const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amountofmoney), 0);
      summaryData.push([], ["جمع کل", "", totalAmount.toFixed(2), "", "", ""]);

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "پرداخت‌ها");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `payments_${moment().format("YYYY-MM-DD")}.xlsx`);
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
              <option value="">-- همه مشتریان --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
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

export default PaymentReportsDownload;