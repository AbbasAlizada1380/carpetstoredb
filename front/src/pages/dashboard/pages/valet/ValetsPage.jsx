// src/components/wallet/ValetsPage.jsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import moment from "moment"; // ✅ Removed jalaali import
import DatePicker from "react-multi-date-picker";
import gregorian from "react-date-object/calendars/gregorian"; // ✅ Import Gregorian calendar
import gregorian_en from "react-date-object/locales/gregorian_en"; // ✅ Import English/Gregorian locale
import Pagination from "../../pagination/Pagination.jsx";
import { printValetsReport } from "./printValetsReport";
import { downloadValetsReportPDF } from "./downloadValetsReportPDF";
import {
  FaExchangeAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaSpinner,
  FaCheckCircle,
  FaArrowUp,
  FaArrowDown,
  FaFilter,
  FaUserTie,
  FaPrint,
  FaDownload,
} from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const LIMIT = 20;

/* ---------------- helpers ---------------- */
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "۰ افغانی";
  return new Intl.NumberFormat("en-US").format(Number(amount)) + " افغانی";
};

/* ✅ Gregorian date-time formatter */
const formatDate = (d) => {
  if (!d) return "—";
  try {
    return moment(d).format("YYYY/MM/DD HH:mm"); // ✅ Changed to Gregorian format
  } catch {
    return "—";
  }
};

/* ✅ Convert JS Date or ISO → "YYYY-MM-DD" for API */
const toISODate = (d) => {
  if (!d) return "";
  try {
    const m = moment(d);
    if (!m.isValid()) return "";
    return m.format("YYYY-MM-DD");
  } catch {
    return "";
  }
};

const typeBadge = (type) => {
  if (type === "deposit") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 whitespace-nowrap">
        <FaArrowDown className="text-[10px]" />
        واریز
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap">
      <FaArrowUp className="text-[10px]" />
      برداشت
    </span>
  );
};

const sourceLabel = (source) => {
  if (!source) return null;
  return (
    <span className="text-[10px] text-gray-500">
      {source === "valet" ? "از والټ" : "از کسب‌وکار"}
    </span>
  );
};

export default function ValetsPage({ refreshKey = 0, onChanged }) {
  /* ---------- list state ---------- */
  const [valets, setValets] = useState([]);
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totals, setTotals] = useState({
    count: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    net: 0,
  });
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /* ---------- filters ---------- */
  const [filterHolder, setFilterHolder] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  /* ✅ from / to are JS Date objects */
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  /* ---------- form modal ---------- */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    holder: "",
    type: "deposit",
    source: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  /* ---------------- load holders ---------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(
          `${BASE_URL}/holders?page=1&limit=500`
        );
        setHolders(res.data.holders || []);
      } catch (err) {
        /* ignore */
      }
    };
    load();
  }, [refreshKey]);

  /* ---------------- fetch valets ---------------- */
  const fetchValets = useCallback(
    async (p = 1) => {
      try {
        setLoading(true);
        setError(null);

        const params = { page: p, limit: LIMIT };
        if (filterHolder) params.holder = filterHolder;
        if (filterType) params.type = filterType;
        if (filterSource) params.source = filterSource;
        if (from) params.from = toISODate(from);
        if (to) params.to = toISODate(to);

        const res = await axios.get(`${BASE_URL}/valets`, { params });
        setValets(res.data.valets || []);
        setPage(res.data.pagination?.currentPage || p);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalItems(res.data.pagination?.totalItems || 0);
        setTotals(
          res.data.totals || {
            count: 0,
            totalDeposit: 0,
            totalWithdraw: 0,
            net: 0,
          }
        );
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "خطا در دریافت تراکنش‌ها"
        );
        setValets([]);
      } finally {
        setLoading(false);
      }
    },
    [filterHolder, filterType, filterSource, from, to]
  );

  useEffect(() => {
    fetchValets(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterHolder, filterType, filterSource, from, to, refreshKey]);

  /* ---------------- form handlers ---------------- */
  const resetForm = () => {
    setForm({
      amount: "",
      holder: "",
      type: "deposit",
      source: "",
      description: "",
    });
    setEditingId(null);
    setFormError(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (valet) => {
    setForm({
      amount: String(valet.amount),
      holder: String(valet.holder),
      type: valet.type,
      source: valet.source || "",
      description: valet.description || "",
    });
    setEditingId(valet.id);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError("مبلغ نامعتبر است");
      return;
    }
    if (!form.holder) {
      setFormError("انتخاب حامل الزامی است");
      return;
    }
    if (form.type === "withdraw" && !form.source) {
      setFormError("برای برداشت، انتخاب منبع الزامی است");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: amt,
        holder: Number(form.holder),
        type: form.type,
        source: form.type === "withdraw" ? form.source : null,
        description: form.description.trim() || null,
      };

      if (editingId) {
        await axios.put(`${BASE_URL}/valets/${editingId}`, payload);
      } else {
        await axios.post(`${BASE_URL}/valets`, payload);
      }

      closeForm();
      fetchValets(editingId ? page : 1);
      onChanged?.();

      setSuccessMessage(
        editingId ? "تغییرات ذخیره شد" : "تراکنش جدید ثبت شد"
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
          err.message ||
          "خطا در ذخیره تراکنش"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این تراکنش اطمینان دارید؟")) return;
    try {
      await axios.delete(`${BASE_URL}/valets/${id}`);
      fetchValets(page);
      onChanged?.();
      setSuccessMessage("تراکنش حذف شد");
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "خطا در حذف تراکنش"
      );
    }
  };

  const clearFilters = () => {
    setFilterHolder("");
    setFilterType("");
    setFilterSource("");
    setFrom(null);
    setTo(null);
  };

  const hasFilters =
    filterHolder || filterType || filterSource || from || to;

  /* ---------------- print ---------------- */
  const handlePrint = async () => {
    try {
      setPrinting(true);
      const params = { page: 1, limit: 10000 };
      if (filterHolder) params.holder = filterHolder;
      if (filterType) params.type = filterType;
      if (filterSource) params.source = filterSource;
      if (from) params.from = toISODate(from);
      if (to) params.to = toISODate(to);

      const res = await axios.get(`${BASE_URL}/valets`, { params });
      const allRows = res.data.valets || [];

      if (allRows.length === 0) {
        alert("داده‌ای برای چاپ وجود ندارد");
        return;
      }

      const holderName = filterHolder
        ? holders.find((h) => String(h.id) === String(filterHolder))
            ?.fullName
        : null;

      printValetsReport({
        rows: allRows,
        totals: res.data.totals || totals,
        filters: {
          holderName,
          type: filterType || null,
          source: filterSource || null,
          from: from ? toISODate(from) : null,
          to: to ? toISODate(to) : null,
        },
      });
    } catch (err) {
      alert("خطا در آماده‌سازی گزارش");
    } finally {
      setPrinting(false);
    }
  };

  /* ---------------- PDF download ---------------- */
  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      const params = { page: 1, limit: 10000 };
      if (filterHolder) params.holder = filterHolder;
      if (filterType) params.type = filterType;
      if (filterSource) params.source = filterSource;
      if (from) params.from = toISODate(from);
      if (to) params.to = toISODate(to);

      const res = await axios.get(`${BASE_URL}/valets`, { params });
      const allRows = res.data.valets || [];

      if (allRows.length === 0) {
        alert("داده‌ای برای دانلود وجود ندارد");
        return;
      }

      const holderName = filterHolder
        ? holders.find((h) => String(h.id) === String(filterHolder))
            ?.fullName
        : null;

      downloadValetsReportPDF({
        rows: allRows,
        totals: res.data.totals || totals,
        filters: {
          holderName,
          type: filterType || null,
          source: filterSource || null,
          from: from ? toISODate(from) : null,
          to: to ? toISODate(to) : null,
        },
      });
    } catch (err) {
      alert("خطا در آماده‌سازی گزارش");
    } finally {
      setDownloading(false);
    }
  };

  /* ---------------- render ---------------- */
  return (
    <div className="space-y-3">
      {/* Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50 animate-slideDown">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaCheckCircle className="text-green-600" />
              </div>
              <p className="flex-1 text-green-700">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="p-1 hover:bg-green-100 rounded-lg transition-colors"
              >
                <FaTimes className="text-green-600 text-sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 md:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-xl flex-shrink-0">
                <FaExchangeAlt className="text-primary text-lg" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm md:text-base font-bold text-gray-900 truncate">
                  تراکنش‌ها
                </h2>
                <p className="text-[11px] md:text-xs text-gray-500">
                  {totalItems} تراکنش
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition ${
                  showFilters || hasFilters
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <FaFilter className="text-xs" />
                <span className="hidden sm:inline">فیلترها</span>
                {hasFilters && (
                  <span className="bg-white/25 text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                    {
                      [
                        filterHolder,
                        filterType,
                        filterSource,
                        from,
                        to,
                      ].filter(Boolean).length
                    }
                  </span>
                )}
              </button>

              <button
                onClick={handlePrint}
                disabled={printing || totalItems === 0}
                className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition ${
                  printing || totalItems === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title="چاپ گزارش"
              >
                {printing ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaPrint />
                )}
                <span className="hidden sm:inline">چاپ</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={downloading || totalItems === 0}
                className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition ${
                  downloading || totalItems === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title="دانلود PDF"
              >
                {downloading ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaDownload />
                )}
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                onClick={openAdd}
                className="px-3 md:px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl hover:opacity-90 transition flex items-center gap-2 shadow-sm text-xs md:text-sm"
              >
                <FaPlus />
                <span className="hidden sm:inline">افزودن تراکنش</span>
                <span className="sm:hidden">افزودن</span>
              </button>
            </div>
          </div>

          {/* ✅ Filter panel with Gregorian pickers */}
          {showFilters && (
            <div className="pt-3 border-t border-gray-100">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
  {/* Holder */}
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      حامل
    </label>
    <select
      value={filterHolder}
      onChange={(e) => setFilterHolder(e.target.value)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary"
    >
      <option value="">همه سهام داران</option>
      {holders.map((h) => (
        <option key={h.id} value={h.id}>
          {h.fullName}
        </option>
      ))}
    </select>
  </div>

  {/* Type */}
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      نوع
    </label>
    <select
      value={filterType}
      onChange={(e) => {
        const v = e.target.value;
        setFilterType(v);
        if (v !== "withdraw") setFilterSource("");
      }}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary"
    >
      <option value="">همه</option>
      <option value="deposit">واریز</option>
      <option value="withdraw">برداشت</option>
    </select>
  </div>

  {/* Source */}
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      منبع
    </label>
    <select
      value={filterSource}
      onChange={(e) => setFilterSource(e.target.value)}
      disabled={filterType !== "" && filterType !== "withdraw"}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-400"
    >
      <option value="">همه</option>
      <option value="valet">والټ (شخصی)</option>
      <option value="business">کسب‌وکار</option>
    </select>
  </div>

  {/* ✅ From — Standard HTML date input */}
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      از تاریخ
    </label>
    <input
      type="date"
      value={from ? moment(from).format("YYYY-MM-DD") : ""}
      onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : null)}
      max={to ? moment(to).format("YYYY-MM-DD") : undefined}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
    />
  </div>

  {/* ✅ To — Standard HTML date input */}
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      تا تاریخ
    </label>
    <input
      type="date"
      value={to ? moment(to).format("YYYY-MM-DD") : ""}
      onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : null)}
      min={from ? moment(from).format("YYYY-MM-DD") : undefined}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
    />
  </div>
</div>

              {hasFilters && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={clearFilters}
                    className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition flex items-center gap-1"
                  >
                    <FaTimes className="text-[10px]" />
                    پاک کردن فیلترها
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-1">
            تعداد تراکنش
          </p>
          <p className="text-base md:text-xl font-bold text-gray-900">
            {totals.count}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-emerald-600 mb-1">
            مجموع واریز
          </p>
          <p className="text-xs md:text-lg font-bold text-emerald-700 whitespace-nowrap">
            {formatCurrency(totals.totalDeposit)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-red-600 mb-1">
            مجموع برداشت
          </p>
          <p className="text-xs md:text-lg font-bold text-red-700 whitespace-nowrap">
            {formatCurrency(totals.totalWithdraw)}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-3 md:p-4 ${
            totals.net >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-[10px] md:text-xs text-gray-600 mb-1">خالص</p>
          <p
            className={`text-xs md:text-lg font-bold whitespace-nowrap ${
              totals.net >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatCurrency(totals.net)}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-14 text-center">
            <FaSpinner className="text-3xl text-primary animate-spin mx-auto mb-3" />
            <p className="text-gray-600 text-sm">در حال بارگذاری...</p>
          </div>
        ) : valets.length === 0 ? (
          <div className="py-14 text-center px-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <FaExchangeAlt className="text-primary text-xl" />
            </div>
            <p className="text-gray-500 text-sm">
              هیچ تراکنشی ثبت نشده است
            </p>
            <p className="text-gray-400 text-xs mt-1">
              برای شروع، روی «افزودن تراکنش» کلیک کنید
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary to-primary/80">
                <tr>
                  <th className="px-3 md:px-4 py-3 text-right text-[10px] md:text-xs font-semibold text-white uppercase whitespace-nowrap">
                    #
                  </th>
                  <th className="px-3 md:px-4 py-3 text-right text-[10px] md:text-xs font-semibold text-white uppercase">
                    حامل
                  </th>
                  <th className="px-3 md:px-4 py-3 text-right text-[10px] md:text-xs font-semibold text-white uppercase">
                    نوع
                  </th>
                  <th className="px-3 md:px-4 py-3 text-right text-[10px] md:text-xs font-semibold text-white uppercase">
                    مبلغ
                  </th>
                  <th className="px-3 md:px-4 py-3 text-right text-[10px] md:text-xs font-semibold text-white uppercase hidden lg:table-cell">
                    توضیحات
                  </th>
                  <th className="px-3 md:px-4 py-3 text-right text-[10px] md:text-xs font-semibold text-white uppercase whitespace-nowrap hidden md:table-cell">
                    تاریخ
                  </th>
                  <th className="px-3 md:px-4 py-3 text-center text-[10px] md:text-xs font-semibold text-white uppercase">
                    عملیات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {valets.map((v) => (
                  <tr key={v.id} className="hover:bg-primary/5 transition">
                    <td className="px-3 md:px-4 py-3 text-xs md:text-sm font-semibold text-primary whitespace-nowrap">
                      #{v.id}
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-full flex-shrink-0">
                          <FaUserTie className="text-primary text-xs" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs md:text-sm font-medium text-gray-900 truncate">
                            {v.holderInfo?.fullName || `#${v.holder}`}
                          </div>
                          {v.holderInfo?.NIC && (
                            <div
                              className="text-[10px] text-gray-500 font-mono"
                              dir="ltr"
                            >
                              {v.holderInfo.NIC}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {typeBadge(v.type)}
                        {v.type === "withdraw" && sourceLabel(v.source)}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                      <div
                        className={`text-xs md:text-sm font-bold ${
                          v.type === "deposit"
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {v.type === "deposit" ? "+" : "−"}
                        {formatCurrency(v.amount)}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3 text-xs text-gray-600 hidden lg:table-cell max-w-xs">
                      {v.description ? (
                        <span
                          className="block truncate"
                          title={v.description}
                        >
                          {v.description}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    {/* ✅ Gregorian date */}
                    <td className="px-3 md:px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap hidden md:table-cell">
                      {formatDate(v.createdAt)}
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      <div className="flex items-center justify-center gap-1 md:gap-2">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 md:p-2 text-primary hover:bg-primary/10 rounded-lg transition"
                          title="ویرایش"
                        >
                          <FaEdit className="text-xs md:text-sm" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="حذف"
                        >
                          <FaTrash className="text-xs md:text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && !loading && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => fetchValets(p)}
            />
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <FaExchangeAlt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold">
                    {editingId ? "ویرایش تراکنش" : "افزودن تراکنش"}
                  </h3>
                  <p className="text-xs text-white/80">
                    {editingId
                      ? `ویرایش تراکنش #${editingId}`
                      : "ثبت یک واریز یا برداشت جدید"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeForm}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="بستن"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6">
              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> نوع تراکنش
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, type: "deposit", source: "" })
                      }
                      className={`flex-1 px-3 py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                        form.type === "deposit"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      disabled={submitting}
                    >
                      <FaArrowDown />
                      واریز
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "withdraw" })}
                      className={`flex-1 px-3 py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                        form.type === "withdraw"
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      disabled={submitting}
                    >
                      <FaArrowUp />
                      برداشت
                    </button>
                  </div>
                </div>

                {/* Source — only for withdraw */}
                {form.type === "withdraw" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> منبع برداشت
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, source: "valet" })}
                        className={`flex-1 px-3 py-2.5 rounded-xl font-medium transition ${
                          form.source === "valet"
                            ? "bg-primary text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        disabled={submitting}
                      >
                        والټ (شخصی)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, source: "business" })
                        }
                        className={`flex-1 px-3 py-2.5 rounded-xl font-medium transition ${
                          form.source === "business"
                            ? "bg-primary text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        disabled={submitting}
                      >
                        کسب‌وکار
                      </button>
                    </div>
                  </div>
                )}

                {/* Holder */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500">*</span> حامل
                  </label>
                  <select
                    value={form.holder}
                    onChange={(e) =>
                      setForm({ ...form, holder: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={submitting}
                    required
                  >
                    <option value="">انتخاب حامل...</option>
                    {holders.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.fullName} — {h.NIC}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500">*</span> مبلغ (افغانی)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="۰"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={submitting}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    توضیحات (اختیاری)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={2}
                    placeholder="مثال: پرداخت قسط اول"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                    disabled={submitting}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={submitting}
                    className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium flex items-center gap-2"
                  >
                    <FaTimes />
                    لغو
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-5 py-2.5 rounded-xl font-medium shadow-md transition flex items-center gap-2 ${
                      submitting
                        ? "bg-gray-400 cursor-not-allowed text-white"
                        : "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 text-white"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <FaSpinner className="animate-spin h-4 w-4" />
                        در حال ذخیره...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle />
                        {editingId ? "ذخیره تغییرات" : "ثبت تراکنش"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}