// src/components/wallet/downloadValetsReportPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";
import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";

moment.loadPersian({ usePersianDigits: false, dialect: "persian-modern" });

const fmt = (n) =>
  new Intl.NumberFormat("en-US").format(Number(n || 0));

/* ✅ Hijri Shamsi date-time */
const fmtDateTime = (d) => {
  if (!d) return "—";
  try {
    return moment(d).format("jYYYY/jMM/jDD HH:mm");
  } catch {
    return "—";
  }
};

/* ✅ Hijri Shamsi date only */
const shamsi = (d) => {
  if (!d) return "—";
  try {
    return moment(d).format("jYYYY/jMM/jDD");
  } catch {
    return "—";
  }
};

/* ✅ Shamsi filename-safe */
const shamsiFileSafe = (d) => {
  try {
    return moment(d).format("jYYYY-jMM-jDD");
  } catch {
    return "date";
  }
};

/**
 * @param {Object} options
 * @param {Array}  options.rows      - valet rows
 * @param {Object} options.totals    - { count, totalDeposit, totalWithdraw, net }
 * @param {Object} options.filters   - { holderName, type, from, to, search }
 */
export function downloadValetsReportPDF({
  rows,
  totals: providedTotals = {},
  filters = {},
}) {
  if (!rows || rows.length === 0) {
    alert("داده‌ای برای دانلود وجود ندارد");
    return;
  }

  /* =========================================================
     ✅ Compute totals from rows if not provided
     ========================================================= */
  const computedTotals = rows.reduce(
    (acc, v) => {
      const amt = Number(v.amount || 0);
      if (v.type === "deposit") acc.totalDeposit += amt;
      else acc.totalWithdraw += amt;
      acc.count += 1;
      return acc;
    },
    { count: 0, totalDeposit: 0, totalWithdraw: 0 }
  );
  computedTotals.net =
    computedTotals.totalDeposit - computedTotals.totalWithdraw;

  const totals = {
    count: providedTotals.count ?? computedTotals.count,
    totalDeposit: providedTotals.totalDeposit ?? computedTotals.totalDeposit,
    totalWithdraw:
      providedTotals.totalWithdraw ?? computedTotals.totalWithdraw,
    net: providedTotals.net ?? computedTotals.net,
  };

  /* =========================================================
     Init PDF
     ========================================================= */
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  doc.setR2L(false);

  doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
  doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
  doc.setFont("Vazirmatn", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const rightX = pageWidth - 40;

  /* ✅ Shamsi dates */
  const todayShamsi = moment().format("jYYYY/jMM/jDD");
  const todayFileSafe = moment().format("jYYYY-jMM-jDD");

  /* =========================================================
     Title + subtitle
     ========================================================= */
  doc.setFontSize(15);
  doc.setFont("Vazirmatn", "normal");
  doc.text("گزارش تراکنش‌های سهام‌داران", rightX, 55, {
    align: "right",
  });

  /* Subtitle: applied filters */
  const parts = [];
  if (filters.holderName) parts.push(`حامل: ${filters.holderName}`);
  if (filters.type) {
    parts.push(
      `نوع: ${filters.type === "deposit" ? "واریز" : "برداشت"}`
    );
  }
  if (filters.from) parts.push(`از: ${shamsi(filters.from)}`);
  if (filters.to) parts.push(`تا: ${shamsi(filters.to)}`);
  if (filters.search) parts.push(`جستجو: ${filters.search}`);
  parts.push(`تاریخ صدور: ${todayShamsi}`);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont("Vazirmatn", "normal");
  doc.text(parts.join("  •  "), rightX, 75, { align: "right" });

  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(1);
  doc.line(40, 85, rightX, 85);
  doc.setTextColor(0, 0, 0);

  /* =========================================================
     ✅ Summary tiles ABOVE the table (RTL-friendly)
     ========================================================= */
  const tileY = 100;
  const tileHeight = 46;
  const tileGap = 10;
  const tileWidth = (pageWidth - 80 - tileGap * 3) / 4;

  const tiles = [
    {
      label: "تعداد تراکنش‌ها",
      value: String(totals.count),
      color: [30, 64, 175],       // primary
      bg: [239, 246, 255],         // blue-50
    },
    {
      label: "مجموع واریز",
      value: `${fmt(totals.totalDeposit)} افغانی`,
      color: [4, 120, 87],         // emerald
      bg: [236, 253, 245],         // emerald-50
    },
    {
      label: "مجموع برداشت",
      value: `${fmt(totals.totalWithdraw)} افغانی`,
      color: [185, 28, 28],        // red
      bg: [254, 242, 242],         // red-50
    },
    {
      label: "خالص",
      value: `${fmt(totals.net)} افغانی`,
      color:
        Number(totals.net) >= 0 ? [4, 120, 87] : [185, 28, 28],
      bg:
        Number(totals.net) >= 0 ? [236, 253, 245] : [254, 242, 242],
    },
  ];

  /* Draw tiles right → left */
  tiles.forEach((tile, i) => {
    const x = rightX - tileWidth * (i + 1) - tileGap * i;
    const y = tileY;

    // Background
    doc.setFillColor(...tile.bg);
    doc.roundedRect(x, y, tileWidth, tileHeight, 6, 6, "F");

    // Border
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, tileWidth, tileHeight, 6, 6, "S");

    // Label
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.setFont("Vazirmatn", "normal");
    doc.text(tile.label, x + tileWidth - 8, y + 14, {
      align: "right",
    });

    // Value
    doc.setFontSize(11);
    doc.setTextColor(...tile.color);
    doc.setFont("Vazirmatn", "normal");
    doc.text(tile.value, x + tileWidth - 8, y + 32, {
      align: "right",
    });
  });

  /* =========================================================
     ✅ Table — RTL visual order (rightmost column = first item)
     
     autoTable draws left-to-right. To render right-to-left,
     we reverse the column order BEFORE passing to autoTable,
     and reverse each row too — CONSISTENTLY.
     ========================================================= */

  /* Logical order (how a Persian reader sees it left→right on paper) */
  const LOGICAL_HEAD = [
    "#",
    "حامل",
    "نوع",
    "مبلغ",
    "منبع",
    "توضیحات",
    "تاریخ",
  ];

  /* ✅ Reverse once for RTL visual: rightmost column becomes first */
  const head = [
    LOGICAL_HEAD.map((label) => ({
      content: label,
      styles: { font: "Vazirmatn" },
    })).reverse(),
  ];

  /* ✅ Body — same reverse transformation as head */
  const body = rows.map((v) => {
    const holderName = v.holderInfo?.fullName || `#${v.holder}`;
    const holderNic = v.holderInfo?.NIC || "";
    const typeLabel = v.type === "deposit" ? "واریز" : "برداشت";
    const sourceLabel = v.source
      ? v.source === "valet"
        ? "والټ"
        : "کسب‌وکار"
      : "—";
    const sign = v.type === "deposit" ? "+" : "−";

    return [
      `#${v.id}`,
      holderNic ? `${holderName}\n${holderNic}` : holderName,
      typeLabel,
      `${sign}${fmt(v.amount)}`,
      sourceLabel,
      v.description || "—",
      fmtDateTime(v.createdAt),
    ].reverse(); // ✅ Reverse the same way as head
  });

  /* ✅ Foot — totals row, also reversed */
  const foot = [
    [
      "",
      { content: "مجموع", styles: { font: "Vazirmatn" } },
      "",
      `${fmt(totals.totalDeposit)} / ${fmt(totals.totalWithdraw)}`,
      "",
      "",
      "",
    ].reverse(),
  ];

  autoTable(doc, {
    startY: tileY + tileHeight + 15,
    head,
    body,
    foot,
    theme: "grid",
    styles: {
      font: "Vazirmatn",
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: 6,
      lineColor: [230, 230, 230],
      lineWidth: 0.5,
    },
    headStyles: {
      font: "Vazirmatn",
      fontStyle: "normal",
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      halign: "center",
      fontSize: 9,
    },
    footStyles: {
      font: "Vazirmatn",
      fontStyle: "normal",
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      halign: "center",
      fontSize: 9,
    },
    columnStyles: {
      /* Column indexes AFTER reverse:
         0 = تاریخ
         1 = توضیحات
         2 = منبع
         3 = مبلغ
         4 = نوع
         5 = حامل
         6 = # */
      0: { cellWidth: 100 }, // تاریخ
      1: { cellWidth: 140 }, // توضیحات
      2: { cellWidth: 60 },  // منبع
      3: { cellWidth: 70 },  // مبلغ
      4: { cellWidth: 50 },  // نوع
      5: { cellWidth: 110 }, // حامل
      6: { cellWidth: 30 },  // #
    },
    didParseCell: (data) => {
      /* ✅ Force Vazirmatn on every cell at parse time */
      data.cell.styles.font = "Vazirmatn";

      /* ✅ Colorize amount cells (index 3 after reverse) */
      if (data.section === "body" && data.column.index === 3) {
        const text = String(data.cell.raw || "");
        if (text.startsWith("+")) {
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fontStyle = "bold";
        } else if (text.startsWith("−")) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    /* ✅ Force Vazirmatn at draw time — prevents garbled Persian */
    willDrawCell: () => {
      doc.setFont("Vazirmatn", "normal");
    },
  });

  /* =========================================================
     Net summary at bottom (below table)
     ========================================================= */
  const yAfterTable =
    (doc.lastAutoTable?.finalY || 200) + 20;

  if (yAfterTable < pageHeight - 60) {
    doc.setFontSize(11);
    doc.setFont("Vazirmatn", "normal");

    const netColor =
      Number(totals.net) >= 0 ? [4, 120, 87] : [185, 28, 28];
    doc.setTextColor(...netColor);

    doc.text(
      `خالص نهایی: ${fmt(totals.net)} افغانی`,
      rightX,
      yAfterTable,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
  }

  /* =========================================================
     Page numbers
     ========================================================= */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont("Vazirmatn", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`${i}/${pageCount}`, rightX, pageHeight - 30, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }

  /* ---------- Save with Shamsi filename ---------- */
  doc.save(`Valets_Report_${todayFileSafe}.pdf`);
}