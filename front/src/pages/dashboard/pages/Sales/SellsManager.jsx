import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaPlus, FaSpinner, FaTimes } from "react-icons/fa";
import SellForm from "./SellForm";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/sells`;

const SellManager = () => {
  const [sells, setSells] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSell, setEditingSell] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSells();
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

  const handleEdit = (sell) => {
    setEditingSell(sell);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    fetchSells();
    setShowForm(false);
    setEditingSell(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSell(null);
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

  const getInitialEntries = () => {
    if (editingSell) {
      return [{
        categoryId: editingSell.categoryDetail?.id || "",
        amount: editingSell.amount,
        unit_price: editingSell.unit_price,
        receipt: editingSell.receipt,
        remaind: editingSell.remaind,
      }];
    }
    return [{ categoryId: "", amount: "", unit_price: "", receipt: "", remaind: "" }];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت فروش</h1>
        <p className="text-gray-600">ثبت، ویرایش و حذف فاکتورهای فروش (امکان ثبت چند ردیف همزمان)</p>
      </div>

      {/* Toggle Form Button */}
      <div className="flex justify-center mb-6">
        {!showForm ? (
          <button
            onClick={() => {
              setEditingSell(null);
              setShowForm(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-green-800 to-green-600 text-white rounded-xl hover:from-green-900 hover:to-green-700 transition font-medium shadow-md flex items-center gap-2"
          >
            <FaPlus />
            افزودن فروش جدید
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

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Inline Sell Form */}
      {showForm && (
        <SellForm
          key={editingSell ? editingSell.id : "new"}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          editingId={editingSell?.id || null}
          initialEntries={getInitialEntries()}
        />
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
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "افزودن فروش جدید" کلیک کنید</p>
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
    </div>
  );
};

export default SellManager;