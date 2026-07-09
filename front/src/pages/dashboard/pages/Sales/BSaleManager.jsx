// components/stock/BSaleManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaTimes } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import BSaleForm from "./BSaleForm";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BSALES_API = `${BASE_URL}/bsales`;

const BSaleManager = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // ─── Fetch blanket sales ──────────────────────────────────────────────
  const fetchSales = async (currentPage = page, itemsPerPage = limit) => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(BSALES_API, {
        params: { page: currentPage, limit: itemsPerPage },
      });
      const { data, totalItems, totalPages, currentPage: curPage } = res.data;
      setSales(data || []);
      setTotalItems(totalItems || 0);
      setTotalPages(totalPages || 1);
      setPage(curPage || 1);
    } catch (err) {
      setError(err.response?.data?.message || "بارگیری داده‌ها ناکام ماند");
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(page, limit);
  }, [page, limit]);

  // ─── Form callbacks ────────────────────────────────────────────────────
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingData(null);
    fetchSales(page, limit);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingData(null);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setEditingData(null);
    setShowForm(true);
  };

  const handleEdit = (sale) => {
    setEditingId(sale.id);
    // Convert single sale to entries format for form
    setEditingData([
      {
        typeId: sale.category?.typeId || "",
        categoryId: sale.categoryId,
        bexistId: sale.bexistId,
        quantity: sale.quantity,
        unitPrice: sale.unit_price,
        total: sale.total,
      },
    ]);
    setShowForm(true);
  };

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${BSALES_API}/${id}`);
      if (sales.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchSales(page, limit);
      }
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  // ─── Pagination ──────────────────────────────────────────────────────────
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-xl shadow-lg border border-gray-100 mt-8" dir="rtl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">مدیریت فروش بلنکت</h2>
        <p className="text-sm text-gray-500">ثبت و مدیریت فروش از موجودی بلنکت</p>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Toggle Form Button */}
      <div className="flex justify-center mb-6">
        {!showForm ? (
          <button
            onClick={handleAddNew}
            className="px-6 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
          >
            <FaPlus />
            ثبت فروش جدید
          </button>
        ) : (
          <button
            onClick={handleFormCancel}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
          >
            <FaTimes />
            بستن فرم
          </button>
        )}
      </div>

      {showForm && (
        <BSaleForm
          editingId={editingId}
          initialEntries={editingData}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-indigo-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست فروش‌های بلنکت</h2>
                <p className="text-sm text-white/80">مدیریت تمام فروش‌های ثبت شده</p>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                <FaSpinner className="animate-spin" />
                در حال بارگذاری...
              </div>
            )}
          </div>
        </div>

        {loading && sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-indigo-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری داده‌ها...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ فروشی ثبت نشده است</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "ثبت فروش جدید" کلیک کنید</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-indigo-50 text-indigo-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شناسه</th>
                    <th className="p-3 border-b font-semibold">دسته‌بندی</th>
                    <th className="p-3 border-b font-semibold">موجودی</th>
                    <th className="p-3 border-b font-semibold">تعداد</th>
                    <th className="p-3 border-b font-semibold">قیمت واحد</th>
                    <th className="p-3 border-b font-semibold">جمع کل</th>
                    <th className="p-3 border-b font-semibold">دریافتی</th>
                    <th className="p-3 border-b font-semibold">باقیمانده</th>
                    <th className="p-3 border-b font-semibold">خریدار</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                      <td className="p-3 text-gray-600">{item.id}</td>
                      <td className="p-3">{item.category?.name || item.categoryId}</td>
                      <td className="p-3">{item.bExist?.id || item.bexistId}</td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3">{item.unit_price}</td>
                      <td className="p-3 font-bold text-indigo-700">{item.total}</td>
                      <td className="p-3">{item.receipt}</td>
                      <td className="p-3">{item.remaind}</td>
                      <td className="p-3">{item.buyer?.fullname || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                            title="ویرایش"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
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
              مجموع {totalItems} رکورد | صفحه {page} از {totalPages}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BSaleManager;