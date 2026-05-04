import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaCheck, FaTimes, FaSpinner } from "react-icons/fa";
import TypeCategoriesModal from "./TypeCategoriesModal"; // adjust path if needed

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/type`;

const TypeManager = () => {
  const [types, setTypes] = useState([]);
  const [formData, setFormData] = useState({ name: "", categories: [] });
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_BASE_URL);
      setTypes(response.data);
      setError("");
    } catch (err) {
      setError("بارگیری انواع ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoriesChange = (e) => {
    const raw = e.target.value;
    const array = raw.split(",").map((item) => item.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, categories: array }));
  };

  const resetForm = () => {
    setFormData({ name: "", categories: [] });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}/${editingId}`, formData);
      } else {
        await axios.post(API_BASE_URL, formData);
      }
      fetchTypes();
      resetForm();
    } catch (err) {
      setError(editingId ? "ویرایش ناکام ماند" : "ایجاد ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type, e) => {
    e.stopPropagation(); // prevent opening categories modal
    setFormData({
      name: type.name,
      categories: type.categories || [],
    });
    setEditingId(type.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // prevent opening categories modal
    if (!window.confirm("آیا از حذف این نوع مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/${id}`);
      fetchTypes();
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (type) => {
    setSelectedType(type);
    setShowCategoriesModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت انواع</h1>
        <p className="text-gray-600">ایجاد، ویرایش و حذف انواع</p>

        {editingId && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded-xl max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <FaEdit className="h-5 w-5" />
              <span className="font-semibold">حالت ویرایش – نوع #{editingId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-xl hover:from-cyan-900 hover:to-cyan-700 transition font-medium shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          افزودن نوع جدید
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Types List Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست انواع</h2>
                <p className="text-sm text-white/80">برای مشاهده دسته‌بندی‌ها روی هر ردیف کلیک کنید</p>
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

        {loading && types.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری انواع...</p>
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ نوعی یافت نشد</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، نوع جدیدی ایجاد کنید</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead className="bg-blue-50 text-cyan-800">
                <tr>
                  <th className="p-3 border-b font-semibold">شناسه</th>
                  <th className="p-3 border-b font-semibold">نام</th>
                  <th className="p-3 border-b font-semibold">دسته‌بندی‌ها</th>
                  <th className="p-3 border-b font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr
                    key={type.id}
                    onClick={() => handleRowClick(type)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors border-b last:border-0"
                  >
                    <td className="p-3 text-gray-600">{type.id}</td>
                    <td className="p-3 font-medium text-gray-800">{type.name}</td>
                    <td className="p-3">
                      {type.categories?.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                            {type.categories.length} نوع
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => handleEdit(type, e)}
                          className="p-2 text-cyan-700 hover:bg-blue-100 rounded-lg transition"
                          title="ویرایش"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={(e) => handleDelete(type.id, e)}
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
        )}
      </div>

      {/* Modal Form (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-full">
                    {editingId ? <FaEdit /> : <FaCheck />}
                  </div>
                  <h2 className="text-xl font-bold">
                    {editingId ? "ویرایش نوع" : "نوع جدید"}
                  </h2>
                </div>
                <button onClick={resetForm} className="text-white/80 hover:text-white text-2xl leading-none">
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> نام
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    placeholder="مثال: الکترونیک"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    دسته‌بندی‌ها (شناسه‌ها با کاما جدا کنید)
                  </label>
                  <input
                    type="text"
                    value={formData.categories.join("، ")}
                    onChange={handleCategoriesChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    placeholder="مثال: 1, 2, 5"
                  />
                  <p className="text-xs text-gray-400 mt-1">شناسه دسته‌ها را با کامای انگلیسی (,) وارد کنید</p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-800 to-cyan-600 hover:from-cyan-900 hover:to-cyan-700 text-white rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        در حال ذخیره...
                      </>
                    ) : (
                      <>
                        <FaCheck />
                        {editingId ? "به‌روزرسانی" : "ایجاد"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Child Modal: Show Categories for Selected Type */}
      {showCategoriesModal && selectedType && (
        <TypeCategoriesModal
          isOpen={showCategoriesModal}
          typeId={selectedType.id}
          typeName={selectedType.name}
          onClose={() => setShowCategoriesModal(false)}
        />
      )}
    </div>
  );
};

export default TypeManager;