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

const CombinedReportsDownload = () => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(75);

  const PAGE_MARGIN_TOP = 40;
  const PAGE_MARGIN_BOTTOM = 40;
  const PAGE_MARGIN_LEFT_RIGHT = 30;

  const fetchExchangeRate = async (date) => {
    try {
      const res = await axios.get(`${BASE_URL}/exchange-rate`, { params: { date } });
      if (res.data && res.data.rate) {
        setExchangeRate(parseFloat(res.data.rate));
      }
    } catch (error) {
      console.warn("نرخ ارز دریافت نشد، از مقدار پیش‌فرض استفاده می‌شود:", exchangeRate);
    }
  };

  useEffect(() => {
    if (fromDate) fetchExchangeRate(fromDate);
  }, [fromDate]);

  const parseNumber = (val) => {
    if (val === undefined || val === null) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const fetchAllData = async () => {
    const params = new URLSearchParams();
    if (fromDate) params.append("startDate", fromDate);
    if (toDate) params.append("endDate", toDate);
    const expenseParams = new URLSearchParams();
    if (fromDate) expenseParams.append("from", fromDate);
    if (toDate) expenseParams.append("to", toDate);

    const paymentsPromise = axios.get(`${BASE_URL}/pay/filter?${params.toString()}`).then(res => res.data.data || []);
    const receiptsPromise = axios.get(`${BASE_URL}/receipt/filter?${params.toString()}`).then(res => res.data || []);
    // ─── Expenses API with split ──────────────────────────────────
    const expensesPromise = axios.get(`${BASE_URL}/expense/date_range?${expenseParams.toString()}`).then(res => res.data);
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
    const bexistPromise = axios.get(`${BASE_URL}/bexist?limit=1000`).then(res => res.data.data || []);

    const [payments, receipts, expensesData, salaries, otherIncomes, categoryData, blanketStock] = await Promise.all([
      paymentsPromise, receiptsPromise, expensesPromise, salariesPromise, otherIncomePromise, categoryPromise, bexistPromise
    ]);

    // ─── Extract expense groups ──────────────────────────────────────
    const calculatedExpenses = expensesData.calculated?.items || [];
    const nonCalculatedExpenses = expensesData.nonCalculated?.items || [];
    const totalCalculated = expensesData.calculated?.total || 0;
    const totalNonCalculated = expensesData.nonCalculated?.total || 0;
    const totalExpensesAll = expensesData.totalAmount || 0;

    return {
      payments,
      receipts,
      expenses: expensesData.expenses || [], // fallback
      calculatedExpenses,
      nonCalculatedExpenses,
      totalCalculated,
      totalNonCalculated,
      totalExpensesAll,
      salaries,
      otherIncomes,
      categoryData,
      blanketStock,
    };
  };

  const ensureSpace = (doc, startY, lines = 1, lineHeight = 16) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const neededSpace = lines * lineHeight + 10;
    if (startY + neededSpace > pageHeight - PAGE_MARGIN_BOTTOM) {
      doc.addPage();
      return PAGE_MARGIN_TOP;
    }
    return startY;
  };

  // ─── PDF ──────────────────────────────────────────────────────────────
  const handlePDFDownload = async () => {
    if (!fromDate || !toDate) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }

    try {
      setLoading(true);
      const {
        payments,
        receipts,
        calculatedExpenses,
        nonCalculatedExpenses,
        totalCalculated,
        totalNonCalculated,
        totalExpensesAll,
        salaries,
        otherIncomes,
        categoryData,
        blanketStock,
      } = await fetchAllData();

      // ─── Payments split ──────────────────────────────────────────────
      const paymentsAFS = payments.filter(p => p.is_Afs === true);
      const paymentsUSD = payments.filter(p => p.is_Afs === false);
      const totalPaymentsAFS = paymentsAFS.reduce((s, p) => s + parseNumber(p.amountofmoney), 0);
      const totalPaymentsUSD = paymentsUSD.reduce((s, p) => s + parseNumber(p.amountofmoney), 0);
      const totalPaymentsAFNCombined = totalPaymentsAFS + totalPaymentsUSD * exchangeRate;

      // ─── Other totals ──────────────────────────────────────────────────
      const totalReceipts = receipts.reduce((s, r) => s + parseNumber(r.amountofmoney), 0);
      const totalOtherIncomes = otherIncomes.reduce((s, inc) => s + parseNumber(inc.amount), 0);
      const totalStockUSD = categoryData.totalStockValue || 0;

      const totalBlanketAFN = blanketStock.reduce((sum, item) => sum + parseNumber(item.totalValue), 0);
      const totalStockAFN = totalStockUSD * exchangeRate + totalBlanketAFN;
      const balance = totalReceipts + totalOtherIncomes + totalStockAFN + totalCalculated - totalNonCalculated - totalPaymentsAFNCombined;

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setR2L(false);
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const today = moment().format("YYYY/MM/DD");
      const dateRangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;

      doc.setFontSize(14);
      doc.text(`گزارش جامع (${dateRangeStr})`, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });
      doc.setFontSize(10);
      doc.text(`تاریخ تولید: ${today}`, doc.internal.pageSize.getWidth() - 40, 60, { align: "right" });
      doc.text(`نرخ تبدیل (۱$ = ${exchangeRate} ؋)`, doc.internal.pageSize.getWidth() - 40, 75, { align: "right" });

      let startY = 95;

      const addSectionTitle = (title, y) => {
        y = ensureSpace(doc, y, 1, 20);
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(title, doc.internal.pageSize.getWidth() - 40, y, { align: "right" });
        return y + 20;
      };

      // ─── 1. Payments ──────────────────────────────────────────────────
      startY = addSectionTitle(" گزارش پرداخت‌ها به فروشندگان", startY);
      if (payments.length === 0) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ پرداختی یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const payHeaders = [["ID", "فروشنده", "مبلغ", "واحد پول", "توضیحات", "تاریخ"]];
        const payBody = payments.map((p) => {
          const isAfs = p.is_Afs !== undefined ? p.is_Afs : true;
          const currency = isAfs ? "افغانی" : "دلار";
          return [
            p.id,
            p.customer?.fullname || `فروشنده ${p.customerId}`,
            p.amountofmoney,
            currency,
            p.description || "-",
            moment(p.createdAt).format("YYYY/MM/DD"),
          ];
        });
        autoTable(doc, {
          startY,
          head: payHeaders,
          body: payBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 3);
        doc.setFontSize(11);
        doc.text(`جمع پرداخت‌ها به افغانی: ${totalPaymentsAFS.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 15;
        doc.text(
          `جمع پرداخت‌ها به دلار: $${totalPaymentsUSD.toLocaleString()} (≈ ${(totalPaymentsUSD * exchangeRate).toLocaleString()} ؋)`,
          doc.internal.pageSize.getWidth() - 40,
          startY,
          { align: "right" }
        );
        startY += 15;
        doc.text(`جمع کل پرداخت‌ها (به افغانی): ${totalPaymentsAFNCombined.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 2. Receipts ──────────────────────────────────────────────────
      startY = addSectionTitle(" گزارش رسیدهای خریداران (افغانی)", startY);
      if (receipts.length === 0) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ رسیدی یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const recHeaders = [["ID", "خریدار", "مبلغ (؋)", "توضیحات", "تاریخ"]];
        const recBody = receipts.map((r) => [
          r.id,
          r.buyer?.fullname || `خریدار ${r.buyerId}`,
          r.amountofmoney,
          r.description || "-",
          moment(r.createdAt).format("YYYY/MM/DD"),
        ]);
        autoTable(doc, {
          startY,
          head: recHeaders,
          body: recBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 1);
        doc.text(`جمع رسیدها: ${totalReceipts.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 3. Other Income ─────────────────────────────────────────────
      startY = addSectionTitle(" گزارش عایدهای متفرقه (افغانی)", startY);
      if (otherIncomes.length === 0) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ عاید متفرقه‌ای یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const oiHeaders = [["#", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ ثبت"]];
        const oiBody = otherIncomes.map((inc, idx) => [
          idx + 1,
          inc.for,
          parseFloat(inc.amount).toLocaleString("eng-en"),
          inc.description || "-",
          moment(inc.createdAt).format("YYYY/MM/DD HH:mm"),
        ]);
        autoTable(doc, {
          startY,
          head: oiHeaders,
          body: oiBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 1);
        doc.text(`جمع عایدهای متفرقه: ${totalOtherIncomes.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 4. Expenses – Calculated ──────────────────────────────────────
      startY = addSectionTitle(" هزینه‌های محاسبه شده (افغانی)", startY);
      if (calculatedExpenses.length === 0) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ هزینه محاسبه شده‌ای یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const expHeaders = [["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"]];
        const expBody = calculatedExpenses.map((e) => [
          e.id,
          parseNumber(e.amount).toLocaleString(),
          e.purpose || "—",
          e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD"),
        ]);
        autoTable(doc, {
          startY,
          head: expHeaders,
          body: expBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [40, 160, 90], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 1);
        doc.text(`جمع هزینه‌های محاسبه شده: ${totalCalculated.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 5. Expenses – Non-Calculated ──────────────────────────────────
      startY = addSectionTitle(" هزینه‌های محاسبه نشده (افغانی)", startY);
      if (nonCalculatedExpenses.length === 0) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ هزینه محاسبه نشده‌ای یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const expHeaders = [["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"]];
        const expBody = nonCalculatedExpenses.map((e) => [
          e.id,
          parseNumber(e.amount).toLocaleString(),
          e.purpose || "—",
          e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD"),
        ]);
        autoTable(doc, {
          startY,
          head: expHeaders,
          body: expBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [200, 160, 40], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 1);
        doc.text(`جمع هزینه‌های محاسبه نشده: ${totalNonCalculated.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 6. Salaries ──────────────────────────────────────────────────
      startY = addSectionTitle(" گزارش حقوق و حاضری کارمندان", startY);
      if (salaries.length === 0) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ رکورد حاضری یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const salHeaders = [["تاریخ پرداخت", "مبلغ پرداختی", "مبلغ قابل پرداخت", "کارمند"]];
        const salBody = salaries.map((s) => [
          moment(s.createdAt).format("YYYY/MM/DD"),
          parseNumber(s.receipt).toLocaleString(),
          parseNumber(s.total).toLocaleString(),
          s.Staff?.name || "نامشخص",
        ]);
        autoTable(doc, {
          startY,
          head: salHeaders,
          body: salBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        const totalPaid = salaries.reduce((s, sal) => s + parseNumber(sal.receipt), 0);
        const totalToPay = salaries.reduce((s, sal) => s + parseNumber(sal.total), 0);
        startY = ensureSpace(doc, startY, 2);
        doc.text(`جمع پرداختی حقوق: ${totalPaid.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 15;
        doc.text(`جمع قابل پرداخت: ${totalToPay.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 7. Inventory (Carpet) ──────────────────────────────────────
      startY = addSectionTitle(" گزارش موجودی کالاها (دلار)", startY);
      const { categories } = categoryData;
      if (!categories.length) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ دسته‌بندی با کالای موجود یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const catHeaders = [["دسته", "نوع", "تعداد کالا", "ارزش موجودی ($)"]];
        const catBody = categories.map((cat) => [
          cat.name,
          cat.type?.name || "بدون نوع",
          cat.summary?.totalExistingIncomes || 0,
          (cat.summary?.totalStockValue || 0).toLocaleString(),
        ]);
        autoTable(doc, {
          startY,
          head: catHeaders,
          body: catBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 1);
        doc.text(
          `ارزش کل موجودی کالاها: $${totalStockUSD.toLocaleString()} (≈ ${(totalStockUSD * exchangeRate).toLocaleString()} ؋)`,
          doc.internal.pageSize.getWidth() - 40,
          startY,
          { align: "right" }
        );
        startY += 20;
      }

      // ─── 8. Blanket Stock ─────────────────────────────────────────────
      startY = addSectionTitle(" گزارش موجودی کمپل (بلنکت) (افغانی)", startY);
      if (!blanketStock.length) {
        startY = ensureSpace(doc, startY, 1);
        doc.text("هیچ موجودی کمپل یافت نشد.", doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      } else {
        const bHeaders = [["دسته", "تعداد", "قیمت واحد (؋)", "ارزش کل (؋)"]];
        const bBody = blanketStock.map((item) => [
          item.category?.name || `دسته ${item.categoryId}`,
          item.quantity,
          item.unitPrice,
          parseNumber(item.totalValue).toLocaleString(),
        ]);
        autoTable(doc, {
          startY,
          head: bHeaders,
          body: bBody,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        startY = doc.lastAutoTable.finalY + 15;
        startY = ensureSpace(doc, startY, 1);
        doc.text(`ارزش کل موجودی کمپل: ${totalBlanketAFN.toLocaleString()} ؋`, doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 20;
      }

      // ─── 9. Summary ──────────────────────────────────────────────────
      startY = addSectionTitle(" خلاصه و محاسبه بیلانس به افغانی", startY);
      const summaryLines = [
        `رسیدهای خریداران: ${totalReceipts.toLocaleString()} ؋`,
        `عایدهای متفرقه: ${totalOtherIncomes.toLocaleString()} ؋`,
        `ارزش موجودی کالاها به افغانی: ${(totalStockUSD * exchangeRate).toLocaleString()} ؋`,
        `ارزش موجودی کمپل: ${totalBlanketAFN.toLocaleString()} ؋`,
        `هزینه‌های محاسبه شده (مثبت): ${totalCalculated.toLocaleString()} ؋`,
        `هزینه‌های محاسبه نشده (منفی): ${totalNonCalculated.toLocaleString()} ؋`,
        `خالص هزینه‌ها (محاسبه شده - محاسبه نشده): ${(totalCalculated - totalNonCalculated).toLocaleString()} ؋`,
        `پرداخت‌ها به افغانی: ${totalPaymentsAFS.toLocaleString()} ؋`,
        `پرداخت‌ها به دلار (تبدیل): ${(totalPaymentsUSD * exchangeRate).toLocaleString()} ؋`,
        `جمع کل پرداخت‌ها: ${totalPaymentsAFNCombined.toLocaleString()} ؋`,
        `مانده (تعادل): ${balance.toLocaleString()} ؋`,
      ];
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      for (let i = 0; i < summaryLines.length; i++) {
        startY = ensureSpace(doc, startY, 1);
        if (i === summaryLines.length - 1) {
          doc.setFontSize(13);
          doc.setTextColor(0, 100, 0);
        } else {
          doc.setFontSize(11);
          doc.setTextColor(40, 40, 40);
        }
        doc.text(summaryLines[i], doc.internal.pageSize.getWidth() - 40, startY, { align: "right" });
        startY += 15;
      }
      doc.setTextColor(40, 40, 40);

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

  // ─── EXCEL ──────────────────────────────────────────────────────────────
  const handleExcelDownload = async () => {
    if (!fromDate || !toDate) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }

    try {
      setLoading(true);
      const {
        payments,
        receipts,
        calculatedExpenses,
        nonCalculatedExpenses,
        totalCalculated,
        totalNonCalculated,
        totalExpensesAll,
        salaries,
        otherIncomes,
        categoryData,
        blanketStock,
      } = await fetchAllData();
      const { categories, totalStockValue } = categoryData;

      const paymentsAFS = payments.filter((p) => p.is_Afs === true);
      const paymentsUSD = payments.filter((p) => p.is_Afs === false);
      const totalPaymentsAFS = paymentsAFS.reduce((s, p) => s + parseNumber(p.amountofmoney), 0);
      const totalPaymentsUSD = paymentsUSD.reduce((s, p) => s + parseNumber(p.amountofmoney), 0);
      const totalPaymentsAFNCombined = totalPaymentsAFS + totalPaymentsUSD * exchangeRate;

      const totalReceipts = receipts.reduce((s, r) => s + parseNumber(r.amountofmoney), 0);
      const totalOtherIncomes = otherIncomes.reduce((s, inc) => s + parseNumber(inc.amount), 0);
      const totalStockUSD = totalStockValue || 0;
      const totalBlanketAFN = blanketStock.reduce((sum, item) => sum + parseNumber(item.totalValue), 0);
      const totalStockAFN = totalStockUSD * exchangeRate + totalBlanketAFN;
      const balance = totalReceipts + totalOtherIncomes + totalStockAFN + totalCalculated - totalNonCalculated - totalPaymentsAFNCombined;

      const workbook = XLSX.utils.book_new();
      const dateRangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;
      const today = moment().format("YYYY/MM/DD");

      const addSheet = (name, headers, rows, extraInfo = []) => {
        const sheetData = [
          [`گزارش جامع - ${name}`],
          [`بازه: ${dateRangeStr}`],
          [`تاریخ تولید: ${today}`],
          [`نرخ تبدیل: ۱$ = ${exchangeRate} ؋`],
          [],
          headers,
          ...rows,
          ...extraInfo,
        ];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
      };

      // ─── 1. Payments ──────────────────────────────────────────────────
      const payRows = payments.map((p) => {
        const isAfs = p.is_Afs !== undefined ? p.is_Afs : true;
        const currency = isAfs ? "افغانی" : "دلار";
        return [
          p.id,
          p.customer?.fullname || p.customerId,
          p.amountofmoney,
          currency,
          p.description || "-",
          moment(p.createdAt).format("YYYY/MM/DD HH:mm"),
        ];
      });
      addSheet(
        "پرداخت‌ها",
        ["ID", "فروشنده", "مبلغ", "واحد پول", "توضیحات", "تاریخ"],
        payRows,
        [
          ["جمع پرداخت‌های افغانی", "", totalPaymentsAFS, "؋", "", ""],
          ["جمع پرداخت‌های دلار", "", totalPaymentsUSD, "$", "", ""],
          ["جمع کل به افغانی (با نرخ)", "", totalPaymentsAFNCombined, "؋", "", ""],
        ]
      );

      // ─── 2. Receipts ──────────────────────────────────────────────────
      const recRows = receipts.map((r) => [
        r.id,
        r.buyer?.fullname || r.buyerId,
        r.amountofmoney,
        r.description || "-",
        moment(r.createdAt).format("YYYY/MM/DD HH:mm"),
      ]);
      addSheet("رسیدها (افغانی)", ["ID", "خریدار", "مبلغ (؋)", "توضیحات", "تاریخ"], recRows, [
        ["جمع کل", "", totalReceipts, "", ""],
      ]);

      // ─── 3. Other Income ─────────────────────────────────────────────
      const oiRows = otherIncomes.map((inc, idx) => [
        idx + 1,
        inc.for,
        inc.amount,
        inc.description || "-",
        moment(inc.createdAt).format("YYYY/MM/DD HH:mm"),
      ]);
      addSheet(
        "عایدهای متفرقه (افغانی)",
        ["ردیف", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ ثبت"],
        oiRows,
        [["جمع کل", "", totalOtherIncomes, "", ""]]
      );

      // ─── 4. Expenses – Calculated ────────────────────────────────────
      const calcRows = calculatedExpenses.map((e) => [
        e.id,
        e.amount,
        e.purpose || "-",
        e.by || "-",
        moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
      ]);
      addSheet(
        "هزینه‌های محاسبه شده",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        calcRows,
        [["جمع کل", totalCalculated, "", "", ""]]
      );

      // ─── 5. Expenses – Non‑Calculated ──────────────────────────────
      const nonCalcRows = nonCalculatedExpenses.map((e) => [
        e.id,
        e.amount,
        e.purpose || "-",
        e.by || "-",
        moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
      ]);
      addSheet(
        "هزینه‌های محاسبه نشده",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        nonCalcRows,
        [["جمع کل", totalNonCalculated, "", "", ""]]
      );

      // ─── 6. Salaries ──────────────────────────────────────────────────
      const salRows = salaries.map((s) => [
        s.Staff?.name || "نامشخص",
        parseNumber(s.salary || 0),
        parseNumber(s.overtime || 0),
        parseNumber(s.total || 0),
        parseNumber(s.receipt || 0),
        moment(s.createdAt).format("YYYY/MM/DD"),
      ]);
      const totalSalary = salaries.reduce((s, sal) => s + parseNumber(sal.salary), 0);
      const totalOvertime = salaries.reduce((s, sal) => s + parseNumber(sal.overtime), 0);
      const totalPayable = salaries.reduce((s, sal) => s + parseNumber(sal.total), 0);
      const totalPaid = salaries.reduce((s, sal) => s + parseNumber(sal.receipt), 0);
      addSheet(
        "حقوق و حاضری",
        ["کارمند", "معاش پایه", "اضافه‌کاری", "قابل پرداخت", "پرداخت شده", "تاریخ"],
        salRows,
        [
          ["جمع معاش پایه", totalSalary],
          ["جمع اضافه‌کاری", totalOvertime],
          ["جمع قابل پرداخت", totalPayable],
          ["جمع پرداخت شده", totalPaid],
        ]
      );

      // ─── 7. Carpet Inventory ──────────────────────────────────────────
      const catRows = categories.map((cat) => [
        cat.name,
        cat.type?.name || "بدون نوع",
        cat.summary?.totalExistingIncomes || 0,
        (cat.summary?.totalStockValue || 0).toLocaleString(),
      ]);
      addSheet(
        "موجودی کالا (دلار)",
        ["دسته", "نوع", "تعداد کالا", "ارزش موجودی ($)"],
        catRows,
        [
          ["ارزش کل موجودی کالا", "", "", totalStockUSD.toLocaleString()],
          ["معادل به افغانی", "", "", (totalStockUSD * exchangeRate).toLocaleString()],
        ]
      );

      // ─── 8. Blanket Inventory ──────────────────────────────────────────
      const blanketRows = blanketStock.map((item) => [
        item.category?.name || `دسته ${item.categoryId}`,
        item.quantity,
        item.unitPrice,
        parseNumber(item.totalValue).toLocaleString(),
      ]);
      addSheet(
        "موجودی کمپل (افغانی)",
        ["دسته", "تعداد", "قیمت واحد (؋)", "ارزش کل (؋)"],
        blanketRows,
        [["ارزش کل موجودی کمپل", "", "", totalBlanketAFN.toLocaleString()]]
      );

      // ─── 9. Summary ──────────────────────────────────────────────────
      const summaryData = [
        ["عنوان", "ارز", "مبلغ اصلی", "مبلغ به افغانی (با نرخ)"],
        ["رسیدهای خریداران", "؋", totalReceipts, totalReceipts],
        ["عایدهای متفرقه", "؋", totalOtherIncomes, totalOtherIncomes],
        ["ارزش موجودی کالاها", "$", totalStockUSD, (totalStockUSD * exchangeRate).toLocaleString()],
        ["ارزش موجودی کمپل", "؋", totalBlanketAFN, totalBlanketAFN],
        ["هزینه‌های محاسبه شده", "؋", totalCalculated, totalCalculated],
        ["هزینه‌های محاسبه نشده", "؋", totalNonCalculated, totalNonCalculated],
        ["جمع کل هزینه‌ها", "؋", totalExpensesAll, totalExpensesAll],
        ["پرداخت‌ها به افغانی", "؋", totalPaymentsAFS, totalPaymentsAFS],
        ["پرداخت‌ها به دلار (تبدیل)", "$", totalPaymentsUSD, (totalPaymentsUSD * exchangeRate).toLocaleString()],
        ["جمع کل پرداخت‌ها", "؋", "", totalPaymentsAFNCombined],
        ["مانده (تعادل)", "؋", "", balance],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet([
        [`خلاصه و مانده (${dateRangeStr})`],
        [`تاریخ تولید: ${today}`],
        [`نرخ تبدیل: ۱$ = ${exchangeRate} ؋`],
        [],
        ...summaryData,
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "خلاصه");

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
        <div>
          <label className="block text-sm font-medium">نرخ تبدیل (۱$ = ? ؋)</label>
          <input
            type="number"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
            className="border rounded px-3 py-2 w-24"
            step="0.01"
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