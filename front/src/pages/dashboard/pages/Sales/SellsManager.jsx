// components/stock/SellManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaEdit,
  FaTrash,
  FaSpinner,
  FaPlus,
  FaTimes,
  FaPrint,
  FaLayerGroup,
} from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import SellForm from "./SellForm";
import BSaleForm from "./BSaleForm"; // 👈 import blanket form
import BillReportsDownload from "../report/BillReportsDownload";
import SingleBillDownload from "../report/SingleBillDownload";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BILL_API = `${BASE_URL}/bill`;

const SellManager = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // ─── Toggle: "carpet" or "blanket" ──────────────────────────────
  const [saleType, setSaleType] = useState("carpet"); // "carpet" | "blanket"

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch bills with pagination
  const fetchBills = async (page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    try {
      const response = await axios.get(BILL_API, { params: { page, limit } });
      const { bills: fetchedBills, pagination } = response.data;
      setBills(fetchedBills || []);
      setTotalItems(pagination.totalItems);
      setTotalPages(pagination.totalPages);
      setCurrentPage(pagination.currentPage);
      setError("");
    } catch (err) {
      setError("بارگیری فاکتورها ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage]);

  const handleEdit = async (bill) => {
    const newNotes = prompt("توضیحات / یادداشت جدید:", bill.notes || "");
    if (newNotes === null) return;
    setLoading(true);
    try {
      await axios.put(`${BILL_API}/${bill.id}`, { notes: newNotes.trim() || null });
      fetchBills(currentPage, itemsPerPage);
    } catch (err) {
      setError(err.response?.data?.message || "ویرایش ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این فاکتور مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${BILL_API}/${id}`);
      if (bills.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchBills(currentPage, itemsPerPage);
      }
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchBills(currentPage, itemsPerPage);
  };

  const handleFormCancel = () => {
    setShowForm(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "paid":
        return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">پرداخت شده</span>;
      case "partial":
        return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">پرداخت جزئی</span>;
      default:
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">پرداخت نشده</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت فاکتورهای فروش</h1>
        <p className="text-gray-600">مشاهده، ویرایش یادداشت و حذف فاکتورهای ثبت شده</p>
      </div>

      {/* ─── Toggle & Add Buttons ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
        {/* Sale type toggle */}
        <div className="flex items-center gap-2 bg-white rounded-xl shadow-md p-1 border border-gray-200">
          <button
            onClick={() => setSaleType("carpet")}
            className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${
              saleType === "carpet"
                ? "bg-cyan-700 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            فروش فرش
          </button>
          <button
            onClick={() => setSaleType("blanket")}
            className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${
              saleType === "blanket"
                ? "bg-cyan-700 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FaLayerGroup />
            فروش بلنکت
          </button>
        </div>

        {/* Add / Close button */}
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className={`px-6 py-3 rounded-xl transition font-medium shadow-md flex items-center gap-2 ${
                saleType === "carpet"
                  ? "bg-gradient-to-r from-cyan-800 to-cyan-600 hover:from-cyan-900 hover:to-cyan-700 text-white"
                  : "bg-gradient-to-r from-cyan-800 to-cyan-600 hover:from-cyan-900 hover:to-cyan-700 text-white"
              }`}
            >
              <FaPlus />
              ثبت فروش {saleType === "carpet" ? "فرش" : "بلنکت"}
            </button>
          ) : (
            <button
              onClick={handleFormCancel}
              className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition font-medium shadow-md flex items-center gap-2"
            >
              <FaTimes />
              بستن فرم
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaSpinner className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {showForm && (
        <>
          {saleType === "carpet" ? (
            <SellForm
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              editingId={null}
              initialEntries={[
                {
                  typeId: "",
                  categoryId: "",
                  incomeId: "",
                  incomeWidth: "",
                  length: "",
                  area: "",
                  total: "",
                  unit_price: "",
                },
              ]}
            />
          ) : (
            <BSaleForm
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              editingId={null}
              initialEntries={[
                {
                  typeId: "",
                  categoryId: "",
                  bexistId: "",
                  quantity: "",
                  unitPrice: "",
                  total: "",
                },
              ]}
            />
          )}
        </>
      )}

      {/* ─── Bills Table (common for both) ─────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست فاکتورها</h2>
                <p className="text-sm text-white/80">مدیریت تمام فاکتورهای فروش ثبت شده</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {loading && (
                <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                  <FaSpinner className="animate-spin" />
                  در حال بارگذاری...
                </div>
              )}
              <BillReportsDownload />
            </div>
          </div>
        </div>

        {loading && bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری فاکتورها...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ فاکتوری ثبت نشده است</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "ثبت فروش ..." کلیک کنید</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-blue-50 text-cyan-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شماره فاکتور</th>
                    <th className="p-3 border-b font-semibold">خریدار</th>
                    <th className="p-3 border-b font-semibold">تاریخ</th>
                    <th className="p-3 border-b font-semibold">جمع کل (؋)</th>
                    <th className="p-3 border-b font-semibold">پرداخت شده (؋)</th>
                    <th className="p-3 border-b font-semibold">باقیمانده (؋)</th>
                    <th className="p-3 border-b font-semibold">وضعیت</th>
                    <th className="p-3 border-b font-semibold">تخفیف</th>
                    <th className="p-3 border-b font-semibold">یادداشت</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                      <td className="p-3 font-mono text-sm">{bill.billNumber}</td>
                      <td className="p-3 font-medium text-gray-800">{bill.buyer?.fullname || "—"}</td>
                      <td className="p-3 text-gray-600">{new Date(bill.date).toLocaleDateString("eng-en")}</td>
                      <td className="p-3">{new Intl.NumberFormat().format(bill.totalAmount)}</td>
                      <td className="p-3">{new Intl.NumberFormat().format(bill.paidAmount)}</td>
                      <td className="p-3">{new Intl.NumberFormat().format(bill.remainingAmount)}</td>
                      <td className="p-3">{getStatusBadge(bill.status)}</td>
                      <td className="p-3">{bill.discounted_amount}</td>
                      <td className="p-3 max-w-xs truncate">{bill.notes || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDelete(bill.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="حذف"
                          >
                            <FaTrash />
                          </button>
                          <SingleBillDownload billId={bill.id} billNumber={bill.billNumber} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <div className="text-center text-gray-500 text-sm py-2 border-t">
              مجموع {totalItems} فاکتور | صفحه {currentPage} از {totalPages}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SellManager;