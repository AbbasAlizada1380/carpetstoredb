// components/accounting/ReceiptManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaTimes } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const RECEIPT_API = `${BASE_URL}/receipt`;
const BUYER_API = `${BASE_URL}/buyer`;

const ReceiptManager = () => {
  const [receipts, setReceipts] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ buyerId: "", amountofmoney: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 15;

  // Fetch buyers for dropdown
  const fetchBuyers = async () => {
    try {
      const res = await axios.get(BUYER_API);
      setBuyers(res.data.buyers || res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch receipts with pagination
  const fetchReceipts = async (page = currentPage) => {
    setFetchLoading(true);
    try {
      const res = await axios.get(RECEIPT_API, { params: { page, limit: itemsPerPage } });
      // Assuming backend returns { data: [], totalPages, currentPage, totalItems }
      setReceipts(res.data.data || res.data);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.currentPage || 1);
      setTotalItems(res.data.totalItems || 0);
    } catch (err) {
      setError("بارگیری رسیدها ناکام ماند");
      console.error(err);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
    fetchReceipts(1);
  }, []);

  useEffect(() => {
    fetchReceipts(currentPage);
  }, [currentPage]);

  const handleOpenModal = (receipt = null) => {
    if (receipt) {
      setEditingId(receipt.id);
      setFormData({
        buyerId: receipt.buyerId,
        amountofmoney: receipt.amountofmoney,
        description: receipt.description || "",
      });
    } else {
      setEditingId(null);
      setFormData({ buyerId: "", amountofmoney: "", description: "" });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ buyerId: "", amountofmoney: "", description: "" });
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.buyerId || !formData.amountofmoney || parseFloat(formData.amountofmoney) <= 0) {
      setError("لطفاً خریدار و مبلغ معتبر وارد کنید");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (editingId) {
        await axios.put(`${RECEIPT_API}/${editingId}`, {
          amountofmoney: formData.amountofmoney,
          description: formData.description,
        });
      } else {
        await axios.post(RECEIPT_API, {
          buyerId: formData.buyerId,
          amountofmoney: formData.amountofmoney,
          description: formData.description,
        });
      }
      fetchReceipts(currentPage);
      handleCloseModal();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در ذخیره رسید");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رسید مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${RECEIPT_API}/${id}`);
      // If last item on page and not first page, go to previous page
      if (receipts.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchReceipts(currentPage);
      }
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت رسیدها</h1>
        <p className="text-gray-600">ثبت، ویرایش و حذف رسیدهای پرداختی خریداران</p>
      </div>

      {/* Add button */}
      <div className="flex justify-center">
        <button
          onClick={() => handleOpenModal()}
          className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-xl hover:from-cyan-900 hover:to-cyan-700 transition font-medium shadow-md flex items-center gap-2"
        >
          <FaPlus /> افزودن رسید جدید
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-xl border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Receipts Table Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست رسیدها</h2>
                <p className="text-sm text-white/80">مدیریت تمام رسیدهای ثبت شده</p>
              </div>
            </div>
            {fetchLoading && <FaSpinner className="animate-spin text-white" />}
          </div>
        </div>

        {fetchLoading && receipts.length === 0 ? (
          <div className="flex justify-center p-12">
            <FaSpinner className="animate-spin text-4xl text-cyan-800" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center p-12 text-gray-500">هیچ رسیدی یافت نشد.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-blue-50 text-cyan-800">
                  <tr>
                    <th className="p-3">شناسه</th>
                    <th className="p-3">خریدار</th>
                    <th className="p-3">مبلغ (؋)</th>
                    <th className="p-3">توضیحات</th>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((rec) => (
                    <tr key={rec.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{rec.id}</td>
                      <td className="p-3">{rec.buyer?.fullname || `خریدار ${rec.buyerId}`}</td>
                      <td className="p-3">{new Intl.NumberFormat().format(rec.amountofmoney)}</td>
                      <td className="p-3">{rec.description || "—"}</td>
                      <td className="p-3">{new Date(rec.createdAt).toLocaleDateString("fa-IR")}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => handleOpenModal(rec)} className="text-yellow-600 hover:bg-yellow-50 p-2 rounded">
                            <FaEdit />
                          </button>
                          <button onClick={() => handleDelete(rec.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                            <FaTrash />
                          </button>
                        </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="border-t p-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
                <div className="text-center text-gray-500 text-sm mt-2">
                  مجموع {totalItems} رسید | صفحه {currentPage} از {totalPages}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for create/edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingId ? "ویرایش رسید" : "رسید جدید"}</h3>
              <button onClick={handleCloseModal} className="text-white hover:text-gray-200">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">خریدار *</label>
                <select
                  name="buyerId"
                  value={formData.buyerId}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={!!editingId}
                  required
                >
                  <option value="">انتخاب کنید</option>
                  {buyers.map(b => <option key={b.id} value={b.id}>{b.fullname}</option>)}
                </select>
                {editingId && <p className="text-xs text-gray-500 mt-1">خریدار پس از ایجاد قابل تغییر نیست</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ (؋) *</label>
                <input
                  type="number"
                  step="any"
                  name="amountofmoney"
                  value={formData.amountofmoney}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-lg">انصراف</button>
                <button type="submit" disabled={loading} className="bg-cyan-800 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  {loading ? <FaSpinner className="animate-spin" /> : (editingId ? "به‌روزرسانی" : "ذخیره")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptManager;