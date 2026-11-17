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

  const PAGE_MARGIN_TOP = 40;
  const PAGE_MARGIN_BOTTOM = 40;
  const PAGE_MARGIN_LEFT_RIGHT = 30;

  const parseNumber = (val) => {
    if (val === undefined || val === null) return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  // Convert a single record to AFN using ITS OWN DV.
  const toAFN = (row, field = "amount") => {
    const amount = parseNumber(row?.[field]);
    const isUSD = row?.isAfn === false || row?.is_Afs === false;
    if (!isUSD) return amount;
    const dv = parseNumber(row?.DV);
    return dv > 0 ? amount * dv : amount;
  };

  // Normalize an "/unpaid" response → { rows, totalAFN, totalAFS, totalUSD, count }
  // Accepts either `{ data: [...], total: { afn, usd } }` or a raw array.
  const normalizeUnpaid = (raw) => {
    const list = Array.isArray(raw) ? raw : raw?.data || [];
    const totals = raw?.total || {};

    const rows = list
      .map((item) => {
        const name = item?.customer?.fullname || item?.buyer?.fullname || "—";
        const dueRaw = parseNumber(item?.total_due);
        const isUSD = item?.isAfn === false;
        const dv = parseNumber(item?.DV);

        // AFN equivalent: if USD, multiply by account's DV
        const dueAFN = isUSD ? (dv > 0 ? dueRaw * dv : dueRaw) : dueRaw;

        return {
          name,
          dueRaw,                              // original amount
          isAfn: !isUSD,
          DV: dv,
          dueAFN,                              // unified AFN-equivalent
          details: Array.isArray(item?.details) ? item.details : [],
        };
      })
      .filter((r) => r.dueRaw > 0);

    // Prefer server's `total` if present, else sum locally
    const totalAFS =
      totals.afn !== undefined
        ? parseNumber(totals.afn)
        : rows.filter((r) => r.isAfn).reduce((s, r) => s + r.dueRaw, 0);
    const totalUSD =
      totals.usd !== undefined
        ? parseNumber(totals.usd)
        : rows.filter((r) => !r.isAfn).reduce((s, r) => s + r.dueRaw, 0);
    const totalAFN = rows.reduce((s, r) => s + r.dueAFN, 0);

    return { rows, totalAFN, totalAFS, totalUSD, count: rows.length };
  };

  // ── Data fetching ─────────────────────────────────────────
  const fetchAllData = async () => {
    const params = new URLSearchParams();
    if (fromDate) params.append("startDate", fromDate);
    if (toDate) params.append("endDate", toDate);

    const expenseParams = new URLSearchParams();
    if (fromDate) expenseParams.append("from", fromDate);
    if (toDate) expenseParams.append("to", toDate);

    const [
      payments,
      receipts,
      expensesData,
      salaries,
      otherIncomes,
      categoryData,
      blanketStock,
      incomeBills,
      bills,
      customerUnpaidRes,
      buyerUnpaidRes,
    ] = await Promise.all([
      axios.get(`${BASE_URL}/pay/filter?${params.toString()}`).then((r) => r.data.data || []),
      axios.get(`${BASE_URL}/receipt/filter?${params.toString()}`).then((r) => r.data || []),
      axios.get(`${BASE_URL}/expense/date_range?${expenseParams.toString()}`).then((r) => r.data),
      axios
        .get(`${BASE_URL}/attendance/date-range?${expenseParams.toString()}`)
        .then((r) => r.data.data || []),
      axios
        .get(`${BASE_URL}/other-incomes/report?${params.toString()}`)
        .then((r) => r.data.data || []),
      axios.get(`${BASE_URL}/category/reports`).then((res) => {
        const apiData = res.data;
        if (apiData && typeof apiData === "object" && !Array.isArray(apiData)) {
          return {
            categories: apiData.categories || [],
            totalStockValue: apiData.totalStockValue || 0,
          };
        }
        if (Array.isArray(apiData)) {
          return {
            categories: apiData,
            totalStockValue: apiData.reduce(
              (s, c) => s + (c.summary?.totalStockValue || 0),
              0
            ),
          };
        }
        return { categories: [], totalStockValue: 0 };
      }),
      axios.get(`${BASE_URL}/bexist?limit=1000`).then((r) => r.data.data || []),
      axios
        .get(`${BASE_URL}/income-bill/date_range?${expenseParams.toString()}`)
        .then((r) => r.data?.bills || [])
        .catch(() => []),
      axios
        .get(`${BASE_URL}/bill/date_range?${expenseParams.toString()}`)
        .then((r) => r.data?.bills || r.data?.data || [])
        .catch(() => []),
      axios
        .get(`${BASE_URL}/customer-account/unpaid`)
        .then((r) => r.data)
        .catch(() => ({ data: [], total: { afn: 0, usd: 0 } })),
      axios
        .get(`${BASE_URL}/buyer-account/unpaid`)
        .then((r) => r.data)
        .catch(() => ({ data: [], total: { afn: 0, usd: 0 } })),
    ]);

    const calculatedExpenses = expensesData.calculated?.items || [];
    const nonCalculatedExpenses = expensesData.nonCalculated?.items || [];

    return {
      payments,
      receipts,
      calculatedExpenses,
      nonCalculatedExpenses,
      salaries,
      otherIncomes,
      categoryData,
      blanketStock,
      incomeBills,
      bills,
      customerUnpaid: customerUnpaidRes,
      buyerUnpaid: buyerUnpaidRes,
    };
  };

  // ── Section math ──────────────────────────────────────────
  const computeSections = (data) => {
    const {
      payments, receipts, nonCalculatedExpenses, otherIncomes,
      incomeBills, bills, categoryData, blanketStock, calculatedExpenses,
      customerUnpaid, buyerUnpaid,
    } = data;

    // رفت
    const totalPaysAFN = payments.reduce((s, p) => s + toAFN(p, "amountofmoney"), 0);
    const totalConsumption = nonCalculatedExpenses.reduce((s, e) => s + parseNumber(e.amount), 0);
    const totalIbAFN = incomeBills.reduce((s, b) => s + toAFN(b, "totalAmount"), 0);
    const outflowAFN = totalPaysAFN + totalConsumption + totalIbAFN;

    // آمد
    const totalReceipts = receipts.reduce((s, r) => s + toAFN(r, "amountofmoney"), 0);
    const totalOtherIncomes = otherIncomes.reduce((s, inc) => s + parseNumber(inc.amount), 0);
    const totalBillsAFN = bills.reduce(
      (s, b) => s + toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"),
      0
    );
    const inflowAFN = totalReceipts + totalOtherIncomes + totalBillsAFN;

    // سرمایه
    const totalStockAFN = (categoryData.categories || []).reduce((sum, cat) => {
      const usd = parseNumber(cat.summary?.totalStockValue);
      const dv = parseNumber(cat.summary?.DV ?? cat.DV);
      return sum + (dv > 0 ? usd * dv : usd);
    }, 0);
    const totalBlanketAFN = blanketStock.reduce((s, item) => s + parseNumber(item.totalValue), 0);
    const totalCalculated = calculatedExpenses.reduce((s, e) => s + parseNumber(e.amount), 0);
    const capitalAFN = totalStockAFN + totalBlanketAFN + totalCalculated;

    const balance = inflowAFN - outflowAFN;

    // Outstanding (informational, not in balance)
    const customersOwe = normalizeUnpaid(customerUnpaid);
    const weOweSellers = normalizeUnpaid(buyerUnpaid);

    return {
      outflow: {
        pays: { items: payments, totalAFN: totalPaysAFN },
        consumption: { items: nonCalculatedExpenses, total: totalConsumption },
        incomeBills: { items: incomeBills, totalAFN: totalIbAFN },
        totalAFN: outflowAFN,
      },
      inflow: {
        receipts: { items: receipts, total: totalReceipts },
        otherIncomes: { items: otherIncomes, total: totalOtherIncomes },
        bills: { items: bills, totalAFN: totalBillsAFN },
        totalAFN: inflowAFN,
      },
      capital: {
        stockAFN: totalStockAFN,
        blanketAFN: totalBlanketAFN,
        fixedAssets: { items: calculatedExpenses, total: totalCalculated },
        totalAFN: capitalAFN,
      },
      outstanding: { customersOwe, weOweSellers },
      balance,
    };
  };

  // ── PDF helpers ───────────────────────────────────────────
  const ensureSpace = (doc, y, lines = 1, lh = 16) => {
    const h = doc.internal.pageSize.getHeight();
    if (y + lines * lh + 10 > h - PAGE_MARGIN_BOTTOM) {
      doc.addPage();
      return PAGE_MARGIN_TOP;
    }
    return y;
  };
  const startNewPage = (doc) => {
    doc.addPage();
    return PAGE_MARGIN_TOP;
  };

  // ── PDF ───────────────────────────────────────────────────
  const handlePDFDownload = async () => {
    if (!fromDate || !toDate) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }
    try {
      setLoading(true);
      const data = await fetchAllData();
      const S = computeSections(data);

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setR2L(false);
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      const today = moment().format("YYYY/MM/DD");
      const rangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;
      const pageWidth = doc.internal.pageSize.getWidth();

      const title = (t, y) => {
        y = ensureSpace(doc, y, 1, 20);
        doc.setFontSize(14); doc.setTextColor(30, 30, 30);
        doc.text(t, pageWidth - 40, y, { align: "right" });
        return y + 22;
      };
      const sub = (t, y) => {
        y = ensureSpace(doc, y, 1, 16);
        doc.setFontSize(11); doc.setTextColor(60, 60, 60);
        doc.text(t, pageWidth - 40, y, { align: "right" });
        return y + 16;
      };
      const line = (label, val, y, color = [40, 40, 40], size = 11) => {
        y = ensureSpace(doc, y, 1, 16);
        doc.setFontSize(size); doc.setTextColor(...color);
        doc.text(`${label}: ${val}`, pageWidth - 40, y, { align: "right" });
        doc.setTextColor(40, 40, 40);
        return y + 16;
      };

      // Cover
      doc.setFontSize(16);
      doc.text(`گزارش جامع (${rangeStr})`, pageWidth - 40, 40, { align: "right" });
      doc.setFontSize(10);
      doc.text(`تاریخ تولید: ${today}`, pageWidth - 40, 62, { align: "right" });
      doc.text("تبدیل هر رکورد بر اساس نرخ DV خودش", pageWidth - 40, 76, { align: "right" });

      let y = 96;

      // ───────── رفت ─────────
      y = title("بخش اول: رفت خروجی‌ها , کسر می‌شود", y);

      // مصرف
      y = sub("هزینه‌های مصرف", y);
      if (!S.outflow.consumption.items.length) {
        doc.setFontSize(10); doc.text("هیچ هزینه مصرفی یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"]],
          body: S.outflow.consumption.items.map((e) => [
            e.id, parseNumber(e.amount).toLocaleString(), e.purpose || "—",
            e.by || "نامشخص", moment(e.createdAt).format("YYYY/MM/DD"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [200, 160, 40], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع مصرف", `${S.outflow.consumption.total.toLocaleString()} ؋`, y, [160, 60, 60]);
      }

      // بل درآمدی
      y = ensureSpace(doc, y, 1, 18);
      y = sub("بل‌های درآمدی", y);
      if (!S.outflow.incomeBills.items.length) {
        doc.setFontSize(10); doc.text("هیچ بل درآمدی یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["شماره بل", "مشتری", "وضعیت", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"]],
          body: S.outflow.incomeBills.items.map((b) => [
            b.billNumber || b.id,
            b.customer?.fullname || "—",
            b.status === "paid" ? "پرداخت شده" : b.status === "partial" ? "جزئی" : "پرداخت نشده",
            parseNumber(b.totalAmount).toLocaleString(),
            b.isAfn === true ? "؋" : "$",
            parseNumber(b.DV).toLocaleString() || "—",
            toAFN(b, "totalAmount").toLocaleString(),
            moment(b.createdAt).format("YYYY/MM/DD"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 8, halign: "center", valign: "middle" },
          headStyles: { fillColor: [160, 60, 60], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع بل‌های درآمدی معادل افغانی", `${S.outflow.incomeBills.totalAFN.toLocaleString()} ؋`, y, [160, 60, 60]);
      }

      // پرداخت‌ها
      y = ensureSpace(doc, y, 1, 18);
      y = sub("پرداخت‌ها به فروشندگان", y);
      if (!S.outflow.pays.items.length) {
        doc.setFontSize(10); doc.text("هیچ پرداختی یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["ID", "فروشنده", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"]],
          body: S.outflow.pays.items.map((p) => [
            p.id,
            p.customer?.fullname || `فروشنده ${p.customerId}`,
            parseNumber(p.amountofmoney).toLocaleString(),
            p.isAfn !== false && p.is_Afs !== false ? "؋" : "$",
            parseNumber(p.DV).toLocaleString() || "—",
            toAFN(p, "amountofmoney").toLocaleString(),
            moment(p.createdAt).format("YYYY/MM/DD"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [160, 60, 60], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع پرداخت‌ها معادل افغانی", `${S.outflow.pays.totalAFN.toLocaleString()} ؋`, y, [160, 60, 60]);
      }

      // Section 1 total
      y = ensureSpace(doc, y, 2, 18);
      doc.setDrawColor(160, 60, 60); doc.setLineWidth(1);
      doc.line(PAGE_MARGIN_LEFT_RIGHT, y, pageWidth - PAGE_MARGIN_LEFT_RIGHT, y);
      y += 16;
      y = line("جمع کل رفت کسر می‌شود", `${S.outflow.totalAFN.toLocaleString()} ؋`, y, [160, 40, 40], 13);
      doc.setDrawColor(0, 0, 0);

      // ───────── آمد ─────────
      y = startNewPage(doc);
      y = title("بخش دوم: آمد ورودی‌ها , اضافه می‌شود", y);

      y = sub("رسیدهای خریداران", y);
      if (!S.inflow.receipts.items.length) {
        doc.setFontSize(10); doc.text("هیچ رسیدی یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["ID", "خریدار", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"]],
          body: S.inflow.receipts.items.map((r) => [
            r.id,
            r.buyer?.fullname || `خریدار ${r.buyerId}`,
            parseNumber(r.amountofmoney).toLocaleString(),
            r.isAfn === false ? "$" : "؋",
            parseNumber(r.DV).toLocaleString() || "—",
            toAFN(r, "amountofmoney").toLocaleString(),
            moment(r.createdAt).format("YYYY/MM/DD"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [40, 120, 60], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع رسیدها معادل افغانی", `${S.inflow.receipts.total.toLocaleString()} ؋`, y, [40, 120, 60]);
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("عایدهای متفرقه", y);
      if (!S.inflow.otherIncomes.items.length) {
        doc.setFontSize(10); doc.text("هیچ عاید متفرقه‌ای یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["#", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ ثبت"]],
          body: S.inflow.otherIncomes.items.map((inc, idx) => [
            idx + 1, inc.for, parseNumber(inc.amount).toLocaleString(),
            inc.description || "-", moment(inc.createdAt).format("YYYY/MM/DD HH:mm"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [40, 120, 60], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع عایدهای متفرقه", `${S.inflow.otherIncomes.total.toLocaleString()} ؋`, y, [40, 120, 60]);
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("بل‌ها", y);
      if (!S.inflow.bills.items.length) {
        doc.setFontSize(10); doc.text("هیچ بل یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["ID", "مشتری", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"]],
          body: S.inflow.bills.items.map((b) => [
            b.id,
            b.customer?.fullname || b.customerName || "—",
            parseNumber(b.amount ?? b.totalAmount).toLocaleString(),
            b.isAfn === false ? "$" : "؋",
            parseNumber(b.DV).toLocaleString() || "—",
            toAFN(b, b.amount !== undefined ? "amount" : "totalAmount").toLocaleString(),
            moment(b.createdAt).format("YYYY/MM/DD"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 8, halign: "center", valign: "middle" },
          headStyles: { fillColor: [40, 120, 60], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع بل‌ها معادل افغانی", `${S.inflow.bills.totalAFN.toLocaleString()} ؋`, y, [40, 120, 60]);
      }

      y = ensureSpace(doc, y, 2, 18);
      doc.setDrawColor(40, 120, 60); doc.setLineWidth(1);
      doc.line(PAGE_MARGIN_LEFT_RIGHT, y, pageWidth - PAGE_MARGIN_LEFT_RIGHT, y);
      y += 16;
      y = line("جمع کل آمد اضافه می‌شود", `${S.inflow.totalAFN.toLocaleString()} ؋`, y, [30, 100, 50], 13);
      doc.setDrawColor(0, 0, 0);

      // ───────── سرمایه ─────────
      y = startNewPage(doc);
      y = title("بخش سوم: سرمایه بدون تأثیر بر مانده", y);
      doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text("این بخش اطلاعاتی است و در محاسبه مانده لحاظ نمی‌شود.", pageWidth - 40, y, { align: "right" });
      doc.setTextColor(40, 40, 40);
      y += 22;

      y = sub("موجودی کالاها", y);
      if (!data.categoryData.categories.length) {
        doc.setFontSize(10); doc.text("هیچ دسته‌بندی با کالای موجود یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["دسته", "نوع", "تعداد کالا", "ارزش موجودی ($)", "DV", "معادل (؋)"]],
          body: data.categoryData.categories.map((cat) => {
            const usd = parseNumber(cat.summary?.totalStockValue);
            const dv = parseNumber(cat.summary?.DV ?? cat.DV);
            return [
              cat.name, cat.type?.name || "بدون نوع",
              cat.summary?.totalExistingIncomes || 0,
              usd.toLocaleString(),
              dv > 0 ? dv.toLocaleString() : "—",
              (dv > 0 ? usd * dv : usd).toLocaleString(),
            ];
          }),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [80, 80, 140], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع موجودی کالا معادل افغانی", `${S.capital.stockAFN.toLocaleString()} ؋`, y, [80, 80, 140]);
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("موجودی کمپل (بلنکت)", y);
      if (!data.blanketStock.length) {
        doc.setFontSize(10); doc.text("هیچ موجودی کمپل یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["دسته", "تعداد", "قیمت واحد (؋)", "ارزش کل (؋)"]],
          body: data.blanketStock.map((item) => [
            item.category?.name || `دسته ${item.categoryId}`,
            item.quantity,
            parseNumber(item.unitPrice).toLocaleString(),
            parseNumber(item.totalValue).toLocaleString(),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [80, 80, 140], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع موجودی کمپل", `${S.capital.blanketAFN.toLocaleString()} ؋`, y, [80, 80, 140]);
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("هزینه‌های دارایی ثابت (سرمایه‌ای)", y);
      if (!S.capital.fixedAssets.items.length) {
        doc.setFontSize(10); doc.text("هیچ هزینه دارایی ثابت یافت نشد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"]],
          body: S.capital.fixedAssets.items.map((e) => [
            e.id, parseNumber(e.amount).toLocaleString(), e.purpose || "—",
            e.by || "نامشخص", moment(e.createdAt).format("YYYY/MM/DD"),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [80, 80, 140], textColor: 255, fontStyle: "normal" },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;
        y = line("جمع دارایی ثابت", `${S.capital.fixedAssets.total.toLocaleString()} ؋`, y, [80, 80, 140]);
      }

      y = ensureSpace(doc, y, 2, 18);
      doc.setDrawColor(80, 80, 140); doc.setLineWidth(1);
      doc.line(PAGE_MARGIN_LEFT_RIGHT, y, pageWidth - PAGE_MARGIN_LEFT_RIGHT, y);
      y += 16;
      y = line("جمع سرمایه اطلاعاتی", `${S.capital.totalAFN.toLocaleString()} ؋`, y, [80, 80, 140], 13);
      doc.setDrawColor(0, 0, 0);

      // ───────── مانده ─────────
      y = startNewPage(doc);
      y = title("نتیجه: محاسبه مانده", y);

      const rows = [
        ["آمد (ورودی‌ها)", `+ ${S.inflow.totalAFN.toLocaleString()} ؋`],
        ["رفت (خروجی‌ها)", `− ${S.outflow.totalAFN.toLocaleString()} ؋`],
        ["سرمایه (بدون تأثیر)", `${S.capital.totalAFN.toLocaleString()} ؋`],
      ];
      for (const [label, val] of rows) {
        y = line(label, val, y);
        y += 2;
      }

      y = ensureSpace(doc, y, 1, 24);
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
      doc.line(pageWidth - 260, y - 6, pageWidth - 40, y - 6);
      y += 12;

      doc.setFontSize(14);
      doc.setTextColor(...(S.balance >= 0 ? [0, 120, 0] : [180, 0, 0]));
      doc.text(
        `مانده نهایی: ${S.balance.toLocaleString()} ؋ (${S.balance >= 0 ? "مثبت" : "منفی"})`,
        pageWidth - 40, y, { align: "right" }
      );
      doc.setTextColor(0, 0, 0);

      // ───────── وضعیت مطالبات و بدهی‌ها (اطلاعاتی) ─────────
      y = startNewPage(doc);
      y = title("وضعیت حساب‌ها (اطلاعاتی — خارج از مانده)", y);
      doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text(
        "این بخش خلاصه وضعیت طلب و بدهی است و در محاسبه مانده لحاظ نمی‌شود.",
        pageWidth - 40, y, { align: "right" }
      );
      doc.setTextColor(40, 40, 40);
      y += 22;

      // طلب از مشتریان
      y = sub("طلب از مشتریان (بدهی مشتریان به ما)", y);
      if (!S.outstanding.customersOwe.rows.length) {
        doc.setFontSize(10);
        doc.text("هیچ مشتری بدهکاری وجود ندارد.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["#", "مشتری", "مبلغ بدهی", "واحد", "DV", "معادل (؋)"]],
          body: S.outstanding.customersOwe.rows.map((r, i) => [
            i + 1,
            r.name,
            r.dueRaw.toLocaleString(),
            r.isAfn ? "؋" : "$",
            r.DV > 0 ? r.DV.toLocaleString() : "—",
            r.dueAFN.toLocaleString(),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [120, 100, 40], textColor: 255, fontStyle: "normal" },
          columnStyles: { 2: { halign: "right" }, 5: { halign: "right" } },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;

        const c = S.outstanding.customersOwe;
        y = line(
          `جمع طلب از مشتریان (${c.count} مورد)`,
          `${c.totalAFN.toLocaleString()} ؋ ` +
            `(؋${c.totalAFS.toLocaleString()} + $${c.totalUSD.toLocaleString()})`,
          y,
          [120, 100, 40],
          12
        );
      }

      // بدهی به فروشندگان
      y = ensureSpace(doc, y, 1, 18);
      y = sub("بدهی به فروشندگان (بدهی ما به فروشندگان)", y);
      if (!S.outstanding.weOweSellers.rows.length) {
        doc.setFontSize(10);
        doc.text("هیچ فروشنده‌ای طلبکار نیست.", pageWidth - 40, y, { align: "right" });
        y += 20;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["#", "فروشنده", "مبلغ بدهی", "واحد", "DV", "معادل (؋)"]],
          body: S.outstanding.weOweSellers.rows.map((r, i) => [
            i + 1,
            r.name,
            r.dueRaw.toLocaleString(),
            r.isAfn ? "؋" : "$",
            r.DV > 0 ? r.DV.toLocaleString() : "—",
            r.dueAFN.toLocaleString(),
          ]),
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 9, halign: "center", valign: "middle" },
          headStyles: { fillColor: [100, 40, 120], textColor: 255, fontStyle: "normal" },
          columnStyles: { 2: { halign: "right" }, 5: { halign: "right" } },
          margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
        });
        y = doc.lastAutoTable.finalY + 10;

        const w = S.outstanding.weOweSellers;
        y = line(
          `جمع بدهی به فروشندگان (${w.count} مورد)`,
          `${w.totalAFN.toLocaleString()} ؋ ` +
            `(؋${w.totalAFS.toLocaleString()} + $${w.totalUSD.toLocaleString()})`,
          y,
          [100, 40, 120],
          12
        );
      }

      // خلاصه خالص
      y = ensureSpace(doc, y, 3, 18);
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
      doc.line(pageWidth - 320, y, pageWidth - 40, y);
      y += 14;

      const netOutstanding =
        S.outstanding.customersOwe.totalAFN - S.outstanding.weOweSellers.totalAFN;
      y = line(
        "خالص وضعیت (طلب ما − بدهی ما)",
        `${netOutstanding.toLocaleString()} ؋  (${netOutstanding >= 0 ? "به نفع ما" : "به ضرر ما"})`,
        y,
        netOutstanding >= 0 ? [0, 120, 0] : [180, 0, 0],
        12
      );

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
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

  // ── Excel ─────────────────────────────────────────────────
  const handleExcelDownload = async () => {
    if (!fromDate || !toDate) {
      alert("لطفاً بازه زمانی را انتخاب کنید");
      return;
    }
    try {
      setLoading(true);
      const data = await fetchAllData();
      const S = computeSections(data);

      const wb = XLSX.utils.book_new();
      const rangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;
      const today = moment().format("YYYY/MM/DD");

      const addSheet = (name, headers, rows, extra = []) => {
        const sheet = XLSX.utils.aoa_to_sheet([
          [`گزارش جامع — ${name}`],
          [`بازه: ${rangeStr}`],
          [`تاریخ تولید: ${today}`],
          [],
          headers,
          ...rows,
          ...extra,
        ]);
        sheet["!dir"] = "rtl";
        XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
      };

      // 1. رفت - مصرف
      addSheet(
        "رفت - مصرف",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        S.outflow.consumption.items.map((e) => [
          e.id, parseNumber(e.amount), e.purpose || "—", e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع", "", S.outflow.consumption.total, "", ""]]
      );

      // 2. رفت - بل درآمدی
      addSheet(
        "رفت - بل درآمدی",
        ["شماره بل", "مشتری", "وضعیت", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"],
        S.outflow.incomeBills.items.map((b) => [
          b.billNumber || b.id,
          b.customer?.fullname || "—",
          b.status,
          parseNumber(b.totalAmount),
          b.isAfn === true ? "AFN" : "USD",
          parseNumber(b.DV),
          toAFN(b, "totalAmount"),
          moment(b.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع معادل افغانی", "", "", "", "", "", S.outflow.incomeBills.totalAFN, ""]]
      );

      // 3. رفت - پرداخت‌ها
      addSheet(
        "رفت - پرداخت‌ها",
        ["ID", "فروشنده", "مبلغ", "واحد", "DV", "معادل (؋)", "توضیحات", "تاریخ"],
        S.outflow.pays.items.map((p) => [
          p.id,
          p.customer?.fullname || p.customerId,
          parseNumber(p.amountofmoney),
          p.isAfn !== false && p.is_Afs !== false ? "AFN" : "USD",
          parseNumber(p.DV),
          toAFN(p, "amountofmoney"),
          p.description || "-",
          moment(p.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع معادل افغانی", "", "", "", "", S.outflow.pays.totalAFN, "", ""]]
      );

      // 4. آمد - رسیدها
      addSheet(
        "آمد - رسیدها",
        ["ID", "خریدار", "مبلغ", "واحد", "DV", "معادل (؋)", "توضیحات", "تاریخ"],
        S.inflow.receipts.items.map((r) => [
          r.id,
          r.buyer?.fullname || r.buyerId,
          parseNumber(r.amountofmoney),
          r.isAfn === false ? "USD" : "AFN",
          parseNumber(r.DV),
          toAFN(r, "amountofmoney"),
          r.description || "-",
          moment(r.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع معادل افغانی", "", "", "", "", S.inflow.receipts.total, "", ""]]
      );

      // 5. آمد - عاید متفرقه
      addSheet(
        "آمد - عاید متفرقه",
        ["ردیف", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ"],
        S.inflow.otherIncomes.items.map((inc, i) => [
          i + 1, inc.for, parseNumber(inc.amount), inc.description || "-",
          moment(inc.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع", "", S.inflow.otherIncomes.total, "", ""]]
      );

      // 6. آمد - بل‌ها
      addSheet(
        "آمد - بل‌ها",
        ["ID", "مشتری", "مبلغ", "واحد", "DV", "معادل (؋)", "توضیحات", "تاریخ"],
        S.inflow.bills.items.map((b) => [
          b.id,
          b.customer?.fullname || b.customerName || "—",
          parseNumber(b.amount ?? b.totalAmount),
          b.isAfn === false ? "USD" : "AFN",
          parseNumber(b.DV),
          toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"),
          b.description || b.purpose || "-",
          moment(b.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع معادل افغانی", "", "", "", "", S.inflow.bills.totalAFN, "", ""]]
      );

      // 7. سرمایه - موجودی کالا
      addSheet(
        "سرمایه - موجودی کالا",
        ["دسته", "نوع", "تعداد کالا", "ارزش موجودی ($)", "DV", "معادل (؋)"],
        data.categoryData.categories.map((cat) => {
          const usd = parseNumber(cat.summary?.totalStockValue);
          const dv = parseNumber(cat.summary?.DV ?? cat.DV);
          return [cat.name, cat.type?.name || "بدون نوع", cat.summary?.totalExistingIncomes || 0,
            usd, dv || "", dv > 0 ? usd * dv : usd];
        }),
        [["جمع معادل افغانی", "", "", "", "", S.capital.stockAFN]]
      );

      // 8. سرمایه - موجودی کمپل
      addSheet(
        "سرمایه - موجودی کمپل",
        ["دسته", "تعداد", "قیمت واحد (؋)", "ارزش کل (؋)"],
        data.blanketStock.map((item) => [
          item.category?.name || `دسته ${item.categoryId}`,
          item.quantity,
          parseNumber(item.unitPrice),
          parseNumber(item.totalValue),
        ]),
        [["جمع", "", "", S.capital.blanketAFN]]
      );

      // 9. سرمایه - دارایی ثابت
      addSheet(
        "سرمایه - دارایی ثابت",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        S.capital.fixedAssets.items.map((e) => [
          e.id, parseNumber(e.amount), e.purpose || "—", e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        [["جمع", S.capital.fixedAssets.total, "", "", ""]]
      );

      // 10. وضعیت - طلب از مشتریان
      addSheet(
        "وضعیت - طلب از مشتریان",
        ["#", "مشتری", "مبلغ بدهی", "واحد", "DV", "معادل (؋)"],
        S.outstanding.customersOwe.rows.map((r, i) => [
          i + 1, r.name, r.dueRaw, r.isAfn ? "AFN" : "USD",
          r.DV || "", r.dueAFN,
        ]),
        [
          [
            `جمع (${S.outstanding.customersOwe.count} مورد)`,
            "",
            `؋${S.outstanding.customersOwe.totalAFS.toLocaleString()} + $${S.outstanding.customersOwe.totalUSD.toLocaleString()}`,
            "",
            "",
            S.outstanding.customersOwe.totalAFN,
          ],
        ]
      );

      // 11. وضعیت - بدهی به فروشندگان
      addSheet(
        "وضعیت - بدهی به فروشندگان",
        ["#", "فروشنده", "مبلغ بدهی", "واحد", "DV", "معادل (؋)"],
        S.outstanding.weOweSellers.rows.map((r, i) => [
          i + 1, r.name, r.dueRaw, r.isAfn ? "AFN" : "USD",
          r.DV || "", r.dueAFN,
        ]),
        [
          [
            `جمع (${S.outstanding.weOweSellers.count} مورد)`,
            "",
            `؋${S.outstanding.weOweSellers.totalAFS.toLocaleString()} + $${S.outstanding.weOweSellers.totalUSD.toLocaleString()}`,
            "",
            "",
            S.outstanding.weOweSellers.totalAFN,
          ],
        ]
      );

      // 12. خلاصه
      const summary = XLSX.utils.aoa_to_sheet([
        [`خلاصه و مانده (${rangeStr})`],
        [`تاریخ تولید: ${today}`],
        [],
        ["بخش", "زیربخش", "مبلغ (؋)"],
        ["آمد", "رسیدها", S.inflow.receipts.total],
        ["آمد", "عایدهای متفرقه", S.inflow.otherIncomes.total],
        ["آمد", "بل‌ها", S.inflow.bills.totalAFN],
        ["جمع آمد", "", S.inflow.totalAFN],
        [],
        ["رفت", "مصرف", S.outflow.consumption.total],
        ["رفت", "بل درآمدی", S.outflow.incomeBills.totalAFN],
        ["رفت", "پرداخت‌ها", S.outflow.pays.totalAFN],
        ["جمع رفت", "", S.outflow.totalAFN],
        [],
        ["سرمایه (بدون تأثیر)", "موجودی کالا معادل افغانی", S.capital.stockAFN],
        ["سرمایه (بدون تأثیر)", "موجودی کمپل", S.capital.blanketAFN],
        ["سرمایه (بدون تأثیر)", "دارایی ثابت", S.capital.fixedAssets.total],
        ["جمع سرمایه", "", S.capital.totalAFN],
        [],
        ["مانده نهایی", "", S.balance],
        [],
        ["— وضعیت حساب‌ها (اطلاعاتی) —", "", ""],
        [
          "طلب از مشتریان",
          `${S.outstanding.customersOwe.count} مورد`,
          S.outstanding.customersOwe.totalAFN,
        ],
        [
          "بدهی به فروشندگان",
          `${S.outstanding.weOweSellers.count} مورد`,
          S.outstanding.weOweSellers.totalAFN,
        ],
        [
          "خالص وضعیت",
          "",
          S.outstanding.customersOwe.totalAFN - S.outstanding.weOweSellers.totalAFN,
        ],
      ]);
      summary["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, summary, "خلاصه");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }), `combined_report_${moment().format("YYYY-MM-DD")}.xlsx`);
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
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">تا تاریخ</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-3 py-2" />
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={handlePDFDownload} disabled={loading || !fromDate || !toDate}
          className="bg-cyan-800 text-white px-4 py-2 rounded disabled:opacity-50">
          {loading ? "در حال ساخت PDF..." : "دانلود گزارش جامع PDF"}
        </button>
        <button onClick={handleExcelDownload} disabled={loading || !fromDate || !toDate}
          className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50">
          {loading ? "در حال ساخت Excel..." : "دانلود گزارش جامع Excel"}
        </button>
      </div>
    </div>
  );
};

export default CombinedReportsDownload;