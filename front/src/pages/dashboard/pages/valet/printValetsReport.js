// src/components/wallet/printValetsReport.js
import moment from "moment-jalaali";

moment.loadPersian({ usePersianDigits: false, dialect: "persian-modern" });

const fmt = (n) =>
  new Intl.NumberFormat("en-US").format(Number(n || 0));

/* ✅ Hijri Shamsi date-time formatter */
const formatDate = (d) => {
  if (!d) return "—";
  try {
    return moment(d).format("jYYYY/jMM/jDD HH:mm");
  } catch {
    return "—";
  }
};

/* ✅ Shamsi date only */
const formatShamsi = (d) => {
  if (!d) return "—";
  try {
    return moment(d).format("jYYYY/jMM/jDD");
  } catch {
    return "—";
  }
};

/**
 * @param {Object} options
 * @param {Array}  options.rows         - the valet rows to print
 * @param {Object} options.totals       - { count, totalDeposit, totalWithdraw, net }
 * @param {Object} options.filters      - { holderName, type, source, from, to, search }
 */
export function printValetsReport({
  rows = [],
  totals: providedTotals = {},
  filters = {},
}) {
  if (!rows.length) {
    alert("داده‌ای برای چاپ وجود ندارد");
    return;
  }

  /* ✅ Compute totals from rows if not provided */
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
    totalDeposit:
      providedTotals.totalDeposit ?? computedTotals.totalDeposit,
    totalWithdraw:
      providedTotals.totalWithdraw ?? computedTotals.totalWithdraw,
    net: providedTotals.net ?? computedTotals.net,
  };

  /* ✅ Shamsi issue date */
  const todayShamsi = moment().format("jYYYY/jMM/jDD");

  /* ---- Filter line for the header ---- */
  const filterParts = [];
  if (filters.holderName) filterParts.push(`حامل: ${filters.holderName}`);
  if (filters.type) {
    filterParts.push(
      `نوع: ${filters.type === "deposit" ? "واریز" : "برداشت"}`
    );
  }
  if (filters.source) {
    filterParts.push(
      `منبع: ${filters.source === "valet" ? "والټ" : "کسب‌وکار"}`
    );
  }
  if (filters.from) filterParts.push(`از: ${formatShamsi(filters.from)}`);
  if (filters.to) filterParts.push(`تا: ${formatShamsi(filters.to)}`);
  if (filters.search) filterParts.push(`جستجو: ${filters.search}`);
  filterParts.push(`تاریخ چاپ: ${todayShamsi}`);

  /* ---- Build the table rows ---- */
  const rowsHtml = rows
    .map((v) => {
      const holderName = v.holderInfo?.fullName || `#${v.holder}`;
      const holderNic = v.holderInfo?.NIC || "";
      const typeLabel = v.type === "deposit" ? "واریز" : "برداشت";
      const sourceLabel = v.source
        ? v.source === "valet"
          ? "از والټ"
          : "از کسب‌وکار"
        : "—";
      const sign = v.type === "deposit" ? "+" : "−";

      return `
        <tr>
          <td>#${v.id}</td>
          <td>
            <div class="name">${holderName}</div>
            ${holderNic ? `<div class="nic">${holderNic}</div>` : ""}
          </td>
          <td>
            <span class="badge ${v.type}">${typeLabel}</span>
            ${v.type === "withdraw" && v.source ? `<div class="src">${sourceLabel}</div>` : ""}
          </td>
          <td class="amount ${v.type}">${sign}${fmt(v.amount)}</td>
          <td class="desc">${v.description || "—"}</td>
          <td class="date">${formatDate(v.createdAt)}</td>
        </tr>
      `;
    })
    .join("");

  /* ---- Full HTML ---- */
  const html = `
  <!DOCTYPE html>
  <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>گزارش تراکنش‌ها - ${todayShamsi}</title>
      <link
        href="https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font/dist/font-face.css"
        rel="stylesheet"
        type="text/css"
      />
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: "Vazirmatn", "Vazir", "Segoe UI", Tahoma, sans-serif;
          color: #1f2937;
          margin: 24px;
          font-size: 12px;
        }
        h1 {
          font-size: 18px;
          margin: 0 0 6px 0;
          color: #1e40af;
        }
        .meta {
          color: #6b7280;
          font-size: 11px;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #1e40af;
        }

        /* ✅ Summary tiles above the table */
        .summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        .summary .tile {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          background: #fafafa;
        }
        .summary .tile .label {
          color: #6b7280;
          font-size: 10px;
          margin-bottom: 6px;
        }
        .summary .tile .value {
          font-size: 14px;
          font-weight: bold;
          color: #1f2937;
        }
        .summary .tile.deposit {
          background: #ecfdf5;
          border-color: #a7f3d0;
        }
        .summary .tile.deposit .value { color: #047857; }
        .summary .tile.withdraw {
          background: #fef2f2;
          border-color: #fecaca;
        }
        .summary .tile.withdraw .value { color: #b91c1c; }
        .summary .tile.net {
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        .summary .tile.net .value { color: #1e40af; }
        .summary .tile.net.negative {
          background: #fef2f2;
          border-color: #fecaca;
        }
        .summary .tile.net.negative .value { color: #b91c1c; }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        thead {
          background: #1e40af;
          color: white;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 6px 8px;
          text-align: right;
          vertical-align: middle;
        }
        th { font-weight: 600; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        td.amount { font-weight: bold; font-family: "Courier New", monospace; }
        td.amount.deposit { color: #047857; }
        td.amount.withdraw { color: #b91c1c; }
        td.desc { max-width: 200px; }
        td.date { white-space: nowrap; }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
        }
        .badge.deposit { background: #d1fae5; color: #065f46; }
        .badge.withdraw { background: #fee2e2; color: #991b1b; }
        .nic {
          color: #6b7280;
          font-size: 10px;
          font-family: monospace;
          direction: ltr;
          text-align: right;
        }
        .src {
          color: #6b7280;
          font-size: 10px;
          margin-top: 2px;
        }
        .name { font-weight: 600; }

        /* Footer with net summary */
        .footer-note {
          margin-top: 18px;
          padding: 10px 12px;
          background: #f3f4f6;
          border-radius: 8px;
          text-align: center;
          font-size: 11px;
          color: #6b7280;
        }
        .footer-note strong {
          color: #1e40af;
        }

        @media print {
          body { margin: 12mm; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      </style>
    </head>
    <body>
      <h1>گزارش تراکنش‌های سهام‌داران</h1>
      <div class="meta">${filterParts.join(" • ")}</div>

      <!-- ✅ Summary tiles -->
      <div class="summary">
        <div class="tile">
          <div class="label">تعداد تراکنش‌ها</div>
          <div class="value">${fmt(totals.count)}</div>
        </div>
        <div class="tile deposit">
          <div class="label">مجموع واریز</div>
          <div class="value">${fmt(totals.totalDeposit)} افغانی</div>
        </div>
        <div class="tile withdraw">
          <div class="label">مجموع برداشت</div>
          <div class="value">${fmt(totals.totalWithdraw)} افغانی</div>
        </div>
        <div class="tile net ${
          Number(totals.net) >= 0 ? "" : "negative"
        }">
          <div class="label">خالص</div>
          <div class="value">${fmt(totals.net)} افغانی</div>
        </div>
      </div>

      <!-- Table -->
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>حامل</th>
            <th>نوع</th>
            <th>مبلغ</th>
            <th>توضیحات</th>
            <th>تاریخ</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <!-- Footer with quick summary -->
      <div class="footer-note">
        تعداد کل: <strong>${fmt(totals.count)}</strong> تراکنش &nbsp;•&nbsp;
        خالص نهایی: <strong>${fmt(totals.net)} افغانی</strong>
      </div>
    </body>
  </html>
  `;

  /* ---- Open in a new window and print ---- */
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("لطفاً اجازه دسترسی به پنجره‌های بازشو را بدهید");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  win.onload = () => {
    win.focus();
    // Small delay to let fonts render
    setTimeout(() => {
      win.print();
    }, 300);
  };

  /* Fallback for some browsers */
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (_) {
      /* already printed or blocked */
    }
  }, 800);
}