// OtherIncomeManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaSpinner, FaSearch, FaPlus } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";  // adjust path as needed
import OtherIncomeReportsDownload from "../report/OtherIncomeReportsDownload";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const OtherIncomeManager = () => {
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [meta, setMeta] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    amount: "",
    for: "",
    description: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const limit = 10;

  // Fetch other incomes
  const fetchIncomes = async (page = 1, search = "") => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      const res = await axios.get(`${BASE_URL}/other-incomes`, { params });
      setIncomes(res.data.data || []);
      setMeta(res.data.meta || {});
      setTotalPages(res.data.meta?.totalPages || 1);
      setCurrentPage(res.data.meta?.currentPage || 1);
    } catch (err) {
      console.error("Error fetching other incomes:", err);
      setError("خطا در بارگذاری داده‌ها");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes(currentPage, searchTerm);
  }, [currentPage, searchTerm]);

  // // Handle search
  // const handleSearch = (e) => {
  //   e.preventDefault();
  //   setCurrentPage(1);
  //   fetchIncomes(1, searchTerm);
  // };

  // Reset form
  const resetForm = () => {
    setFormData({ amount: "", for: "", description: "" });
    setEditingId(null);
    setError("");
  };

  // Handle submit (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("لطفاً مبلغ معتبر وارد کنید");
      return;
    }
    if (!formData.for.trim()) {
      setError("لطفاً عنوان/هدف را وارد کنید");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: parseFloat(formData.amount),
        for: formData.for,
        description: formData.description || null,
      };
      if (editingId) {
        await axios.put(`${BASE_URL}/other-incomes/${editingId}`, payload);
      } else {
        await axios.post(`${BASE_URL}/other-incomes`, payload);
      }
      resetForm();
      setShowForm(false);
      fetchIncomes(currentPage, searchTerm);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "خطا در ذخیره اطلاعات");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit an income
  const handleEdit = (income) => {
    setEditingId(income.id);
    setFormData({
      amount: income.amount,
      for: income.for,
      description: income.description || "",
    });
    setShowForm(true);
    setError("");
  };

  // Delete an income
  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این درآمد اطمینان دارید؟")) return;
    try {
      await axios.delete(`${BASE_URL}/other-incomes/${id}`);
      fetchIncomes(currentPage, searchTerm);
    } catch (err) {
      console.error(err);
      alert("خطا در حذف رکورد");
    }
  };

  // Helper: format currency
  const formatCurrency = (amount) => {
    return parseFloat(amount).toLocaleString("eng-en");
  };

  // Initial loading
  if (loading && incomes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
        <p className="text-gray-600">در حال بارگذاری درآمدهای متفرقه...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">

        <div className="flex flex-wrap items-center justify-between ">
          <div>
            <h2 className="text-xl font-bold">درآمدهای متفرقه</h2>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <FaPlus />
            {showForm ? "بستن فرم" : "ثبت درآمد جدید"}
          </button>
        </div> <OtherIncomeReportsDownload />
      </div>

      {/* Search Bar (add if missing) */}
      {/* <div className="p-4 border-b border-gray-100">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="جستجو در عنوان یا توضیحات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition flex items-center gap-2"
          >
            <FaSearch />
            جستجو
          </button>
        </form>
      </div> */}

      {/* Form (create/edit) */}
      {showForm && (
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            {editingId ? "ویرایش درآمد" : "درآمد جدید"}
          </h3>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                بابت<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.for}
                onChange={(e) => setFormData({ ...formData, for: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مبلغ (افغانی) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                توضیحات
              </label>
              <textarea
                rows="2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <span>ذخیره</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                لغو
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-center">
          <thead className="bg-cyan-50 text-cyan-800">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">عنوان</th>
              <th className="p-3">مبلغ (؋)</th>
              <th className="p-3">توضیحات</th>
              <th className="p-3">تاریخ ثبت</th>
              <th className="p-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {incomes.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  هیچ درآمد متفرقه‌ای یافت نشد.
                </td>
              </tr>
            ) : (
              incomes.map((inc, idx) => (
                <tr key={inc.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{(currentPage - 1) * limit + idx + 1}</td>
                  <td className="p-3 font-medium">{inc.for}</td>
                  <td className="p-3 text-green-700 font-bold">
                    {formatCurrency(inc.amount)} ؋
                  </td>
                  <td className="p-3 text-gray-600 max-w-xs truncate">
                    {inc.description || "—"}
                  </td>
                  <td className="p-3 text-sm">
                    {new Date(inc.createdAt).toLocaleDateString("eng-en")}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(inc)}
                        className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg"
                        title="ویرایش"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(inc.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="حذف"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default OtherIncomeManager;