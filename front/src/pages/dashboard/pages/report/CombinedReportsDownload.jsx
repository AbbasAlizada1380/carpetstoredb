// components/report/CombinedReportsDownload.jsx
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

  const toAFN = (row, field = "amount") => {
    const amount = parseNumber(row?.[field]);
    const isUSD = row?.isAfn === false || row?.is_Afs === false;
    if (!isUSD) return amount;
    const dv = parseNumber(row?.DV);
    return dv > 0 ? amount * dv : amount;
  };

  const normalizeUnpaid = (raw) => {
    const list = Array.isArray(raw) ? raw : raw?.data || [];
    const totals = raw?.total || {};

    const rows = list
      .map((item) => {
        const name = item?.customer?.fullname || item?.buyer?.fullname || "—";
        const dueRaw = parseNumber(item?.total_due);
        const isUSD = item?.isAfn === false;
        const dv = parseNumber(item?.DV);
        const dueAFN = isUSD ? (dv > 0 ? dueRaw * dv : dueRaw) : dueRaw;
        return {
          name,
          dueRaw,
          isAfn: !isUSD,
          DV: dv,
          dueAFN,
          details: Array.isArray(item?.details) ? item.details : [],
        };
      })
      .filter((r) => r.dueRaw > 0);

    const totalAFS = parseNumber(totals.afn);
    const totalUSD = parseNumber(totals.usd);
    const totalAFN =
      totalAFS + rows.filter((r) => !r.isAfn).reduce((s, r) => s + r.dueAFN, 0);

    return { rows, totalAFN, totalAFS, totalUSD, count: rows.length };
  };

  const buildIncomeBillRows = (items, statusLabel) => {
    let totalRemainingAFN = 0;
    let totalReceivedAFN = 0;

    const rows = items.map((b) => {
      const totalAFN = toAFN(b, "totalAmount");
      const paidRaw = parseNumber(b.paidAmount);
      const remainingRaw = parseNumber(b.remainingAmount);
      const isUSD = b.isAfn === false;
      const dv = parseNumber(b.DV);

      const remainingAFN = isUSD ? (dv > 0 ? remainingRaw * dv : remainingRaw) : remainingRaw;
      const paidAFN = isUSD ? (dv > 0 ? paidRaw * dv : paidRaw) : paidRaw;

      totalRemainingAFN += remainingAFN;
      totalReceivedAFN += paidAFN;

      const incomesArr = Array.isArray(b.Incomes) ? b.Incomes : [];
      const bIncomeArr = Array.isArray(b.bIncome) ? b.bIncome : [];
      let receiptLabel = "—";

      if (incomesArr.length > 0) {
        const receivedSum = incomesArr.reduce(
          (s, inc) => s + parseNumber(inc.amount ?? inc.amountofmoney),
          0
        );
        receiptLabel = `${receivedSum.toLocaleString()} (${incomesArr.length} رسید)`;
      } else if (bIncomeArr.length > 0) {
        receiptLabel = `${paidRaw.toLocaleString()} (${bIncomeArr.length} رسید)`;
      } else if (paidRaw > 0) {
        receiptLabel = `${paidRaw.toLocaleString()} (پرداخت شده)`;
      }

      return { b, totalAFN, remainingRaw, remainingAFN, dv, receiptLabel, statusLabel: statusLabel(b) };
    });

    return { rows, totalRemainingAFN, totalReceivedAFN };
  };

  const normalizeOtherIncomes = (raw) => {
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];
    const summaryTotal = parseNumber(raw?.summary?.totalAmount);
    const computedTotal = list.reduce((s, inc) => s + parseNumber(inc.amount), 0);
    const total = raw?.summary?.totalAmount !== undefined ? summaryTotal : computedTotal;
    return { items: list, total, count: list.length };
  };

  // ── Valets (deposit / withdraw) ─────────────────────────────────────
  // Response shape:
  // { valets: [], pagination: {...}, totals: { count, totalDeposit, totalWithdraw, net } }
  const normalizeValets = (raw) => {
    const t = raw?.totals || {};
    return {
      items: Array.isArray(raw?.valets) ? raw.valets : [],
      count: parseNumber(t.count),
      totalDeposit: parseNumber(t.totalDeposit),
      totalWithdraw: parseNumber(t.totalWithdraw),
      net: parseNumber(t.net),
    };
  };

  const fetchAllData = async () => {
    const params = new URLSearchParams();
    if (fromDate) params.append("startDate", fromDate);
    if (toDate) params.append("endDate", toDate);

    const expenseParams = new URLSearchParams();
    if (fromDate) expenseParams.append("from", fromDate);
    if (toDate) expenseParams.append("to", toDate);

    const [
      payments, receipts, expensesData, salaries, otherIncomesRaw,
      categoryData, blanketStock, incomeBills, bills,
      customerUnpaidRes, buyerUnpaidRes, valetsRaw,
    ] = await Promise.all([
      axios.get(`${BASE_URL}/pay/filter?${params.toString()}`).then((r) => r.data.data || []),
      axios.get(`${BASE_URL}/receipt/filter?${params.toString()}`).then((r) => r.data || []),
      axios.get(`${BASE_URL}/expense/date_range?${expenseParams.toString()}`).then((r) => r.data),
      axios.get(`${BASE_URL}/attendance/date-range?${expenseParams.toString()}`).then((r) => r.data.data || []),
      axios.get(`${BASE_URL}/other-incomes/report?${params.toString()}`).then((r) => r.data),
      axios.get(`${BASE_URL}/category/reports`).then((res) => {
        const apiData = res.data;
        if (apiData && typeof apiData === "object" && !Array.isArray(apiData)) {
          return { categories: apiData.categories || [], totalStockValue: apiData.totalStockValue || 0 };
        }
        if (Array.isArray(apiData)) {
          return {
            categories: apiData,
            totalStockValue: apiData.reduce((s, c) => s + (c.summary?.totalStockValue || 0), 0),
          };
        }
        return { categories: [], totalStockValue: 0 };
      }),
      axios.get(`${BASE_URL}/bexist?limit=1000`).then((r) => r.data.data || []),
      axios.get(`${BASE_URL}/incomebill/date_range?${expenseParams.toString()}`).then((r) => r.data?.bills || []).catch(() => []),
      axios.get(`${BASE_URL}/bill/date-range?${expenseParams.toString()}`).then((r) => r.data?.bills || r.data?.data || []).catch(() => []),
      axios.get(`${BASE_URL}/customeraccount/unpaid`).then((r) => r.data).catch(() => ({ data: [], total: { afn: 0, usd: 0 } })),
      axios.get(`${BASE_URL}/buyeraccount/unpaid`).then((r) => r.data).catch(() => ({ data: [], total: { afn: 0, usd: 0 } })),
      axios.get(`${BASE_URL}/valets?page=1&limit=10000`).then((r) => r.data).catch(() => ({ valets: [], totals: {} })),
    ]);

    const calculatedExpenses = expensesData.calculated?.items || [];
    const nonCalculatedExpenses = expensesData.nonCalculated?.items || [];
    const otherIncomes = normalizeOtherIncomes(otherIncomesRaw);
    const valets = normalizeValets(valetsRaw);

    return {
      payments, receipts, calculatedExpenses, nonCalculatedExpenses, salaries, otherIncomes,
      categoryData, blanketStock, incomeBills, bills,
      customerUnpaid: customerUnpaidRes, buyerUnpaid: buyerUnpaidRes,
      valets,
    };
  };

  const computeSections = (data) => {
    const {
      payments, receipts, nonCalculatedExpenses, otherIncomes,
      incomeBills, bills, categoryData, blanketStock, calculatedExpenses,
      customerUnpaid, buyerUnpaid,
    } = data;

    const totalPaysAFN = payments.reduce((s, p) => s + toAFN(p, "amountofmoney"), 0);
    const totalConsumption = nonCalculatedExpenses.reduce((s, e) => s + parseNumber(e.amount), 0);
    const totalIbAFN_display = incomeBills.reduce((s, b) => s + toAFN(b, "totalAmount"), 0);
    const outflowAFN = totalPaysAFN + totalConsumption;

    const totalReceipts = receipts.reduce((s, r) => s + toAFN(r, "amountofmoney"), 0);
    const totalOtherIncomes = otherIncomes.total;
    const totalBillsAFN_display = bills.reduce(
      (s, b) => s + toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"), 0
    );
    const inflowAFN = totalReceipts + totalOtherIncomes;

    const totalStockAFN = (categoryData.categories || []).reduce((sum, cat) => {
      const usd = parseNumber(cat.summary?.totalStockValue);
      const dv = parseNumber(cat.summary?.DV ?? cat.DV);
      return sum + (dv > 0 ? usd * dv : usd);
    }, 0);
    const totalBlanketAFN = blanketStock.reduce((s, item) => s + parseNumber(item.totalValue), 0);
    const totalCalculated = calculatedExpenses.reduce((s, e) => s + parseNumber(e.amount), 0);
    const capitalAFN = totalStockAFN + totalBlanketAFN + totalCalculated;

    const balance = inflowAFN - outflowAFN;

    const customersOwe = normalizeUnpaid(customerUnpaid);
    const weOweSellers = normalizeUnpaid(buyerUnpaid);

    return {
      outflow: {
        pays: { items: payments, totalAFN: totalPaysAFN },
        consumption: { items: nonCalculatedExpenses, total: totalConsumption },
        incomeBills: { items: incomeBills, totalAFN_display: totalIbAFN_display, count: incomeBills.length },
        totalAFN: outflowAFN,
      },
      inflow: {
        receipts: { items: receipts, total: totalReceipts },
        otherIncomes,
        bills: { items: bills, totalAFN_display: totalBillsAFN_display, count: bills.length },
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

  // ── Profit Calculation Helper ──────────────────────────────────────
  const computeProfit = (data, S) => {
    // 1. Total of Sales Bills
    const billsTotalAFN = data.bills.reduce(
      (s, b) => s + toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"), 0
    );

    // 2. Total of Buying Bills
    const incomeBillsTotalAFN = data.incomeBills.reduce(
      (s, b) => s + toAFN(b, "totalAmount"), 0
    );

    const totalCapital = S.capital.totalAFN;

    // ارزش فروش = جمع بل‌های خرید - جمع بخش سرمایه
    const valueOfSales = incomeBillsTotalAFN - totalCapital;

    // مفاد ناخالص فروش = جمع بل‌های فروش - ارزش فروش
    const grossProfitOfSales = billsTotalAFN - valueOfSales;

    // مفاد ناخالص = مفاد ناخالص فروش + عاید متفرقه
    const otherIncomesTotalAFN = S.inflow.otherIncomes.total;
    const grossProfit = grossProfitOfSales + otherIncomesTotalAFN;

    // مفاد خالص = مفاد ناخالص - هزینه‌های مصرف
    const consumptionTotalAFN = S.outflow.consumption.total;
    const netProfit = grossProfit - consumptionTotalAFN;

    return {
      billsTotalAFN,
      incomeBillsTotalAFN,
      totalCapital,
      valueOfSales,
      grossProfitOfSales,
      otherIncomesTotalAFN,
      grossProfit,
      consumptionTotalAFN,
      netProfit,
    };
  };

  // ── رفته و آمده (Cash in hand) ─────────────────────────────────────
  // آمده  = عایدهای متفرقه + رسیدهای خریداران + totalDeposit (valets)
  // رفته  = هزینه‌های مصرف + هزینه‌های دارایی ثابت + پرداخت‌ها به فروشندگان + totalWithdraw (valets)
  // موجودی نقد (پولی که باید موجود باشد) = آمده − رفته
  const computeCashFlow = (data, S) => {
    const v = data.valets;

    const outRows = [
      { label: "هزینه‌های مصرف", amount: S.outflow.consumption.total },
      { label: "هزینه‌های دارایی ثابت", amount: S.capital.fixedAssets.total },
      { label: "پرداخت‌ها به فروشندگان", amount: S.outflow.pays.totalAFN },
      { label: "برداشت (ولت)", amount: v.totalWithdraw },
    ];
    const inRows = [
      { label: "عایدهای متفرقه", amount: S.inflow.otherIncomes.total },
      { label: "رسیدهای خریداران", amount: S.inflow.receipts.total },
      { label: "تحویلی / واریز (ولت)", amount: v.totalDeposit },
    ];

    const totalOut = outRows.reduce((s, r) => s + r.amount, 0);
    const totalIn = inRows.reduce((s, r) => s + r.amount, 0);
    const cashBalance = totalIn - totalOut;

    // side-by-side rows: [رفته, مبلغ, آمده, مبلغ]
    const len = Math.max(outRows.length, inRows.length);
    const pairedRows = Array.from({ length: len }, (_, i) => [
      outRows[i]?.label ?? "",
      outRows[i] ? outRows[i].amount : "",
      inRows[i]?.label ?? "",
      inRows[i] ? inRows[i].amount : "",
    ]);

    return { outRows, inRows, totalOut, totalIn, cashBalance, pairedRows };
  };

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

  const rtlTable = (doc, y, {
    head, body, totals, headColor, totalsColor = [40, 40, 40], totalsFill = [240, 240, 240],
    fontSize = 9, columnStyles = {}, totalsStyles = {}, didParseCell, styles = {}, headStyles = {},
  }) => {
    const n = head.length;
    const toReadingIdx = (i) => n - 1 - i;
    const rev = (row) => [...row].reverse();

    const cs = {};
    Object.entries(columnStyles).forEach(([k, v]) => { cs[toReadingIdx(Number(k))] = v; });

    autoTable(doc, {
      startY: y,
      head: [rev(head)],
      body: body.map(rev),
      foot: totals ? [rev(totals)] : undefined,
      showFoot: "lastPage",
      theme: "grid",
      styles: { font: "Vazirmatn", fontSize, halign: "center", valign: "middle", ...styles },
      headStyles: { fillColor: headColor, textColor: 255, fontStyle: "normal", ...headStyles },
      footStyles: { fillColor: totalsFill, textColor: totalsColor, fontStyle: "bold", lineWidth: 0.5 },
      columnStyles: cs,
      margin: { left: PAGE_MARGIN_LEFT_RIGHT, right: PAGE_MARGIN_LEFT_RIGHT, bottom: PAGE_MARGIN_BOTTOM },
      didParseCell: (data) => {
        const col = toReadingIdx(data.column.index);
        if (data.section === "foot" && totalsStyles[col]) {
          Object.assign(data.cell.styles, totalsStyles[col]);
        }
        if (didParseCell) didParseCell(data, col);
      },
    });
    return doc.lastAutoTable.finalY + 14;
  };

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
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "bold");
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
      const empty = (t, y) => {
        doc.setFontSize(10); doc.setTextColor(40, 40, 40);
        doc.text(t, pageWidth - 40, y, { align: "right" });
        return y + 20;
      };

      // Cover
      doc.setFontSize(16);
      doc.text(`گزارش جامع (${rangeStr})`, pageWidth - 40, 40, { align: "right" });
      doc.setFontSize(10);
      doc.text(`تاریخ تولید: ${today}`, pageWidth - 40, 62, { align: "right" });

      let y = 96;

      // ═══ رفت ═══
      y = title("بخش اول: رفت خروجی‌ها", y);
      y = sub("هزینه‌های مصرف", y);
      if (!S.outflow.consumption.items.length) {
        y = empty("هیچ هزینه مصرفی یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
          body: S.outflow.consumption.items.map((e) => [
            e.id, parseNumber(e.amount).toLocaleString(), e.purpose || "—",
            e.by || "نامشخص", moment(e.createdAt).format("YYYY/MM/DD"),
          ]),
          totals: ["جمع", `${S.outflow.consumption.total.toLocaleString()} ؋`, "", "", ""],
          headColor: [200, 160, 40],
          totalsColor: [160, 60, 60],
          totalsFill: [250, 240, 215],
        });
      }

      y = ensureSpace(doc, y, 2, 18);
      y = sub("بل‌های خرید", y);
      if (!S.outflow.incomeBills.items.length) {
        y = empty("هیچ بل ورودی یافت نشد.", y);
      } else {
        const ib = buildIncomeBillRows(S.outflow.incomeBills.items, (b) =>
          b.status === "paid" ? "پرداخت شده" : b.status === "partial" ? "جزئی" : "پرداخت نشده"
        );
        y = rtlTable(doc, y, {
          head: [
            "شماره بل", "مشتری", "وضعیت", "مبلغ کل", "باقیمانده",
            "واحد", "DV", "معادل کل (؋)", "معادل باقیمانده (؋)",
            "پرداختی (رسیدها)", "تاریخ",
          ],
          body: ib.rows.map((r) => [
            r.b.billNumber || r.b.id,
            r.b.customer?.fullname || "—",
            r.statusLabel,
            parseNumber(r.b.totalAmount).toLocaleString(),
            r.remainingRaw.toLocaleString(),
            r.b.isAfn === true ? "؋" : "$",
            r.dv.toLocaleString() || "—",
            r.totalAFN.toLocaleString(),
            r.remainingAFN.toLocaleString(),
            r.receiptLabel,
            moment(r.b.createdAt).format("YYYY/MM/DD"),
          ]),
          totals: [
            "جمع", "", "", "", "", "", "",
            S.outflow.incomeBills.totalAFN_display.toLocaleString(),
            ib.totalRemainingAFN.toLocaleString(),
            ib.totalReceivedAFN.toLocaleString(),
            "",
          ],
          headColor: [170, 120, 90],
          headStyles: { fontSize: 7.5 },
          fontSize: 7.5,
          styles: { cellPadding: 2 },
          columnStyles: {
            3: { halign: "right" }, 4: { halign: "right" },
            7: { halign: "right" }, 8: { halign: "right" },
            9: { halign: "right", fontSize: 7 },
          },
          totalsColor: [90, 60, 20],
          totalsFill: [250, 235, 215],
          totalsStyles: {
            7: { textColor: [120, 80, 30] },
            8: { textColor: [180, 80, 0] },
            9: { textColor: [40, 120, 60] },
          },
        });
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("پرداخت‌ها به فروشندگان", y);
      if (!S.outflow.pays.items.length) {
        y = empty("هیچ پرداختی یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["ID", "فروشنده", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"],
          body: S.outflow.pays.items.map((p) => [
            p.id,
            p.customer?.fullname || `فروشنده ${p.customerId}`,
            parseNumber(p.amountofmoney).toLocaleString(),
            p.isAfn !== false && p.is_Afs !== false ? "؋" : "$",
            parseNumber(p.DV).toLocaleString() || "—",
            toAFN(p, "amountofmoney").toLocaleString(),
            moment(p.createdAt).format("YYYY/MM/DD"),
          ]),
          totals: ["جمع", "", "", "", "", `${S.outflow.pays.totalAFN.toLocaleString()} ؋`, ""],
          headColor: [160, 60, 60],
          totalsColor: [160, 60, 60],
          totalsFill: [248, 228, 228],
        });
      }

      // ═══ آمد ═══
      y = startNewPage(doc);
      y = title("بخش دوم: آمد ورودی‌ها", y);
      y = sub("رسیدهای خریداران", y);
      if (!S.inflow.receipts.items.length) {
        y = empty("هیچ رسیدی یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["ID", "خریدار", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"],
          body: S.inflow.receipts.items.map((r) => [
            r.id,
            r.buyer?.fullname || `خریدار ${r.buyerId}`,
            parseNumber(r.amountofmoney).toLocaleString(),
            r.isAfn === false ? "$" : "؋",
            parseNumber(r.DV).toLocaleString() || "—",
            toAFN(r, "amountofmoney").toLocaleString(),
            moment(r.createdAt).format("YYYY/MM/DD"),
          ]),
          totals: ["جمع", "", "", "", "", `${S.inflow.receipts.total.toLocaleString()} ؋`, ""],
          headColor: [40, 120, 60],
          totalsColor: [40, 120, 60],
          totalsFill: [225, 242, 228],
        });
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("عایدهای متفرقه", y);
      if (!S.inflow.otherIncomes.items.length) {
        y = empty("هیچ عاید متفرقه‌ای یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["#", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ ثبت"],
          body: S.inflow.otherIncomes.items.map((inc, idx) => [
            idx + 1,
            inc.for || "—",
            parseNumber(inc.amount).toLocaleString(),
            inc.description || "-",
            moment(inc.createdAt).format("YYYY/MM/DD HH:mm"),
          ]),
          totals: ["جمع", "", `${S.inflow.otherIncomes.total.toLocaleString()} ؋`, "", ""],
          headColor: [40, 120, 60],
          totalsColor: [40, 120, 60],
          totalsFill: [225, 242, 228],
        });
      }

      y = ensureSpace(doc, y, 2, 18);
      y = sub("بل‌های فروش", y);
      if (!S.inflow.bills.items.length) {
        y = empty("هیچ بل یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["ID", "مشتری", "مبلغ", "واحد", "DV", "معادل (؋)", "تاریخ"],
          body: S.inflow.bills.items.map((b) => [
            b.id,
            b.buyer?.fullname || b.customerName || "—",
            parseNumber(b.amount ?? b.totalAmount).toLocaleString(),
            b.isAfn === false ? "$" : "؋",
            parseNumber(b.DV).toLocaleString() || "—",
            toAFN(b, b.amount !== undefined ? "amount" : "totalAmount").toLocaleString(),
            moment(b.createdAt).format("YYYY/MM/DD"),
          ]),
          totals: [
            `جمع (${S.inflow.bills.count} مورد)`, "", "", "", "",
            `${S.inflow.bills.totalAFN_display.toLocaleString()} ؋`, "",
          ],
          fontSize: 8,
          headColor: [90, 150, 110],
          totalsColor: [60, 120, 80],
          totalsFill: [228, 242, 232],
        });
      }

      // ═══ سرمایه ═══
      y = startNewPage(doc);
      y = title("بخش سوم: سرمایه بدون تأثیر بر مانده", y);
      doc.setTextColor(40, 40, 40);
      y += 22;

      const capitalTotals = { headColor: [80, 80, 140], totalsColor: [80, 80, 140], totalsFill: [230, 230, 245] };

      y = sub("موجودی کالاها", y);
      if (!data.categoryData.categories.length) {
        y = empty("هیچ دسته‌بندی با کالای موجود یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["دسته", "نوع", "تعداد کالا", "ارزش موجودی ($)", "DV", "معادل (؋)"],
          body: data.categoryData.categories.map((cat) => {
            const usd = parseNumber(cat.summary?.stockValueUsd);
            const afn = parseNumber(cat.summary?.stockValueAfnEquivalent);
            const dv = usd > 0 ? afn / usd : 65;

            return [
              cat.name,
              cat.type?.name || "بدون نوع",
              cat.summary?.totalExistingIncomes || 0,
              usd.toLocaleString(),
              dv.toLocaleString(),
              afn.toLocaleString(),
            ];
          }),
          totals: ["جمع", "", "", "", "", `${S.capital.stockAFN.toLocaleString()} ؋`],
          ...capitalTotals,
        });
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("موجودی کمپل (بلنکت)", y);
      if (!data.blanketStock.length) {
        y = empty("هیچ موجودی کمپل یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["دسته", "تعداد", "قیمت واحد (؋)", "ارزش کل (؋)"],
          body: data.blanketStock.map((item) => [
            item.category?.name || `دسته ${item.categoryId}`,
            item.quantity,
            parseNumber(item.unitPrice).toLocaleString(),
            parseNumber(item.totalValue).toLocaleString(),
          ]),
          totals: ["جمع", "", "", `${S.capital.blanketAFN.toLocaleString()} ؋`],
          ...capitalTotals,
        });
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("هزینه‌های دارایی ثابت", y);
      if (!S.capital.fixedAssets.items.length) {
        y = empty("هیچ هزینه دارایی ثابت یافت نشد.", y);
      } else {
        y = rtlTable(doc, y, {
          head: ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
          body: S.capital.fixedAssets.items.map((e) => [
            e.id, parseNumber(e.amount).toLocaleString(), e.purpose || "—",
            e.by || "نامشخص", moment(e.createdAt).format("YYYY/MM/DD"),
          ]),
          totals: ["جمع", `${S.capital.fixedAssets.total.toLocaleString()} ؋`, "", "", ""],
          ...capitalTotals,
        });
      }

      // ═══ وضعیت حساب‌ها ═══
      y = startNewPage(doc);
      y = title("وضعیت حساب‌ها (اطلاعاتی — خارج از مانده)", y);
      doc.setTextColor(40, 40, 40);
      y += 22;

      const outstandingTable = (o, nameHeader, headColor, totalsFill) =>
        rtlTable(doc, y, {
          head: ["#", nameHeader, "مبلغ بدهی", "واحد", "DV", "معادل (؋)"],
          body: o.rows.map((r, i) => [
            i + 1, r.name,
            r.dueRaw.toLocaleString(),
            r.isAfn ? "؋" : "$",
            r.DV > 0 ? r.DV.toLocaleString() : "—",
            r.dueAFN.toLocaleString(),
          ]),
          totals: [
            `جمع (${o.count} مورد)`, "",
            `؋ ${o.totalAFS.toLocaleString()} + $ ${o.totalUSD.toLocaleString()}`,
            "", "",
            `${o.totalAFN.toLocaleString()} ؋`,
          ],
          columnStyles: { 2: { halign: "right" }, 5: { halign: "right" } },
          headColor,
          totalsColor: headColor,
          totalsFill,
        });

      y = sub("قرض به فروشنده ها", y);
      if (!S.outstanding.customersOwe.rows.length) {
        y = empty("هیچ مشتری بدهکاری وجود ندارد.", y);
      } else {
        y = outstandingTable(S.outstanding.customersOwe, "مشتری", [120, 100, 40], [245, 238, 220]);
      }

      y = ensureSpace(doc, y, 1, 18);
      y = sub("طلب از مشتریان ", y);
      if (!S.outstanding.weOweSellers.rows.length) {
        y = empty("هیچ فروشنده‌ای طلبکار نیست.", y);
      } else {
        y = outstandingTable(S.outstanding.weOweSellers, "فروشنده", [100, 40, 120], [240, 228, 245]);
      }

      // ═══ جمع کل همه جداول ═══
      y = startNewPage(doc);
      y = title("جمع کل جداول گزارش", y);
      doc.setTextColor(40, 40, 40);
      y += 18;

      y = rtlTable(doc, y, {
        head: ["بخش", "زیربخش", "تعداد", "جمع (؋)"],
        body: [
          ["رفته", "هزینه‌های مصرف", S.outflow.consumption.items.length, S.outflow.consumption.total],
          ["رفته", "بل‌های خرید (اطلاعاتی)", S.outflow.incomeBills.count, S.outflow.incomeBills.totalAFN_display],
          ["رفته", "پرداخت‌ها به فروشندگان", S.outflow.pays.items.length, S.outflow.pays.totalAFN],
          ["رفته", "جمع بخش رفته", "", S.outflow.totalAFN],
          ["آمده", "رسیدهای خریداران", S.inflow.receipts.items.length, S.inflow.receipts.total],
          ["آمده", "عایدهای متفرقه", S.inflow.otherIncomes.count, S.inflow.otherIncomes.total],
          ["آمده", "بل‌های فروش (اطلاعاتی)", S.inflow.bills.count, S.inflow.bills.totalAFN_display],
          ["آمده", "جمع بخش آمده", "", S.inflow.totalAFN],
          ["سرمایه", "موجودی کالاها", data.categoryData.categories.length, S.capital.stockAFN],
          ["سرمایه", "موجودی کمپل", data.blanketStock.length, S.capital.blanketAFN],
          ["سرمایه", "هزینه‌های دارایی ثابت", S.capital.fixedAssets.items.length, S.capital.fixedAssets.total],
          ["سرمایه", "جمع بخش سرمایه", "", S.capital.totalAFN],
          ["وضعیت", "طلب از مشتریان", S.outstanding.customersOwe.count, S.outstanding.customersOwe.totalAFN],
          ["وضعیت", "بدهی به فروشندگان", S.outstanding.weOweSellers.count, S.outstanding.weOweSellers.totalAFN],
        ].map((r) => [
          r[0], r[1],
          r[2] === "" ? "" : Number(r[2]).toLocaleString(),
          Number(r[3] || 0).toLocaleString(),
        ]),
        totals: [
          "مانده نهایی",
          "(آمد − رفته)",
          "",
          `${S.balance.toLocaleString()} ؋`,
        ],
        headColor: [60, 60, 90],
        fontSize: 8,
        columnStyles: {
          1: { halign: "right" },
          3: { halign: "right" },
        },
        totalsColor: S.balance >= 0 ? [0, 110, 0] : [180, 0, 0],
        totalsFill: S.balance >= 0 ? [225, 242, 228] : [248, 228, 228],
        totalsStyles: { 1: { fontStyle: "normal" }, 3: { fontStyle: "bold", fontSize: 10 } },
        didParseCell: (cell) => {
          if (cell.section === "body") {
            const label = String(cell.cell.raw ?? "");
            if (label.startsWith("جمع بخش")) {
              cell.cell.styles.fontStyle = "bold";
              cell.cell.styles.fillColor = [235, 235, 235];
            }
          }
        },
      });

      // ═══ محاسبه مفاد و سود ═══
      y = startNewPage(doc);
      y = title("محاسبه مفاد و سود", y);
      doc.setTextColor(40, 40, 40);
      y += 18;

      const P = computeProfit(data, S);

      y = rtlTable(doc, y, {
        head: ["شرح", "فرمول", "مبلغ (؋)"],
        body: [
          ["ارزش فروش", "(جمع بل‌های خرید − جمع بخش سرمایه)", P.valueOfSales],
          ["مفاد ناخالص فروش", "(جمع بل‌های فروش − ارزش فروش)", P.grossProfitOfSales],
          ["مفاد ناخالص", "(مفاد ناخالص فروش + عاید متفرقه)", P.grossProfit],
          ["مفاد خالص (سود)", "(مفاد ناخالص − هزینه‌های مصرف)", P.netProfit],
        ].map((r) => [r[0], r[1], Number(r[2]).toLocaleString()]),
        headColor: [80, 80, 140],
        fontSize: 9,
        columnStyles: {
          0: { halign: "right", fontStyle: "bold" },
          1: { halign: "right", textColor: [100, 100, 100], fontSize: 8 },
          2: { halign: "right" },
        },
        totalsColor: [0, 110, 0],
        totalsFill: [225, 242, 228],
        styles: { cellPadding: 6 },
        didParseCell: (cell, col) => {
          if (cell.section === "body" && col === 2) {
            if (String(cell.row.raw?.[0] || "").includes("مفاد خالص")) {
              cell.cell.styles.textColor = [0, 110, 0];
              cell.cell.styles.fontStyle = "bold";
              cell.cell.styles.fontSize = 11;
            }
          }
        },
      });

      // ═══ رفته و آمده — موجودی نقد ═══
      y = startNewPage(doc);
      y = title("جدول رفته و آمده (موجودی نقد)", y);
      doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text(
        "پولی که باید موجود باشد = جمع آمده − جمع رفته",
        pageWidth - 40, y, { align: "right" }
      );
      y += 18;

      const C = computeCashFlow(data, S);
      const fmtCell = (v) => (v === "" ? "" : Number(v).toLocaleString());

      y = rtlTable(doc, y, {
        head: ["رفته", "مبلغ (؋)", "آمده", "مبلغ (؋)"],
        body: C.pairedRows.map((r) => [r[0], fmtCell(r[1]), r[2], fmtCell(r[3])]),
        totals: [
          "جمع رفته", `${C.totalOut.toLocaleString()} ؋`,
          "جمع آمده", `${C.totalIn.toLocaleString()} ؋`,
        ],
        headColor: [60, 60, 90],
        fontSize: 10,
        styles: { cellPadding: 6 },
        columnStyles: {
          0: { halign: "right" },
          1: { halign: "right", textColor: [160, 40, 40] },
          2: { halign: "right" },
          3: { halign: "right", textColor: [30, 110, 50] },
        },
        totalsFill: [240, 240, 240],
        totalsStyles: {
          1: { textColor: [160, 40, 40] },
          3: { textColor: [30, 110, 50] },
        },
        didParseCell: (cell, col) => {
          if (cell.section === "head") {
            cell.cell.styles.fillColor = col <= 1 ? [160, 60, 60] : [40, 120, 60];
          }
        },
      });

      const cashPositive = C.cashBalance >= 0;
      y = rtlTable(doc, y, {
        head: ["شرح", "محاسبه", "مبلغ (؋)"],
        body: [[
          "پولی که باید موجود باشد",
          `${C.totalIn.toLocaleString()} − ${C.totalOut.toLocaleString()}`,
          `${C.cashBalance.toLocaleString()} ؋`,
        ]],
        headColor: cashPositive ? [30, 110, 50] : [170, 30, 30],
        fontSize: 11,
        styles: { cellPadding: 8 },
        columnStyles: {
          0: { halign: "right", fontStyle: "bold" },
          1: { halign: "center", textColor: [90, 90, 90], fontSize: 9 },
          2: { halign: "right", fontStyle: "bold", fontSize: 13 },
        },
        didParseCell: (cell, col) => {
          if (cell.section === "body") {
            cell.cell.styles.fillColor = cashPositive ? [225, 242, 228] : [248, 228, 228];
            if (col === 2) cell.cell.styles.textColor = cashPositive ? [0, 110, 0] : [180, 0, 0];
          }
        },
      });

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
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
      wb.Workbook = { Views: [{ RTL: true }] };

      const rangeStr = `${moment(fromDate).format("YYYY/MM/DD")} تا ${moment(toDate).format("YYYY/MM/DD")}`;
      const today = moment().format("YYYY/MM/DD");

      const addSheet = (name, headers, rows, totals) => {
        const sheet = XLSX.utils.aoa_to_sheet([
          [`گزارش جامع — ${name}`],
          [`بازه: ${rangeStr}`],
          [`تاریخ تولید: ${today}`],
          [],
          headers,
          ...rows,
          ...(totals ? [totals] : []),
        ]);
        sheet["!views"] = [{ RTL: true }];
        XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
        return sheet;
      };

      addSheet(
        "رفت - مصرف",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        S.outflow.consumption.items.map((e) => [
          e.id, parseNumber(e.amount), e.purpose || "—", e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        ["جمع", S.outflow.consumption.total, "", "", ""]
      );

      {
        const ib = buildIncomeBillRows(S.outflow.incomeBills.items, (b) => b.status);
        addSheet(
          "رفت - بل ورودی (اطلاعاتی)",
          [
            "شماره بل", "مشتری", "وضعیت", "مبلغ کل", "باقیمانده",
            "واحد", "DV", "معادل کل (؋)", "معادل باقیمانده (؋)",
            "دریافتی (رسیدها)", "تاریخ",
          ],
          ib.rows.map((r) => [
            r.b.billNumber || r.b.id,
            r.b.customer?.fullname || "—",
            r.statusLabel,
            parseNumber(r.b.totalAmount),
            r.remainingRaw,
            r.b.isAfn === true ? "AFN" : "USD",
            r.dv || "",
            r.totalAFN,
            r.remainingAFN,
            r.receiptLabel,
            moment(r.b.createdAt).format("YYYY/MM/DD HH:mm"),
          ]),
          [
            "جمع", "", "", "", "", "", "",
            S.outflow.incomeBills.totalAFN_display,
            ib.totalRemainingAFN,
            ib.totalReceivedAFN,
            "",
          ]
        );
      }

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
        ["جمع", "", "", "", "", S.outflow.pays.totalAFN, "", ""]
      );

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
        ["جمع", "", "", "", "", S.inflow.receipts.total, "", ""]
      );

      addSheet(
        "آمد - عاید متفرقه",
        ["ردیف", "عنوان (بابت)", "مبلغ (؋)", "توضیحات", "تاریخ"],
        S.inflow.otherIncomes.items.map((inc, i) => [
          i + 1,
          inc.for || "—",
          parseNumber(inc.amount),
          inc.description || "-",
          moment(inc.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        ["جمع", "", S.inflow.otherIncomes.total, "", ""]
      );

      addSheet(
        "آمد - بل‌ها (اطلاعاتی)",
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
        [`جمع (${S.inflow.bills.count} مورد)`, "", "", "", "", S.inflow.bills.totalAFN_display, "", ""]
      );

      addSheet(
        "سرمایه - موجودی کالا",
        ["دسته", "نوع", "تعداد کالا", "ارزش موجودی ($)", "DV", "معادل (؋)"],
        data.categoryData.categories.map((cat) => {
          const usd = parseNumber(cat.summary?.stockValueUsd);
          const afn = parseNumber(cat.summary?.stockValueAfnEquivalent);
          const dv = usd > 0 ? afn / usd : 65;
          return [
            cat.name,
            cat.type?.name || "بدون نوع",
            cat.summary?.totalExistingIncomes || 0,
            usd,
            dv || "",
            afn,
          ];
        }),
        ["جمع", "", "", "", "", S.capital.stockAFN]
      );

      addSheet(
        "سرمایه - موجودی کمپل",
        ["دسته", "تعداد", "قیمت واحد (؋)", "ارزش کل (؋)"],
        data.blanketStock.map((item) => [
          item.category?.name || `دسته ${item.categoryId}`,
          item.quantity,
          parseNumber(item.unitPrice),
          parseNumber(item.totalValue),
        ]),
        ["جمع", "", "", S.capital.blanketAFN]
      );

      addSheet(
        "سرمایه - دارایی ثابت",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        S.capital.fixedAssets.items.map((e) => [
          e.id, parseNumber(e.amount), e.purpose || "—", e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        ["جمع", S.capital.fixedAssets.total, "", "", ""]
      );

      const outstandingSheet = (name, nameHeader, o) =>
        addSheet(
          name,
          ["#", nameHeader, "مبلغ بدهی", "واحد", "DV", "معادل (؋)"],
          o.rows.map((r, i) => [
            i + 1, r.name, r.dueRaw, r.isAfn ? "AFN" : "USD",
            r.DV || "", r.dueAFN,
          ]),
          [
            `جمع (${o.count} مورد)`, "",
            `؋ ${o.totalAFS.toLocaleString()} + $ ${o.totalUSD.toLocaleString()}`,
            "", "", o.totalAFN,
          ]
        );
      outstandingSheet("وضعیت - طلب از مشتریان", "مشتری", S.outstanding.customersOwe);
      outstandingSheet("وضعیت - بدهی به فروشندگان", "فروشنده", S.outstanding.weOweSellers);

      // ── Profit Section ──
      const P = computeProfit(data, S);
      addSheet(
        "محاسبه مفاد و سود",
        ["شرح", "فرمول", "راهنما / معادله (با اعداد)", "مبلغ (؋)"],
        [
          [
            "ارزش فروش",
            "(جمع بل‌های خرید − جمع بخش سرمایه)",
            `${P.incomeBillsTotalAFN.toLocaleString()} − ${P.totalCapital.toLocaleString()} = ${P.valueOfSales.toLocaleString()}`,
            P.valueOfSales,
          ],
          [
            "مفاد ناخالص فروش",
            "(جمع بل‌های فروش − ارزش فروش)",
            `${P.billsTotalAFN.toLocaleString()} − ${P.valueOfSales.toLocaleString()} = ${P.grossProfitOfSales.toLocaleString()}`,
            P.grossProfitOfSales,
          ],
          [
            "مفاد ناخالص",
            "(مفاد ناخالص فروش + عاید متفرقه)",
            `${P.grossProfitOfSales.toLocaleString()} + ${P.otherIncomesTotalAFN.toLocaleString()} = ${P.grossProfit.toLocaleString()}`,
            P.grossProfit,
          ],
          [
            "مفاد خالص (سود)",
            "(مفاد ناخالص − هزینه‌های مصرف)",
            `${P.grossProfit.toLocaleString()} − ${P.consumptionTotalAFN.toLocaleString()} = ${P.netProfit.toLocaleString()}`,
            P.netProfit,
          ],
        ],
        null
      );

      // ── رفته و آمده (موجودی نقد) ──
      const C = computeCashFlow(data, S);
      const cashSheet = addSheet(
        "رفته و آمده",
        ["رفته", "مبلغ (؋)", "آمده", "مبلغ (؋)"],
        [
          ...C.pairedRows,
          ["جمع رفته", C.totalOut, "جمع آمده", C.totalIn],
          [],
          ["پولی که باید موجود باشد (آمده − رفته)", "", `${C.totalIn.toLocaleString()} − ${C.totalOut.toLocaleString()}`, C.cashBalance],
        ],
        null
      );
      cashSheet["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 30 }, { wch: 16 }];

      const summaryRows = [
        ["رفته", "هزینه‌های مصرف", S.outflow.consumption.items.length, S.outflow.consumption.total],
        ["رفته", "بل‌های خرید (اطلاعاتی)", S.outflow.incomeBills.count, S.outflow.incomeBills.totalAFN_display],
        ["رفته", "پرداخت‌ها به فروشندگان", S.outflow.pays.items.length, S.outflow.pays.totalAFN],
        ["رفته", "جمع بخش رفته", "", S.outflow.totalAFN],
        [],
        ["آمده", "رسیدهای خریداران", S.inflow.receipts.items.length, S.inflow.receipts.total],
        ["آمده", "عایدهای متفرقه", S.inflow.otherIncomes.count, S.inflow.otherIncomes.total],
        ["آمده", "بل‌های فروش (اطلاعاتی)", S.inflow.bills.count, S.inflow.bills.totalAFN_display],
        ["آمده", "جمع بخش آمده", "", S.inflow.totalAFN],
        [],
        ["سرمایه", "موجودی کالاها", data.categoryData.categories.length, S.capital.stockAFN],
        ["سرمایه", "موجودی کمپل", data.blanketStock.length, S.capital.blanketAFN],
        ["سرمایه", "هزینه‌های دارایی ثابت", S.capital.fixedAssets.items.length, S.capital.fixedAssets.total],
        ["سرمایه", "جمع بخش سرمایه", "", S.capital.totalAFN],
        [],
        ["وضعیت", "طلب از مشتریان", S.outstanding.customersOwe.count, S.outstanding.customersOwe.totalAFN],
        ["وضعیت", "بدهی به فروشندگان", S.outstanding.weOweSellers.count, S.outstanding.weOweSellers.totalAFN],
        [],
        ["مانده نهایی", "(آمد − رفته)", "", S.balance],
        [],
        ["— مفاد و سود —", "", "", ""],
        ["ارزش فروش", "(جمع بل‌های خرید − جمع بخش سرمایه)", "", P.valueOfSales],
        ["مفاد ناخالص فروش", "(جمع بل‌های فروش − ارزش فروش)", "", P.grossProfitOfSales],
        ["مفاد ناخالص", "(مفاد ناخالص فروش + عاید متفرقه)", "", P.grossProfit],
        ["مفاد خالص", "(مفاد ناخالص − هزینه‌های مصرف)", "", P.netProfit],
        [],
        ["— رفته و آمده (موجودی نقد) —", "", "", ""],
        ...C.outRows.map((r) => ["رفته", r.label, "", r.amount]),
        ["رفته", "جمع رفته", "", C.totalOut],
        ...C.inRows.map((r) => ["آمده", r.label, "", r.amount]),
        ["آمده", "جمع آمده", "", C.totalIn],
        ["پولی که باید موجود باشد", "(جمع آمده − جمع رفته)", "", C.cashBalance],
      ];

      const summary = XLSX.utils.aoa_to_sheet([
        [`خلاصه و جمع کل جداول (${rangeStr})`],
        [`تاریخ تولید: ${today}`],
        [],
        ["بخش", "زیربخش", "تعداد", "جمع (؋)"],
        ...summaryRows,
      ]);
      summary["!views"] = [{ RTL: true }];
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
