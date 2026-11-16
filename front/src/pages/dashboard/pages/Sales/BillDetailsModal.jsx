// components/stock/BillDetailsModal.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaTimes, FaSpinner, FaCheckCircle, FaClock, FaBan } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BILL_API = `${BASE_URL}/bill`;

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const formatNum = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    parseFloat(n) || 0
  );

// ─── Carpet helpers ───────────────────────────────────────────────────────
const sellCategoryName = (s) =>
  s.category?.name || s.categoryDetail?.name || "---";
const sellTypeName = (s) =>
  s.type?.name || s.categoryDetail?.type?.name || "---";

// ─── Blanket helpers ──────────────────────────────────────────────────────
const bsaleCategoryName = (b) =>
  b.category?.name || b.categoryDetail?.name || "---";
const bsaleTypeName = (b) =>
  b.type?.name || b.category?.type?.name || "---";

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

const BillDetailsModal = ({ billId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bill, setBill] = useState(null);

  useEffect(() => {
    if (!billId) return;
    let cancelled = false;

    const fetchDetails = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${BILL_API}/${billId}/details`);
        if (!cancelled) setBill(res.data);
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

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [billId]);

  // Close on ESC
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sells = bill?.sellRecords || bill?.sells || [];
  const bsales = bill?.bsaleRecords || bill?.bsales || [];
  const hasSells = Array.isArray(sells) && sells.length > 0;
  const hasBSales = Array.isArray(bsales) && bsales.length > 0;
  const billSymbol = symbolFor(bill?.isAfn);

  const sellTotalSum = sells.reduce(
    (s, r) => s + (parseFloat(r.total) || 0),
    0
  );
  const bsaleTotalSum = bsales.reduce(
    (s, r) => s + (parseFloat(r.total) || 0),
    0
  );

  return (
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
  onClick={onClose}
  dir="rtl"
>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
                جزئیات فاکتور{" "}
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

        {/* Body */}
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
              {/* ─── Bill header info ─────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">خریدار</div>
                  <div className="font-bold text-gray-800">
                    {bill.buyer?.fullname || "—"}
                  </div>
                  {bill.buyer?.phoneNumber && (
                    <div className="text-sm text-gray-500 mt-1" dir="ltr">
                      {bill.buyer.phoneNumber}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">
                    تاریخ / وضعیت
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-gray-800 font-medium">
                      {new Date(bill.date).toLocaleDateString("fa-IR")}
                    </span>
                    <StatusBadge status={bill.status} />
                  </div>
                </div>
              </div>

              {/* ─── Financial summary ────────────────────────────── */}
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

              {/* ─── Carpet section ──────────────────────────────── */}
              {hasSells && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-5 bg-cyan-600 rounded" />
                      فروش فرش ({sells.length} قلم)
                    </h3>
                    <div className="text-sm text-gray-600">
                      جمع این بخش:{" "}
                      <span className="font-bold text-cyan-800">
                        {formatNum(sellTotalSum)} {billSymbol}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-cyan-50 text-cyan-800">
                        <tr>
                          <th className="p-2 border-b font-semibold">#</th>
                          <th className="p-2 border-b font-semibold">
                            کد کالا
                          </th>
                          <th className="p-2 border-b font-semibold">نوع</th>
                          <th className="p-2 border-b font-semibold">
                            دسته‌بندی
                          </th>
                          <th className="p-2 border-b font-semibold">رنگ</th>
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
                        {sells.map((sell, idx) => (
                          <tr
                            key={sell.id}
                            className="hover:bg-gray-50 border-b last:border-0"
                          >
                            <td className="p-2 text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-mono text-xs">
                              {sell.income?.lotNumber ||
                                sell.incomeId ||
                                "—"}
                            </td>
                            <td className="p-2">{sellTypeName(sell)}</td>
                            <td className="p-2">
                              {sellCategoryName(sell)}
                            </td>
                            <td className="p-2">
                              {sell.income?.color || "—"}
                            </td>
                            <td className="p-2">{sell.length}</td>
                            <td className="p-2">{sell.area}</td>
                            <td className="p-2">
                              {formatNum(sell.unit_price)}
                            </td>
                            <td className="p-2 font-bold text-cyan-800">
                              {formatNum(sell.total)} {billSymbol}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── Blanket section ─────────────────────────────── */}
              {hasBSales && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-5 bg-indigo-600 rounded" />
                      فروش بلنکت ({bsales.length} قلم)
                    </h3>
                    <div className="text-sm text-gray-600">
                      جمع این بخش:{" "}
                      <span className="font-bold text-indigo-800">
                        {formatNum(bsaleTotalSum)} {billSymbol}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-indigo-50 text-indigo-800">
                        <tr>
                          <th className="p-2 border-b font-semibold">#</th>
                          <th className="p-2 border-b font-semibold">
                            شناسه موجودی
                          </th>
                          <th className="p-2 border-b font-semibold">نوع</th>
                          <th className="p-2 border-b font-semibold">
                            دسته‌بندی
                          </th>
                          <th className="p-2 border-b font-semibold">
                            تعداد
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
                        {bsales.map((b, idx) => (
                          <tr
                            key={b.id}
                            className="hover:bg-gray-50 border-b last:border-0"
                          >
                            <td className="p-2 text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-mono text-xs">
                              {b.bExist?.id || b.bexistId || "—"}
                            </td>
                            <td className="p-2">{bsaleTypeName(b)}</td>
                            <td className="p-2">{bsaleCategoryName(b)}</td>
                            <td className="p-2">{b.quantity}</td>
                            <td className="p-2">
                              {formatNum(b.unit_price)}
                            </td>
                            <td className="p-2 font-bold text-indigo-800">
                              {formatNum(b.total)} {billSymbol}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── Empty state ─────────────────────────────────── */}
              {!hasSells && !hasBSales && (
                <div className="text-center py-12 text-gray-500">
                  هیچ قلم فروشی برای این فاکتور ثبت نشده است.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
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

export default BillDetailsModal;