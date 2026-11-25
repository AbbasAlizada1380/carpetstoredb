// components/accounting/IncomeBillManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaEye,
  FaTrash,
  FaSpinner,
  FaTimes,
  FaPlus,
  FaCheckCircle,
  FaClock,
  FaBan,
} from "react-icons/fa";
import Pagination from "../../../pagination/Pagination";
import IncomeBillDetailsModal from "./IncomeBillDetailsModal";
import IncomeBillDateDownload from "../../report/IncomeBillDateDownload";
import SingleIncomeBillDownload from "../../report/SingleIncomeBillDownload";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE = `${BASE_URL}/incomebill`;

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const formatNum = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    parseFloat(n) || 0
  );

const StatusBadge = ({ status }) => {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
        <FaCheckCircle className="text-xs" /> پرداخت شده
      </span>
    );
  if (status === "partial")
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium">
        <FaClock className="text-xs" /> جزئی
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium">
      <FaBan className="text-xs" /> پرداخت نشده
    </span>
  );
};

const IncomeBillManager = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewingBillId, setViewingBillId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchBills = async (currentPage = page, itemsPerPage = limit) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (statusFilter) params.status = statusFilter;
      if (currencyFilter !== "") params.isAfn = currencyFilter === "afn";

      const res = await axios.get(API_BASE, { params });
      const { data, pagination } = res.data;
      setBills(data || []);
      setTotalItems(pagination?.totalItems || 0);
      setTotalPages(pagination?.totalPages || 1);
      setPage(pagination?.currentPage || 1);
    } catch (err) {
      setError(err.response?.data?.message || "بارگیری فاکتورها ناکام ماند");
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, currencyFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این فاکتور مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/${id}`);
      if (bills.length === 1 && page > 1) setPage(page - 1);
      else fetchBills(page, limit);
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchBills(newPage, limit);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8"
      dir="rtl"
    >
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          مدیریت فاکتورهای ورودی
        </h1>
        <p className="text-gray-600">
          مشاهده و مدیریت فاکتورهای خرید از مشتریان
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">وضعیت:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">همه</option>
            <option value="paid">پرداخت شده</option>
            <option value="partial">جزئی</option>
            <option value="unpaid">پرداخت نشده</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">واحد پول:</label>
          <select
            value={currencyFilter}
            onChange={(e) => {
              setCurrencyFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">همه</option>
            <option value="afn">افغانی (؋)</option>
            <option value="usd">دالر ($)</option>
          </select>
        </div>
        <div className="text-sm text-gray-500 mr-auto">
          مجموع رکوردها:{" "}
          <span className="font-semibold text-cyan-700">{totalItems}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex items-center justify-between">
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
                <h2 className="text-xl font-bold">لیست فاکتورهای ورودی</h2>
                <p className="text-sm text-white/80">
                  {totalItems} فاکتور ثبت شده
                </p>
              </div>
              <div>
                <IncomeBillDateDownload/>
               
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                <FaSpinner className="animate-spin" /> در حال بارگذاری...
              </div>
            )}
          </div>
        </div>

        {loading && bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری فاکتورها...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            هیچ فاکتوری ثبت نشده است
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-blue-50 text-cyan-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شماره فاکتور</th>
                    <th className="p-3 border-b font-semibold">مشتری</th>
                    <th className="p-3 border-b font-semibold">تاریخ</th>
                    <th className="p-3 border-b font-semibold">واحد</th>
                    <th className="p-3 border-b font-semibold">نرخ دالر</th>
                    <th className="p-3 border-b font-semibold">جمع کل</th>
                    <th className="p-3 border-b font-semibold">پرداخت شده</th>
                    <th className="p-3 border-b font-semibold">باقیمانده</th>
                    <th className="p-3 border-b font-semibold">وضعیت</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="hover:bg-gray-50 border-b last:border-0 transition-colors"
                    >
                      <td className="p-3 font-mono text-sm">
                        {bill.billNumber}
                      </td>
                      <td className="p-3 font-medium text-gray-800">
                        {bill.customer?.fullname || "—"}
                      </td>
                      <td className="p-3 text-gray-600">
                        {new Date(bill.createdAt).toLocaleDateString("fa-IR")}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bill.isAfn
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                            }`}
                        >
                          {symbolFor(bill.isAfn)}{" "}
                          {currencyLabel(bill.isAfn)}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{bill.DV ?? "—"}</td>
                      <td className="p-3">
                        {formatNum(bill.totalAmount)} {symbolFor(bill.isAfn)}
                      </td>
                      <td className="p-3">
                        {formatNum(bill.paidAmount)} {symbolFor(bill.isAfn)}
                      </td>
                      <td className="p-3">
                        {formatNum(bill.remainingAmount)}{" "}
                        {symbolFor(bill.isAfn)}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={bill.status} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setViewingBillId(bill.id)}
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="مشاهده جزئیات"
                          >
                            <FaEye />
                          </button>
                          <SingleIncomeBillDownload billId={bill.id} />
                          <button
                            onClick={() => handleDelete(bill.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="حذف"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <div className="text-center text-gray-500 text-sm py-2 border-t">
              مجموع {totalItems} فاکتور | صفحه {page} از {totalPages}
            </div>
          </>
        )}
      </div>

      {/* Details modal */}
      {viewingBillId && (
        <IncomeBillDetailsModal
          incomeBillId={viewingBillId}
          onClose={() => setViewingBillId(null)}
        />
      )}
    </div>
  );
};

export default IncomeBillManager;