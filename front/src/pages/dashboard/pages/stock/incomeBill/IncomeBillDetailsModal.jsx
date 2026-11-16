// components/accounting/IncomeBillDetailsModal.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaTimes,
  FaSpinner,
  FaCheckCircle,
  FaClock,
  FaBan,
} from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE = `${BASE_URL}/incomebill`;

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const formatNum = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    parseFloat(n) || 0
  );

const StatusBadge = ({ status }) => {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
        <FaCheckCircle /> پرداخت شده
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
        <FaClock /> پرداخت جزئی
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
      <FaBan /> پرداخت نشده
    </span>
  );
};

// ─── Income helpers ───────────────────────────────────────────────────────
const incomeCategoryName = (i) =>
  i.category?.name || i.categoryDetail?.name || "—";
const incomeTypeName = (i) =>
  i.type?.name || i.category?.type?.name || i.categoryDetail?.type?.name || "—";

// ─── Bincome helpers ──────────────────────────────────────────────────────
const bincomeCategoryName = (b) =>
  b.category?.name || b.categoryDetail?.name || "—";
const bincomeTypeName = (b) =>
  b.type?.name || b.category?.type?.name || b.categoryDetail?.type?.name || "—";

const IncomeBillDetailsModal = ({ incomeBillId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bill, setBill] = useState(null);

  useEffect(() => {
    if (!incomeBillId) return;
    let cancelled = false;

    const fetchBill = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE}/${incomeBillId}`);
        if (!cancelled) {
          setBill(res.data?.bill ?? res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || "بارگیری اطلاعات فاکتور ناکام ماند"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBill();
    return () => {
      cancelled = true;
    };
  }, [incomeBillId]);

  // ESC to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const incomes = bill?.incomeRecords || [];
  const bincomes = bill?.bincomeRecords || [];
  const hasIncomes = incomes.length > 0;
  const hasBIncomes = bincomes.length > 0;
  const billSymbol = symbolFor(bill?.isAfn);

  const incomeTotal = incomes.reduce(
    (s, r) => s + (parseFloat(r.totalPrice) || 0),
    0
  );
  const bincomeTotal = bincomes.reduce(
    (s, r) => s + (parseFloat(r.totalPrice) || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ──────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">
                جزئیات فاکتور ورودی{" "}
                {bill?.billNumber ? (
                  <span className="font-mono text-sm bg-white/20 px-2 py-0.5 rounded ml-2">
                    {bill.billNumber}
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-white/80">
                مشاهده اقلام و اطلاعات کامل فاکتور
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition"
            title="بستن"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
              <p className="text-gray-600">در حال بارگیری فاکتور...</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && bill && (
            <>
              {/* Customer + status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">مشتری</div>
                  <div className="font-bold text-gray-800">
                    {bill.customer?.fullname || "—"}
                  </div>
                  {bill.customer?.phoneNumber && (
                    <div className="text-sm text-gray-500 mt-1" dir="ltr">
                      {bill.customer.phoneNumber}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">
                    تاریخ / وضعیت
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-gray-800 font-medium">
                      {new Date(bill.createdAt).toLocaleDateString("fa-IR")}
                    </span>
                    <StatusBadge status={bill.status} />
                  </div>
                </div>
              </div>

              {/* Financial summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <div className="text-xs text-indigo-600 mb-1">
                    جمع کل فاکتور
                  </div>
                  <div className="text-lg font-bold text-indigo-800">
                    {formatNum(bill.totalAmount)} {billSymbol}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="text-xs text-emerald-600 mb-1">
                    پرداخت شده
                  </div>
                  <div className="text-lg font-bold text-emerald-800">
                    {formatNum(bill.paidAmount)} {billSymbol}
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <div className="text-xs text-red-600 mb-1">باقیمانده</div>
                  <div className="text-lg font-bold text-red-800">
                    {formatNum(bill.remainingAmount)} {billSymbol}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <div className="text-xs text-amber-600 mb-1">
                    تخفیف / واحد
                  </div>
                  <div className="text-sm font-bold text-amber-800">
                    {formatNum(bill.discounted_amount)} {billSymbol}
                    <span className="mx-1">•</span>
                    {currencyLabel(bill.isAfn)}
                  </div>
                  {parseFloat(bill.DV) > 0 && (
                    <div className="text-xs text-amber-600 mt-0.5">
                      نرخ دالر: {bill.DV}
                    </div>
                  )}
                </div>
              </div>

              {bill.notes && (
                <div className="mb-6 bg-blue-50 border-r-4 border-blue-400 text-blue-800 p-3 rounded-lg text-sm">
                  <strong className="ml-1">یادداشت:</strong> {bill.notes}
                </div>
              )}

              {/* ─── Carpet incomes ─────────────────────────────── */}
              {hasIncomes && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-5 bg-cyan-600 rounded" />
                      ورودی فرش ({incomes.length} قلم)
                    </h3>
                    <div className="text-sm text-gray-600">
                      جمع این بخش:{" "}
                      <span className="font-bold text-cyan-800">
                        {formatNum(incomeTotal)} {billSymbol}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-cyan-50 text-cyan-800">
                        <tr>
                          <th className="p-2 border-b font-semibold">#</th>
                          <th className="p-2 border-b font-semibold">
                            شماره لات
                          </th>
                          <th className="p-2 border-b font-semibold">نوع</th>
                          <th className="p-2 border-b font-semibold">
                            دسته‌بندی
                          </th>
                          <th className="p-2 border-b font-semibold">رنگ</th>
                          <th className="p-2 border-b font-semibold">عرض</th>
                          <th className="p-2 border-b font-semibold">طول</th>
                          <th className="p-2 border-b font-semibold">
                            مساحت
                          </th>
                          <th className="p-2 border-b font-semibold">
                            قیمت واحد
                          </th>
                          <th className="p-2 border-b font-semibold">
                            مبلغ کل
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomes.map((inc, idx) => (
                          <tr
                            key={inc.id}
                            className="hover:bg-gray-50 border-b last:border-0"
                          >
                            <td className="p-2 text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-mono text-xs">
                              {inc.lotNumber || "—"}
                            </td>
                            <td className="p-2">{incomeTypeName(inc)}</td>
                            <td className="p-2">{incomeCategoryName(inc)}</td>
                            <td className="p-2">{inc.color || "—"}</td>
                            <td className="p-2">{inc.width}</td>
                            <td className="p-2">{inc.length}</td>
                            <td className="p-2">{inc.area}</td>
                            <td className="p-2">
                              {formatNum(inc.unit_price)}
                            </td>
                            <td className="p-2 font-bold text-cyan-800">
                              {formatNum(inc.totalPrice)} {billSymbol}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── Blanket incomes ─────────────────────────────── */}
              {hasBIncomes && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-5 bg-indigo-600 rounded" />
                      ورودی بلنکت ({bincomes.length} قلم)
                    </h3>
                    <div className="text-sm text-gray-600">
                      جمع این بخش:{" "}
                      <span className="font-bold text-indigo-800">
                        {formatNum(bincomeTotal)} {billSymbol}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-indigo-50 text-indigo-800">
                        <tr>
                          <th className="p-2 border-b font-semibold">#</th>
                          <th className="p-2 border-b font-semibold">
                            شناسه
                          </th>
                          <th className="p-2 border-b font-semibold">نوع</th>
                          <th className="p-2 border-b font-semibold">
                            دسته‌بندی
                          </th>
                          <th className="p-2 border-b font-semibold">تعداد</th>
                          <th className="p-2 border-b font-semibold">وزن</th>
                          <th className="p-2 border-b font-semibold">
                            قیمت واحد
                          </th>
                          <th className="p-2 border-b font-semibold">
                            مبلغ کل
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bincomes.map((b, idx) => (
                          <tr
                            key={b.id}
                            className="hover:bg-gray-50 border-b last:border-0"
                          >
                            <td className="p-2 text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-mono text-xs">
                              #{b.id}
                            </td>
                            <td className="p-2">{bincomeTypeName(b)}</td>
                            <td className="p-2">{bincomeCategoryName(b)}</td>
                            <td className="p-2">{b.amount}</td>
                            <td className="p-2">{b.weight || "—"}</td>
                            <td className="p-2">
                              {formatNum(b.unitPrice)}
                            </td>
                            <td className="p-2 font-bold text-indigo-800">
                              {formatNum(b.totalPrice)} {billSymbol}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!hasIncomes && !hasBIncomes && (
                <div className="text-center py-12 text-gray-500">
                  هیچ قلم ورودی برای این فاکتور ثبت نشده است.
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <div className="border-t bg-gray-50 px-4 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomeBillDetailsModal;