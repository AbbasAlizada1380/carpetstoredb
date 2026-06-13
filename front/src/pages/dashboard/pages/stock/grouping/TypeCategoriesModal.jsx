import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaTimes, FaFolderOpen } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const TypeCategoriesModal = ({ isOpen, typeId, typeName, onClose }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && typeId) {
      fetchCategories();
    }
  }, [isOpen, typeId]);

  const fetchCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${BASE_URL}/type/${typeId}/categories`);
      setCategories(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "خطا در بارگیری دسته‌بندی‌ها");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <FaFolderOpen />
              </div>
              <div>
                <h2 className="text-xl font-bold">دسته‌بندی‌های نوع</h2>
                <p className="text-sm text-white/80">{typeName}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">
              ×
            </button>
          </div>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <FaSpinner className="text-3xl text-cyan-800 animate-spin mb-3" />
              <p className="text-gray-600">در حال بارگذاری...</p>
            </div>
          )}
          {error && !loading && (
            <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <FaTimes className="text-red-500" />
                <span>{error}</span>
              </div>
            </div>
          )}
          {!loading && !error && categories.length === 0 && (
            <div className="text-center py-10">
              <div className="flex flex-col items-center">
                <svg className="w-16 h-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <p className="text-gray-500">هیچ دسته‌بندی برای این نوع ثبت نشده است.</p>
              </div>
            </div>
          )}
          {!loading && !error && categories.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-500 mb-3 flex justify-between items-center border-b pb-2">
                <span>تعداد کل: {categories.length}</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">فعال</span>
              </div>
              <ul className="space-y-2">
                {categories.map((cat) => (
                  <li key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-400 text-sm">#{cat.id}</span>
                      <span className="font-medium text-gray-800">{cat.name}</span>
                    </div>
                    {cat.description && (
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">{cat.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="bg-gray-50 p-4 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition">
            بستن
          </button>
        </div>
      </div>
  );
};

export default TypeCategoriesModal;