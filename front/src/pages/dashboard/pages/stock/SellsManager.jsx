import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaCheck, FaTimes, FaSpinner, FaPlus, FaSave } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/sells`;
const CATEGORIES_API_URL = `${BASE_URL}/category`; // endpoint for categories

const SellManager = () => {
  const [sells, setSells] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    Category: "",
    unit_price: "",
    amount: "",
    receipt: "",
    remaind: "",
    customer: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSells();
    fetchCategories();
  }, []);

  const fetchSells = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_BASE_URL);
      setSells(response.data);
      setError("");
    } catch (err) {
      setError("بارگیری فروش‌ها ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(CATEGORIES_API_URL);
      setCategories(response.data);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-calculate total and remaind when unit_price, amount, or receipt changes
  const updateCalculatedFields = (data) => {
    const unit_price = parseFloat(data.unit_price) || 0;
    const amount = parseFloat(data.amount) || 0;
    const receipt = parseFloat(data.receipt) || 0;
    const total = unit_price * amount;
    const remaind = total - receipt;
    return { total, remaind };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Prepare payload: Category (id), unit_price, amount, receipt, customer (name)
      const payload = {
        Category: parseInt(formData.Category, 10),
        unit_price: parseFloat(formData.unit_price),
        amount: parseFloat(formData.amount),
        receipt: parseFloat(formData.receipt) || 0,
        customer: formData.customer.trim(),
      };
      if (formData.remaind !== "") {
        payload.remaind = parseFloat(formData.remaind);
      }

      if (editingId) {
        await axios.put(`${API_BASE_URL}/${editingId}`, payload);
      } else {
        await axios.post(API_BASE_URL, payload);
      }
      fetchSells();
      resetForm();
    } catch (err) {
      setError(editingId ? "ویرایش ناکام ماند" : "ایجاد ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      Category: "",
      unit_price: "",
      amount: "",
      receipt: "",
      remaind: "",
      customer: "",
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleEdit = (sell) => {
    setFormData({
      Category: sell.categoryDetail?.id || "",
      unit_price: sell.unit_price,
      amount: sell.amount,
      receipt: sell.receipt,
      remaind: sell.remaind,
      customer: sell.customerDetail?.fullname || "",
    });
    setEditingId(sell.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این فروش مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/${id}`);
      fetchSells();
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...formData, [name]: value };
    if (name === "unit_price" || name === "amount" || name === "receipt") {
      const { remaind } = updateCalculatedFields(newForm);
      newForm.remaind = remaind.toFixed(2);
    }
    setFormData(newForm);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت فروش</h1>
        <p className="text-gray-600">ثبت، ویرایش و حذف فاکتورهای فروش</p>
      </div>

      {/* Add Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-green-800 to-green-600 text-white rounded-xl hover:from-green-900 hover:to-green-700 transition font-medium shadow-md flex items-center gap-2"
        >
          <FaPlus />
          افزودن فروش جدید
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

      {/* Sells Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست فروش‌ها</h2>
                <p className="text-sm text-white/80">مدیریت تمام فاکتورهای فروش ثبت شده</p>
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

        {loading && sells.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-green-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری فروش‌ها...</p>
          </div>
        ) : sells.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ فروشی ثبت نشده است</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، فروش جدیدی ایجاد کنید</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead className="bg-green-50 text-green-800">
                <tr>
                  <th className="p-3 border-b font-semibold">شناسه</th>
                  <th className="p-3 border-b font-semibold">دسته‌بندی</th>
                  <th className="p-3 border-b font-semibold">مشتری</th>
                  <th className="p-3 border-b font-semibold">مقدار</th>
                  <th className="p-3 border-b font-semibold">قیمت واحد</th>
                  <th className="p-3 border-b font-semibold">جمع</th>
                  <th className="p-3 border-b font-semibold">دریافتی</th>
                  <th className="p-3 border-b font-semibold">باقیمانده</th>
                  <th className="p-3 border-b font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {sells.map((sell) => (
                  <tr key={sell.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                    <td className="p-3 text-gray-600">{sell.id}</td>
                    <td className="p-3 font-medium text-gray-800">
                      {sell.categoryDetail?.name || "—"}
                      {sell.categoryDetail?.type && (
                        <span className="text-xs text-gray-500 block">({sell.categoryDetail.type.name})</span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-gray-800">{sell.customerDetail?.fullname || "—"}</td>
                    <td className="p-3">{sell.amount}</td>
                    <td className="p-3">{new Intl.NumberFormat().format(sell.unit_price)}</td>
                    <td className="p-3">{new Intl.NumberFormat().format(sell.total)}</td>
                    <td className="p-3">{new Intl.NumberFormat().format(sell.receipt)}</td>
                    <td className="p-3">{new Intl.NumberFormat().format(sell.remaind)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(sell)}
                          className="p-2 text-green-700 hover:bg-green-50 rounded-lg transition"
                          title="ویرایش"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(sell.id)}
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-full">
                    {editingId ? <FaEdit /> : <FaPlus />}
                  </div>
                  <h2 className="text-xl font-bold">
                    {editingId ? "ویرایش فروش" : "فروش جدید"}
                  </h2>
                </div>
                <button onClick={resetForm} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">دسته‌بندی <span className="text-red-500">*</span></label>
                  <select
                    name="Category"
                    value={formData.Category}
                    onChange={handleFormChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">انتخاب کنید</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">نام مشتری <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="customer"
                    value={formData.customer}
                    onChange={handleFormChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                    placeholder="مثال: علی محمدی"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">مقدار <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleFormChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">قیمت واحد <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="unit_price"
                    value={formData.unit_price}
                    onChange={handleFormChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">دریافتی (اختیاری)</label>
                  <input
                    type="number"
                    name="receipt"
                    value={formData.receipt}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">باقیمانده (محاسبه خودکار)</label>
                  <input
                    type="number"
                    name="remaind"
                    value={formData.remaind}
                    disabled
                    className="w-full border border-gray-300 bg-gray-100 rounded-lg px-4 py-3"
                  />
                  <p className="text-xs text-gray-400 mt-1">به طور خودکار از جمع کل منهای دریافتی محاسبه می‌شود</p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">انصراف</button>
                  <button type="submit" disabled={loading} className="px-5 py-2 bg-gradient-to-r from-green-800 to-green-600 hover:from-green-900 hover:to-green-700 text-white rounded-lg shadow-md flex items-center gap-2">
                    {loading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ایجاد"}</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellManager;