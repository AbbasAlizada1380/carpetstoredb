import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaPlus, FaSpinner, FaTimes } from "react-icons/fa";
import IncomeForm from "./IncomeForm";
import Pagination from "../../pagination/Pagination"; // adjust path if needed

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/income`;
const LIMIT = 20; // items per page

const IncomeManager = () => {
  const [incomes, setIncomes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchIncomes = async (page = currentPage) => {
    setLoading(true);
    try {
      const response = await axios.get(API_BASE_URL, {
        params: { page, limit: LIMIT }
      });
      setIncomes(response.data.items);
      setTotalPages(response.data.totalPages);
      setCurrentPage(response.data.currentPage);
      setError("");
    } catch (err) {
      setError("بارگیری داده‌ها ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes(1);
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchIncomes(newPage);
  };

  // After any mutation (create, edit, delete) we go back to page 1
  const refreshAfterMutation = () => {
    fetchIncomes(1);
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    refreshAfterMutation();
    setShowForm(false);
    setEditingIncome(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingIncome(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/${id}`);
      // after deletion, refetch page 1; if the only item on last page was deleted,
      // going to page 1 will show the previous page's items.
      refreshAfterMutation();
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getInitialEntries = () => {
    if (editingIncome) {
      return [{
        width: editingIncome.width,
        color: editingIncome.color,
        degree: editingIncome.degree || "",
        lotNumber: editingIncome.lotNumber,
        area: editingIncome.area,
        length: editingIncome.length,
      }];
    }
    return [{ width: "", color: "", degree: "", lotNumber: "", area: "", length: "" }];
  };

  return (
    <div className=" bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت ورودی (Income)</h1>
        <p className="text-gray-600">ثبت، ویرایش و حذف فرش‌های ورودی (امکان ثبت چند رکورد همزمان)</p>
      </div>

      {/* Toggle Form Button */}
      <div className="flex justify-center mb-6">
        {!showForm ? (
          <button
            onClick={() => {
              setEditingIncome(null);
              setShowForm(true);
            }}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:from-indigo-900 hover:to-indigo-700 transition font-medium shadow-md flex items-center gap-2"
          >
            <FaPlus />
            افزودن رکورد جدید
          </button>
        ) : (
          <button
            onClick={handleFormCancel}
            className="px-6 py-3 bg-primary text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
          >
            <FaTimes />
            بستن فرم
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {showForm && (
        <IncomeForm
          key={editingIncome ? editingIncome.id : "new"}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          editingId={editingIncome?.id || null}
          initialEntries={getInitialEntries()}
        />
      )}

      {/* Income Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-primary text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست فرش‌های ورودی</h2>
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

        {loading && incomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-indigo-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری داده‌ها...</p>
          </div>
        ) : incomes.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ رکوردی یافت نشد</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "افزودن رکورد جدید" کلیک کنید</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-indigo-50 text-indigo-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شناسه</th>
                    <th className="p-3 border-b font-semibold">عرض</th>
                    <th className="p-3 border-b font-semibold">رنگ</th>
                    <th className="p-3 border-b font-semibold">درجه</th>
                    <th className="p-3 border-b font-semibold">شماره لات</th>
                    <th className="p-3 border-b font-semibold">مساحت</th>
                    <th className="p-3 border-b font-semibold">طول</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                      <td className="p-3 text-gray-600">{inc.id}</td>
                      <td className="p-3">{inc.width}</td>
                      <td className="p-3">{inc.color}</td>
                      <td className="p-3">{inc.degree || "—"}</td>
                      <td className="p-3 font-mono text-sm">{inc.lotNumber}</td>
                      <td className="p-3">{inc.area}</td>
                      <td className="p-3">{inc.length}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(inc)}
                            className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                            title="ویرایش"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(inc.id)}
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
            {/* Pagination component */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default IncomeManager;