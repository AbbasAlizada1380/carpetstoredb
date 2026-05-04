import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaPlus, FaSave, FaSpinner, FaTimes } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/income`;

const IncomeManager = () => {
  const [incomes, setIncomes] = useState([]);
  const [formData, setFormData] = useState({
    width: "",
    color: "",
    degree: "",
    lotNumber: "",
    area: "",
    length: "", // read‑only, auto‑calculated by backend
  });
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchIncomes();
  }, []);

  const fetchIncomes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_BASE_URL);
      setIncomes(response.data);
      setError("");
    } catch (err) {
      setError("بارگیری داده‌ها ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Simple client‑side preview of length (optional, not enforced by backend)
  const calculateLengthPreview = (width, area) => {
    if (width && area && parseFloat(width) > 0) {
      return (parseFloat(area) / parseFloat(width)).toFixed(2);
    }
    return "";
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...formData, [name]: value };
    if (name === "width" || name === "area") {
      const previewLength = calculateLengthPreview(newForm.width, newForm.area);
      newForm.length = previewLength;
    }
    setFormData(newForm);
  };

  const resetForm = () => {
    setFormData({ width: "", color: "", degree: "", lotNumber: "", area: "", length: "" });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!formData.width || parseFloat(formData.width) <= 0) {
      setError("عرض باید بزرگتر از صفر باشد");
      return;
    }
    if (!formData.area || parseFloat(formData.area) <= 0) {
      setError("مساحت باید بزرگتر از صفر باشد");
      return;
    }
    if (!formData.color.trim()) {
      setError("رنگ الزامی است");
      return;
    }
    if (!formData.lotNumber.trim()) {
      setError("شماره لات الزامی است");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        width: parseFloat(formData.width),
        color: formData.color.trim(),
        degree: formData.degree.trim() || null,
        lotNumber: formData.lotNumber.trim(),
        area: parseFloat(formData.area),
      };
      if (editingId) {
        await axios.put(`${API_BASE_URL}/${editingId}`, payload);
      } else {
        await axios.post(API_BASE_URL, payload);
      }
      fetchIncomes();
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message || (editingId ? "ویرایش ناکام ماند" : "ایجاد ناکام ماند");
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (income) => {
    setFormData({
      width: income.width,
      color: income.color,
      degree: income.degree || "",
      lotNumber: income.lotNumber,
      area: income.area,
      length: income.length,
    });
    setEditingId(income.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/${id}`);
      fetchIncomes();
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت ورودی (Income)</h1>
        <p className="text-gray-600">ثبت، ویرایش و حذف فرش‌های ورودی</p>
      </div>

      {/* Add Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-800 to-indigo-600 text-white rounded-xl hover:from-indigo-900 hover:to-indigo-700 transition font-medium shadow-md flex items-center gap-2"
        >
          <FaPlus />
          افزودن رکورد جدید
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
      {/* Modal Form (Add/Edit) */}
      {isModalOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-full  overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  {editingId ? <FaEdit /> : <FaPlus />}
                </div>
                <h2 className="text-xl font-bold">
                  {editingId ? "ویرایش رکورد" : "رکورد جدید"}
                </h2>
              </div>
              <button onClick={resetForm} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عرض (متر) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="any"
                  name="width"
                  value={formData.width}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: 1.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">طول (محاسبه خودکار)</label>
                <input
                  type="text"
                  name="length"
                  value={formData.length}
                  disabled
                  className="w-full border border-gray-300 bg-gray-100 rounded-lg px-4 py-3"
                />
                <p className="text-xs text-gray-400 mt-1">با وارد کردن مساحت و عرض به‌طور خودکار محاسبه می‌شود</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">مساحت (متر مربع) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="any"
                  name="area"
                  value={formData.area}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: 4.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رنگ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  placeholder="مثال: قرمز"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">درجه (اختیاری)</label>
                <input
                  type="text"
                  name="degree"
                  value={formData.degree}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  placeholder="مثال: A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">شماره لات <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="lotNumber"
                  value={formData.lotNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  placeholder="مثال: BATCH-001"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={resetForm} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">انصراف</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-gradient-to-r from-indigo-800 to-indigo-600 hover:from-indigo-900 hover:to-indigo-700 text-white rounded-lg shadow-md flex items-center gap-2">
                  {loading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ایجاد"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Income Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white p-4">
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
              <p className="text-gray-400 text-sm mt-1">برای شروع، رکورد جدید ایجاد کنید</p>
            </div>
          </div>
        ) : (
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
        )}
      </div>


    </div>
  );
};

export default IncomeManager;