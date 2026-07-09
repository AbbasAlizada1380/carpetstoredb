// components/BincomeManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaTimes } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import BincomeForm from "./BincomeForm";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE = `${BASE_URL}/bincome`;
const CATEGORY_API = `${BASE_URL}/category`;

const BincomeManager = () => {
  // ─── State ──────────────────────────────────────────────────────────────
  const [bincomes, setBincomes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters & pagination
  const [selectedCategory, setSelectedCategory] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Form visibility & editing
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);

  // ─── Fetch categories ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(CATEGORY_API);
        setCategories(res.data || []);
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    fetchCategories();
  }, []);

  // ─── Fetch Bincome list ────────────────────────────────────────────────
  const fetchBincomes = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit,
        ...(selectedCategory && { categoryId: selectedCategory }),
      };
      const res = await axios.get(API_BASE, { params });
      const { data, pagination } = res.data;
      setBincomes(data || []);
      if (pagination) {
        setTotalPages(pagination.totalPages || 0);
        setTotalItems(pagination.totalItems || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || "بارگیری داده‌ها ناکام ماند");
      setBincomes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBincomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedCategory]);

  // ─── Form callbacks ────────────────────────────────────────────────────
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingData(null);
    fetchBincomes(); // refresh list
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

  const handleEdit = (bincome) => {
    setEditingId(bincome.id);
    setEditingData(bincome);
    setShowForm(true);
  };

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/${id}`);
      fetchBincomes();
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getTotalPrice = (item) => {
    if (item.totalPrice !== undefined && item.totalPrice !== null) {
      return item.totalPrice;
    }
    const amount = parseFloat(item.amount) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    return Math.round(amount * unitPrice * 100) / 100;
  };

  const grandTotal = bincomes.reduce((sum, item) => sum + getTotalPrice(item), 0);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-xl shadow-lg border border-gray-100 mt-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">مدیریت ورودی کمپل (Bincome)</h2>
        <p className="text-sm text-gray-500">ثبت و مدیریت درآمدهای کمپل</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ─── Toggle Form Button ────────────────────────────────────────── */}
      <div className="flex justify-center mb-6">
        {!showForm ? (
          <button
            onClick={handleAddNew}
            className="px-6 py-3 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
          >
            <FaPlus />
            افزودن رکورد جدید
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

      {/* ─── Form ────────────────────────────────────────────────────────── */}
      {showForm && (
        <BincomeForm
          editingId={editingId}
          initialData={editingData}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* ─── Filter Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center gap-3">
          <label className="font-medium text-gray-700">دسته‌بندی:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
          >
            <option value="">همه</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name || cat.id}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500">
          مجموع رکوردها: <span className="font-semibold text-cyan-700">{totalItems}</span>
        </div>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-cyan-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست ورودی‌های کمپل</h2>
                <p className="text-sm text-white/80">مدیریت تمام رکوردهای ثبت شده</p>
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

        {loading && bincomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری داده‌ها...</p>
          </div>
        ) : bincomes.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ رکوردی یافت نشد</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "افزودن رکورد جدید" کلیک کنید.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-cyan-50 text-cyan-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شناسه</th>
                    <th className="p-3 border-b font-semibold">دسته‌بندی</th>
                    <th className="p-3 border-b font-semibold">تعداد</th>
                    <th className="p-3 border-b font-semibold">وزن</th>
                    <th className="p-3 border-b font-semibold">قیمت واحد</th>
                    <th className="p-3 border-b font-semibold">قیمت کل</th>
                    <th className="p-3 border-b font-semibold">تاریخ ایجاد</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {bincomes.map((item) => {
                    const totalPrice = getTotalPrice(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                        <td className="p-3 text-gray-600">{item.id}</td>
                        <td className="p-3">
                          {categories.find((c) => c.id === item.categoryId)?.name || item.categoryId}
                        </td>
                        <td className="p-3">{item.amount}</td>
                        <td className="p-3">{item.weight}</td>
                        <td className="p-3">{item.unitPrice}</td>
                        <td className="p-3 font-medium text-cyan-700">{totalPrice.toFixed(2)}</td>
                        <td className="p-3 text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString('fa-IR')}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
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
                    );
                  })}
                  {/* ─── Footer row: Grand Total ───────────────────────── */}
                  <tr className="bg-cyan-50 border-t-2 border-cyan-200">
                    <td colSpan="5" className="p-3 font-bold text-right text-cyan-800">
                      مجموع کل قیمت:
                    </td>
                    <td className="p-3 font-bold text-cyan-800 text-lg">
                      {grandTotal.toFixed(2)}
                    </td>
                    <td colSpan="2" />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ─── Pagination ────────────────────────────────────────────── */}
            <div className="bg-gray-50 border-t border-gray-200">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BincomeManager;