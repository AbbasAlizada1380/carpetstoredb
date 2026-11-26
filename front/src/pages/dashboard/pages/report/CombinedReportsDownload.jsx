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

  // Normalize unpaid → always preserves per-row currency for display,
  // uses server `total` for the authoritative per-currency subtotals.
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

  // Shared per-bill calculation for incoming bills (used by PDF and Excel)
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

  // ── Other incomes normalizer ──────────────────────────────────────────
  // API: { success, data: [{ id, amount, for, description, createdAt }],
  //        summary: { totalRecords, totalAmount } }
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
      customerUnpaidRes, buyerUnpaidRes,
    ] = await Promise.all([
      axios.get(`${BASE_URL}/pay/filter?${params.toString()}`).then((r) => r.data.data || []),
      axios.get(`${BASE_URL}/receipt/filter?${params.toString()}`).then((r) => r.data || []),
      axios.get(`${BASE_URL}/expense/date_range?${expenseParams.toString()}`).then((r) => r.data),
      axios.get(`${BASE_URL}/attendance/date-range?${expenseParams.toString()}`).then((r) => r.data.data || []),
      // ✅ keep full payload so we can use summary.totalAmount
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
    ]);

    const calculatedExpenses = expensesData.calculated?.items || [];
    const nonCalculatedExpenses = expensesData.nonCalculated?.items || [];
    const otherIncomes = normalizeOtherIncomes(otherIncomesRaw);

    return {
      payments, receipts, calculatedExpenses, nonCalculatedExpenses, salaries, otherIncomes,
      categoryData, blanketStock, incomeBills, bills,
      customerUnpaid: customerUnpaidRes, buyerUnpaid: buyerUnpaidRes,
    };
  };

  const computeSections = (data) => {
    const {
      payments, receipts, nonCalculatedExpenses, otherIncomes,
      incomeBills, bills, categoryData, blanketStock, calculatedExpenses,
      customerUnpaid, buyerUnpaid,
    } = data;

    // ── رفت (cash only: consumption + pays) ──
    const totalPaysAFN = payments.reduce((s, p) => s + toAFN(p, "amountofmoney"), 0);
    const totalConsumption = nonCalculatedExpenses.reduce((s, e) => s + parseNumber(e.amount), 0);
    const totalIbAFN_display = incomeBills.reduce((s, b) => s + toAFN(b, "totalAmount"), 0);
    const outflowAFN = totalPaysAFN + totalConsumption;

    // ── آمد (cash only: receipts + other incomes) ──
    const totalReceipts = receipts.reduce((s, r) => s + toAFN(r, "amountofmoney"), 0);
    // ✅ use normalized otherIncomes.total (server summary when available)
    const totalOtherIncomes = otherIncomes.total;
    const totalBillsAFN_display = bills.reduce(
      (s, b) => s + toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"), 0
    );
    const inflowAFN = totalReceipts + totalOtherIncomes;

    // ── سرمایه ──
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
        otherIncomes, // ✅ { items, total, count }
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

  // ── RTL table helper ──────────────────────────────────────
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
      const line = (label, val, y, color = [40, 40, 40], size = 11) => {
        y = ensureSpace(doc, y, 1, 16);
        doc.setFontSize(size); doc.setTextColor(...color);
        doc.text(`${label}: ${val}`, pageWidth - 40, y, { align: "right" });
        doc.setTextColor(40, 40, 40);
        return y + 16;
      };
      const note = (t, y) => {
        y = ensureSpace(doc, y, 1, 12);
        doc.setFontSize(9); doc.setTextColor(140, 100, 20);
        doc.text(t, pageWidth - 40, y, { align: "right" });
        doc.setTextColor(40, 40, 40);
        return y + 14;
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

      // مصرف
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

      // ★ بل‌های خرید — display only
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
            3: { halign: "right" },
            4: { halign: "right" },
            7: { halign: "right" },
            8: { halign: "right" },
            9: { halign: "right", fontSize: 7 },
          },
          totalsColor: [90, 60, 20],
          totalsFill: [250, 235, 215],
          totalsStyles: {
            7: { textColor: [120, 80, 30] },
            8: { textColor: [180, 80, 0] },
            9: { textColor: [40, 120, 60] },
          },
          didParseCell: (cell, col) => {
            if (cell.section === "body" && col === 4) {
              const raw = cell.cell.raw?.toString().replace(/,/g, "") || "0";
              if (parseFloat(raw) > 0) {
                cell.cell.styles.textColor = [180, 80, 0];
                cell.cell.styles.fontStyle = "bold";
              }
            }
          },
        });
      }

      // پرداخت‌ها
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

      // Section 1 total
      y = ensureSpace(doc, y, 3, 18);
      doc.setDrawColor(160, 60, 60); doc.setLineWidth(1);
      doc.line(PAGE_MARGIN_LEFT_RIGHT, y, pageWidth - PAGE_MARGIN_LEFT_RIGHT, y);
      y += 16;
      doc.setDrawColor(0, 0, 0);

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

      // ★ بل‌ها — display only
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

      // Section 2 total
      y = ensureSpace(doc, y, 3, 18);
      doc.setDrawColor(40, 120, 60); doc.setLineWidth(1);
      doc.line(PAGE_MARGIN_LEFT_RIGHT, y, pageWidth - PAGE_MARGIN_LEFT_RIGHT, y);
      y += 16;
      doc.setDrawColor(0, 0, 0);

      // ═══ سرمایه ═══
      y = startNewPage(doc);
      y = title("بخش سوم: سرمایه بدون تأثیر بر مانده", y);
      doc.setFontSize(10); doc.setTextColor(80, 80, 80);
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
            // ✅ Read the exact fields from your API response
            const usd = parseNumber(cat.summary?.stockValueUsd);
            const afn = parseNumber(cat.summary?.stockValueAfnEquivalent);

            // Calculate DV dynamically if not provided, otherwise fallback to 65
            const dv = usd > 0 ? (afn / usd) : 65;

            return [
              cat.name,
              cat.type?.name || "بدون نوع",
              cat.summary?.totalExistingIncomes || 0,
              usd.toLocaleString(),           // ✅ USD column
              dv.toLocaleString(),            // ✅ DV column
              afn.toLocaleString(),           // ✅ AFN column
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

      y = ensureSpace(doc, y, 2, 18);
      doc.setDrawColor(80, 80, 140); doc.setLineWidth(1);
      doc.line(PAGE_MARGIN_LEFT_RIGHT, y, pageWidth - PAGE_MARGIN_LEFT_RIGHT, y);
      y += 16;
      y = line("جمع سرمایه اطلاعاتی", `${S.capital.totalAFN.toLocaleString()} ؋`, y, [80, 80, 140], 13);
      doc.setDrawColor(0, 0, 0);

      // ═══ وضعیت حساب‌ها ═══
      y = startNewPage(doc);
      y = title("وضعیت حساب‌ها (اطلاعاتی — خارج از مانده)", y);
      doc.setFontSize(10); doc.setTextColor(80, 80, 80);
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

      // طلب از مشتریان
      y = sub("قرض به فروشنده ها", y);
      if (!S.outstanding.customersOwe.rows.length) {
        y = empty("هیچ مشتری بدهکاری وجود ندارد.", y);
      } else {
        y = outstandingTable(S.outstanding.customersOwe, "مشتری", [120, 100, 40], [245, 238, 220]);
      }

      // بدهی به فروشندگان
      y = ensureSpace(doc, y, 1, 18);
      y = sub("طلب از مشتریان ", y);
      if (!S.outstanding.weOweSellers.rows.length) {
        y = empty("هیچ فروشنده‌ای طلبکار نیست.", y);
      } else {
        y = outstandingTable(S.outstanding.weOweSellers, "فروشنده", [100, 40, 120], [240, 228, 245]);
      }
      // خلاصه خالص
      y = ensureSpace(doc, y, 3, 18);
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
      doc.line(pageWidth - 320, y, pageWidth - 40, y);
      y += 14;

      // ═══════════════════════════════════════════════════════════════════
      // ★★★ NEW: مفاد ناخالص and مفاد خالص ★★★
      // ═══════════════════════════════════════════════════════════════════
      y = ensureSpace(doc, y, 6, 20);

      // 1. Calculate the required totals
      const billsTotalAFN = data.bills.reduce(
        (s, b) => s + toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"),
        0
      );

      const incomeBillsTotalAFN = data.incomeBills.reduce(
        (s, b) => s + toAFN(b, "totalAmount"),
        0
      );

      // جمع سرمایه اطلاعاتی — already computed as S.capital.totalAFN
      const informationCapitalTotalAFN = S.capital.totalAFN;

      // For expenses, we use consumption (خرچ) + pays (پرداخت‌ها) 
      // If you only mean 'nonCalculatedExpenses', remove the pays part.
      const expensesTotalAFN = S.outflow.consumption.total + S.outflow.pays.totalAFN;

      const otherIncomesTotalAFN = S.inflow.otherIncomes.total;

      // 2. Apply the formulas
      // ★ مفاد ناخالص now includes جمع سرمایه اطلاعاتی
      const grossProfit = billsTotalAFN - incomeBillsTotalAFN + informationCapitalTotalAFN;
      const netProfit = grossProfit - expensesTotalAFN + otherIncomesTotalAFN;

      // 3. Render مفاد ناخالص
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.text("مفاد ناخالص (جمع بل‌های فروش - جمع بل‌های خرید + جمع سرمایه اطلاعاتی):", pageWidth - 40, y, { align: "right" });
      y += 18;
      y = line(
        "مفاد ناخالص",
        `${grossProfit.toLocaleString()} ؋`,
        y,
        grossProfit >= 0 ? [0, 120, 0] : [180, 0, 0],
        12
      );

      // Small breakdown note for Gross
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `(راهنما: بل‌های فروش ${billsTotalAFN.toLocaleString()} - بل‌های خرید ${incomeBillsTotalAFN.toLocaleString()} + سرمایه اطلاعاتی ${informationCapitalTotalAFN.toLocaleString()})`,
        pageWidth - 40,
        y,
        { align: "right" }
      );
      doc.setTextColor(40, 40, 40);
      y += 24;

      // 4. Render مفاد خالص
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.text("مفاد خالص (مفاد ناخالص - خرچ + عاید متفرقه):", pageWidth - 40, y, { align: "right" });
      y += 18;
      y = line(
        "مفاد خالص",
        `${netProfit.toLocaleString()} ؋`,
        y,
        netProfit >= 0 ? [0, 120, 0] : [180, 0, 0],
        14 // slightly larger for emphasis
      );

      // Small breakdown note for Net
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `(راهنما: مفاد ناخالص ${grossProfit.toLocaleString()} - خرچ ${expensesTotalAFN.toLocaleString()} + عاید متفرقه ${otherIncomesTotalAFN.toLocaleString()})`,
        pageWidth - 40,
        y,
        { align: "right" }
      );
      doc.setTextColor(40, 40, 40);
      y += 30;
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
      };

      // 1. رفت - مصرف
      addSheet(
        "رفت - مصرف",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        S.outflow.consumption.items.map((e) => [
          e.id, parseNumber(e.amount), e.purpose || "—", e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        ["جمع", S.outflow.consumption.total, "", "", ""]
      );

      // 2. رفت - بل ورودی (اطلاعاتی)
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
        ["جمع", "", "", "", "", S.outflow.pays.totalAFN, "", ""]
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
        ["جمع", "", "", "", "", S.inflow.receipts.total, "", ""]
      );

      // 5. آمد - عاید متفرقه
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

      // 6. آمد - بل‌ها (اطلاعاتی)
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

      // 7. سرمایه - موجودی کالا
      // ✅ Use the SAME fields as the PDF: stockValueUsd / stockValueAfnEquivalent
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
        ["جمع", "", "", S.capital.blanketAFN]
      );

      // 9. سرمایه - دارایی ثابت
      addSheet(
        "سرمایه - دارایی ثابت",
        ["شماره", "مبلغ (؋)", "بابت", "توسط", "تاریخ"],
        S.capital.fixedAssets.items.map((e) => [
          e.id, parseNumber(e.amount), e.purpose || "—", e.by || "نامشخص",
          moment(e.createdAt).format("YYYY/MM/DD HH:mm"),
        ]),
        ["جمع", S.capital.fixedAssets.total, "", "", ""]
      );

      // 10 & 11. وضعیت حساب‌ها
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

      // ── 12. خلاصه (مطابق PDF، شامل مفاد ناخالص و مفاد خالص) ──────────
      // Calculate the same profit figures as the PDF
      const billsTotalAFN = data.bills.reduce(
        (s, b) => s + toAFN(b, b.amount !== undefined ? "amount" : "totalAmount"),
        0
      );
      const incomeBillsTotalAFN = data.incomeBills.reduce(
        (s, b) => s + toAFN(b, "totalAmount"),
        0
      );
      // جمع سرمایه اطلاعاتی = همان مقدار نمایش‌داده‌شده در بخش سوم
      const informationCapitalTotalAFN = S.capital.totalAFN;

      // خرچ = مصرف + پرداخت‌ها (same as PDF)
      const expensesTotalAFN =
        S.outflow.consumption.total + S.outflow.pays.totalAFN;

      const otherIncomesTotalAFN = S.inflow.otherIncomes.total;

      // مفاد ناخالص = بل‌های فروش − بل‌های خرید + سرمایه اطلاعاتی
      const grossProfit =
        billsTotalAFN - incomeBillsTotalAFN + informationCapitalTotalAFN;

      // مفاد خالص = مفاد ناخالص − خرچ + عاید متفرقه
      const netProfit =
        grossProfit - expensesTotalAFN + otherIncomesTotalAFN;

      const summary = XLSX.utils.aoa_to_sheet([
        [`خلاصه و مانده (${rangeStr})`],
        [`تاریخ تولید: ${today}`],
        [],
        ["بخش", "زیربخش", "مبلغ (؋)", "در مانده لحاظ می‌شود؟"],
        ["آمد", "رسیدها", S.inflow.receipts.total, "بله"],
        ["آمد", "عایدهای متفرقه", S.inflow.otherIncomes.total, "بله"],
        ["آمد", "بل‌ها (اطلاعاتی)", S.inflow.bills.totalAFN_display, "خیر"],
        ["جمع آمد", "", S.inflow.totalAFN, "بله"],
        [],
        ["رفت", "مصرف", S.outflow.consumption.total, "بله"],
        ["رفت", "بل ورودی (اطلاعاتی)", S.outflow.incomeBills.totalAFN_display, "خیر"],
        ["رفت", "پرداخت‌ها", S.outflow.pays.totalAFN, "بله"],
        ["جمع رفت", "", S.outflow.totalAFN, "بله"],
        [],
        ["سرمایه (بدون تأثیر)", "موجودی کالا معادل افغانی", S.capital.stockAFN, "خیر"],
        ["سرمایه (بدون تأثیر)", "موجودی کمپل", S.capital.blanketAFN, "خیر"],
        ["سرمایه (بدون تأثیر)", "دارایی ثابت", S.capital.fixedAssets.total, "خیر"],
        ["جمع سرمایه", "", S.capital.totalAFN, "خیر"],
        [],
        ["مانده نهایی", "", S.balance, "—"],
        [],
        ["— مفاد (سود و زیان) —", "", "", ""],
        ["مفاد ناخالص", "بل‌های فروش", billsTotalAFN, ""],
        ["مفاد ناخالص", "منهای: بل‌های خرید", incomeBillsTotalAFN, ""],
        ["مفاد ناخالص", "به‌علاوه: سرمایه اطلاعاتی", informationCapitalTotalAFN, ""],
        ["مفاد ناخالص", "جمع مفاد ناخالص", grossProfit, ""],
        [],
        ["مفاد خالص", "مفاد ناخالص", grossProfit, ""],
        ["مفاد خالص", "منهای: خرچ (مصرف + پرداخت‌ها)", expensesTotalAFN, ""],
        ["مفاد خالص", "به‌علاوه: عاید متفرقه", otherIncomesTotalAFN, ""],
        ["مفاد خالص", "جمع مفاد خالص", netProfit, ""],
        [],
        ["— وضعیت حساب‌ها (اطلاعاتی) —", "", "", ""],
        ["طلب از مشتریان", `${S.outstanding.customersOwe.count} مورد`, S.outstanding.customersOwe.totalAFN, "خیر"],
        ["  — افغانی", "", S.outstanding.customersOwe.totalAFS, ""],
        ["  — دالر", "", S.outstanding.customersOwe.totalUSD, ""],
        ["بدهی به فروشندگان", `${S.outstanding.weOweSellers.count} مورد`, S.outstanding.weOweSellers.totalAFN, "خیر"],
        ["  — افغانی", "", S.outstanding.weOweSellers.totalAFS, ""],
        ["  — دالر", "", S.outstanding.weOweSellers.totalUSD, ""],
        ["خالص وضعیت", "", S.outstanding.customersOwe.totalAFN - S.outstanding.weOweSellers.totalAFN, "خیر"],
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