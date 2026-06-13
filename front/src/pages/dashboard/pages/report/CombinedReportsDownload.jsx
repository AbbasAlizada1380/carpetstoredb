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

const CombinedReportsDownload = () => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const parseNumber = (val) => {
    if (val === undefined || val === null) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  // Fetch all data in parallel
  const fetchAllData = async () => {
    const params = new URLSearchParams();
    if (fromDate) params.append("startDate", fromDate);
    if (toDate) params.append("endDate", toDate);
    // For expense and attendance we use "from" and "to" (different param names)
    const expenseParams = new URLSearchParams();
    if (fromDate) expenseParams.append("from", fromDate);
    if (toDate) expenseParams.append("to", toDate);

    const paymentsPromise = axios.get(`${BASE_URL}/pay/filter?${params.toString()}`).then(res => res.data.data || []);
    const receiptsPromise = axios.get(`${BASE_URL}/receipt/filter?${params.toString()}`).then(res => res.data || []);
    const expensesPromise = axios.get(`${BASE_URL}/expense/date_range?${expenseParams.toString()}`).then(res => res.data.expenses || []);
    const salariesPromise = axios.get(`${BASE_URL}/attendance/date-range?${expenseParams.toString()}`).then(res => res.data.data || []);
    const otherIncomePromise = axios.get(`${BASE_URL}/other-incomes/report?${params.toString()}`).then(res => res.data.data || []);
    const categoryPromise = axios.get(`${BASE_URL}/category/reports`).then(res => {
      const apiData = res.data;
      if (apiData && typeof apiData === "object" && !Array.isArray(apiData)) {
        return { categories: apiData.categories || [], totalStockValue: apiData.totalStockValue || 0 };
      }
      if (Array.isArray(apiData)) {
        const categories = apiData;
        const totalStock = categories.reduce((sum, cat) => sum + (cat.summary?.totalStockValue || 0), 0);
        return { categories, totalStockValue: totalStock };
      }
      return { categories: [], totalStockValue: 0 };
    });

    const [payments, receipts, expenses, salaries, otherIncomes, categoryData] = await Promise.all([
      paymentsPromise, receiptsPromise, expensesPromise, salariesPromise, otherIncomePromise, categoryPromise
    ]);

    return { payments, receipts, expenses, salaries, otherIncomes, categoryData };
  };

  // PDF generation
  const handlePDFDownload = async () => {
    if (!fromDate || !toDate) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }

    try {
      setLoading(true);
      const { payments, receipts, expenses, salaries, otherIncomes, categoryData } = await fetchAllData();

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setR2L(false);
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const today = moment().format("YYYY/MM/DD");
      const dateRangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;

      doc.setFontSize(14);
      doc.text(
        `گزارش جامع (${dateRangeStr})`,
        doc.internal.pageSize.getWidth() - 40,
        40,
        { align: "right" }
      );
      doc.setFontSize(10);
      doc.text(
        `تاریخ تولید: ${today}`,
        doc.internal.pageSize.getWidth() - 40,
        60,
        { align: "right" }
      );

      let startY = 80;

      const addSectionTitle = (title, y) => {
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(title, doc.internal.pageSize.getWidth() - 40, y, { align: "right" });
        return y + 20;
      };

      // 1. Payments
      startY = addSectionTitle(" گزارش پرداخت‌های مشتریان", startY);
      if (payments.length === 0) {
        doc.text("هیچ پرداختی یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const payHeaders = [["ID", "مشتری", "مبلغ (؋)", "توضیحات", "تاریخ"]];
        const payBody = payments.map(p => [
          p.id,
          p.customer?.fullname || `مشتری ${p.customerId}`,
          p.amountofmoney,
          p.description || "-",
          moment(p.createdAt).format("YYYY/MM/DD")
        ]);
        autoTable(doc, {
          startY,
          head: payHeaders,
          body: payBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 }
        });
        startY = doc.lastAutoTable.finalY + 15;
        const totalPay = payments.reduce((s, p) => s + parseNumber(p.amountofmoney), 0);
        doc.setFontSize(11);
        doc.text(`جمع پرداختی‌ها: ${totalPay.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // 2. Receipts
      startY = addSectionTitle(" گزارش رسیدهای خریداران", startY);
      if (receipts.length === 0) {
        doc.text("هیچ رسیدی یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const recHeaders = [["ID", "خریدار", "مبلغ (؋)", "توضیحات", "تاریخ"]];
        const recBody = receipts.map(r => [
          r.id,
          r.buyer?.fullname || `خریدار ${r.buyerId}`,
          r.amountofmoney,
          r.description || "-",
          moment(r.createdAt).format("YYYY/MM/DD")
        ]);
        autoTable(doc, {
          startY,
          head: recHeaders,
          body: recBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 }
        });
        startY = doc.lastAutoTable.finalY + 15;
        const totalRec = receipts.reduce((s, r) => s + parseNumber(r.amountofmoney), 0);
        doc.text(`جمع رسیدها: ${totalRec.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // 3. Other Income (NEW)
      startY = addSectionTitle(" گزارش عایدهای متفرقه", startY);
      if (otherIncomes.length === 0) {
        doc.text("هیچ عاید متفرقه‌ای یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const oiHeaders = [["#", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ ثبت"]];
        const oiBody = otherIncomes.map((inc, idx) => [
          idx + 1,
          inc.for,
          parseFloat(inc.amount).toLocaleString("eng-en"),
          inc.description || "-",
          moment(inc.createdAt).format("YYYY/MM/DD HH:mm")
        ]);
        autoTable(doc, {
          startY,
          head: oiHeaders,
          body: oiBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 }
        });
        startY = doc.lastAutoTable.finalY + 15;
        const totalOther = otherIncomes.reduce((s, inc) => s + parseNumber(inc.amount), 0);
        doc.text(`جمع عایدهای متفرقه: ${totalOther.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // 4. Expenses
      startY = addSectionTitle(" گزارش هزینه‌ها", startY);
      if (expenses.length === 0) {
        doc.text("هیچ هزینه‌ای یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const expHeaders = [["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"]];
        const expBody = expenses.map(e => [
          e.id,
          parseNumber(e.amount).toLocaleString(),
          e.purpose || "—",
          e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD")
        ]);
        autoTable(doc, {
          startY,
          head: expHeaders,
          body: expBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 }
        });
        startY = doc.lastAutoTable.finalY + 15;
        const totalExp = expenses.reduce((s, e) => s + parseNumber(e.amount), 0);
        doc.text(`جمع هزینه‌ها: ${totalExp.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // 5. Salaries
      startY = addSectionTitle(" گزارش حقوق و حاضری کارمندان", startY);
      if (salaries.length === 0) {
        doc.text("هیچ رکورد حاضری یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const salHeaders = [["تاریخ پرداخت", "مبلغ پرداختی", "مبلغ قابل پرداخت", "کارمند"]];
        const salBody = salaries.map(s => [
          moment(s.createdAt).format("YYYY/MM/DD"),
          parseNumber(s.receipt).toLocaleString(),
          parseNumber(s.total).toLocaleString(),
          s.Staff?.name || "نامشخص"
        ]);
        autoTable(doc, {
          startY,
          head: salHeaders,
          body: salBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 }
        });
        startY = doc.lastAutoTable.finalY + 15;
        const totalPaid = salaries.reduce((s, sal) => s + parseNumber(sal.receipt), 0);
        const totalToPay = salaries.reduce((s, sal) => s + parseNumber(sal.total), 0);
        doc.text(`جمع پرداختی حقوق: ${totalPaid.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 15;
        doc.text(`جمع قابل پرداخت: ${totalToPay.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // 6. Inventory
      startY = addSectionTitle(" گزارش موجودی کالاها بر اساس دسته‌بندی", startY);
      const { categories, totalStockValue } = categoryData;
      if (!categories.length) {
        doc.text("هیچ دسته‌بندی با کالای موجود یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
      } else {
        const catHeaders = [["دسته", "نوع", "تعداد کالا", "ارزش موجودی (دالر)"]];
        const catBody = categories.map(cat => [
          cat.name,
          cat.type?.name || "بدون نوع",
          cat.summary?.totalExistingIncomes || 0,
          (cat.summary?.totalStockValue || 0).toLocaleString()
        ]);
        autoTable(doc, {
          startY,
          head: catHeaders,
          body: catBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 }
        });
        startY = doc.lastAutoTable.finalY + 15;
        doc.text(`ارزش کل موجودی: ${totalStockValue.toLocaleString()} دالر`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
      }

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`${i}/${pageCount}`, pageWidth - 40, pageHeight - 30, { align: "right" });
      }

      doc.save(`combined_report_${moment().format("YYYY-MM-DD")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد گزارش جامع");
    } finally {
      setLoading(false);
    }
  };

  // Excel export
  const handleExcelDownload = async () => {
    if (!fromDate || !toDate) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }

    try {
      setLoading(true);
      const { payments, receipts, expenses, salaries, otherIncomes, categoryData } = await fetchAllData();
      const { categories, totalStockValue } = categoryData;

      const workbook = XLSX.utils.book_new();
      const dateRangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;
      const today = moment().format("YYYY/MM/DD");

      const addSheet = (name, headers, rows, extraInfo = []) => {
        const sheetData = [
          [`گزارش جامع - ${name}`],
          [`بازه: ${dateRangeStr}`],
          [`تاریخ تولید: ${today}`],
          [],
          headers,
          ...rows,
          ...extraInfo
        ];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
      };

      // 1. Payments
      const payRows = payments.map(p => [p.id, p.customer?.fullname || p.customerId, p.amountofmoney, p.description || "-", moment(p.createdAt).format("YYYY/MM/DD HH:mm")]);
      const payTotal = payments.reduce((s, p) => s + parseNumber(p.amountofmoney), 0);
      addSheet("پرداخت‌ها", ["ID", "مشتری", "مبلغ (؋)", "توضیحات", "تاریخ"], payRows, [["جمع کل", "", payTotal, "", ""]]);

      // 2. Receipts
      const recRows = receipts.map(r => [r.id, r.buyer?.fullname || r.buyerId, r.amountofmoney, r.description || "-", moment(r.createdAt).format("YYYY/MM/DD HH:mm")]);
      const recTotal = receipts.reduce((s, r) => s + parseNumber(r.amountofmoney), 0);
      addSheet("رسیدها", ["ID", "خریدار", "مبلغ (؋)", "توضیحات", "تاریخ"], recRows, [["جمع کل", "", recTotal, "", ""]]);

      // 3. Other Income (NEW)
      const oiRows = otherIncomes.map((inc, idx) => [idx + 1, inc.for, inc.amount, inc.description || "-", moment(inc.createdAt).format("YYYY/MM/DD HH:mm")]);
      const oiTotal = otherIncomes.reduce((s, inc) => s + parseNumber(inc.amount), 0);
      addSheet("عایدهای متفرقه", ["ردیف", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ ثبت"], oiRows, [["جمع کل", "", oiTotal, "", ""]]);

      // 4. Expenses
      const expRows = expenses.map(e => [e.id, e.amount, e.purpose || "-", e.by || "-", moment(e.createdAt).format("YYYY/MM/DD HH:mm")]);
      const expTotal = expenses.reduce((s, e) => s + parseNumber(e.amount), 0);
      addSheet("هزینه‌ها", ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"], expRows, [["جمع کل", expTotal, "", "", ""]]);

      // 5. Salaries
      const salRows = salaries.map(s => [
        s.Staff?.name || "نامشخص",
        parseNumber(s.salary || 0),
        parseNumber(s.overtime || 0),
        parseNumber(s.total || 0),
        parseNumber(s.receipt || 0),
        moment(s.createdAt).format("YYYY/MM/DD")
      ]);
      const totalSalary = salaries.reduce((s, sal) => s + parseNumber(sal.salary), 0);
      const totalOvertime = salaries.reduce((s, sal) => s + parseNumber(sal.overtime), 0);
      const totalPayable = salaries.reduce((s, sal) => s + parseNumber(sal.total), 0);
      const totalPaid = salaries.reduce((s, sal) => s + parseNumber(sal.receipt), 0);
      addSheet("حقوق و حاضری", ["کارمند", "معاش پایه", "اضافه‌کاری", "قابل پرداخت", "پرداخت شده", "تاریخ"], salRows, [
        ["جمع معاش پایه", totalSalary],
        ["جمع اضافه‌کاری", totalOvertime],
        ["جمع قابل پرداخت", totalPayable],
        ["جمع پرداخت شده", totalPaid]
      ]);

      // 6. Inventory
      const catRows = categories.map(cat => [
        cat.name,
        cat.type?.name || "بدون نوع",
        cat.summary?.totalExistingIncomes || 0,
        (cat.summary?.totalStockValue || 0).toLocaleString()
      ]);
      addSheet("موجودی کالا", ["دسته", "نوع", "تعداد کالا", "ارزش موجودی (دالر)"], catRows, [["ارزش کل موجودی", "", "", totalStockValue.toLocaleString()]]);

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `combined_report_${moment().format("YYYY-MM-DD")}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد فایل اکسل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium">از تاریخ</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">تا تاریخ</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>
      <div className="flex gap-4">
        <button
          onClick={handlePDFDownload}
          disabled={loading || !fromDate || !toDate}
          className="bg-cyan-800 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "در حال ساخت PDF..." : "دانلود گزارش جامع PDF"}
        </button>
        <button
          onClick={handleExcelDownload}
          disabled={loading || !fromDate || !toDate}
          className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "در حال ساخت Excel..." : "دانلود گزارش جامع Excel"}
        </button>
      </div>
    </div>
  );
};

export default CombinedReportsDownload;