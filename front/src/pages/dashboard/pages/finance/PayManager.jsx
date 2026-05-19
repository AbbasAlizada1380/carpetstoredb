// PayManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaEdit, FaTrash, FaTimes } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const PAY_API = `${BASE_URL}/pay`;
const CUSTOMER_API = `${BASE_URL}/customer/active`;

const PayManager = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchPayments(selectedCustomerId);
    } else {
      setPayments([]);
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(CUSTOMER_API);
      setCustomers(res.data.customers || res.data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const fetchPayments = async (customerId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${PAY_API}?customerId=${customerId}`);
      setPayments(res.data);
    } catch (err) {
      console.error(err);
      setError("خطا در دریافت لیست پرداخت‌ها");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount("");
    setDescription("");
    setError("");
    setSuccess("");
  };

  const handleOpenModal = (payment = null) => {
    if (payment) {
      setEditingId(payment.id);
      setAmount(payment.amountofmoney);
      setDescription(payment.description || "");
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError("لطفاً ابتدا یک مشتری انتخاب کنید");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("مبلغ باید یک عدد مثبت باشد");
      return;
    }

    setSubmitLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        customerId: selectedCustomerId,
        amountofmoney: amountNum,
        description: description.trim() || null,
      };

      if (editingId) {
        await axios.put(`${PAY_API}/${editingId}`, payload);
        setSuccess("پرداخت با موفقیت ویرایش شد");
      } else {
        await axios.post(PAY_API, payload);
        setSuccess("پرداخت با موفقیت ثبت شد");
      }
      handleCloseModal();
      fetchPayments(selectedCustomerId);
    } catch (err) {
      const msg = err.response?.data?.message || "خطا در ثبت پرداخت";
      setError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این پرداخت اطمینان دارید؟")) return;
    try {
      await axios.delete(`${PAY_API}/${id}`);
      setSuccess("پرداخت حذف شد");
      fetchPayments(selectedCustomerId);
    } catch (err) {
      setError("خطا در حذف پرداخت");
      console.error(err);
    }
  };

  const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amountofmoney), 0);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">مدیریت پرداخت‌های مشتریان</h2>

      {/* Customer selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">انتخاب مشتری</label>
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          className="w-full md:w-1/2 border rounded-lg px-4 py-2"
        >
          <option value="">-- انتخاب کنید --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullname}
            </option>
          ))}
        </select>
      </div>

      {selectedCustomerId && (
        <>
          {/* Summary */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
            <span className="font-semibold">مجموع پرداخت‌ها:</span>
            <span className="text-xl font-bold text-green-600">{totalPayments.toFixed(2)} ؋</span>
          </div>

          {/* Add button */}
          <div className="mb-4">
            <button
              onClick={() => handleOpenModal()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              + ثبت پرداخت جدید
            </button>
          </div>

          {/* Payments list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin text-3xl text-gray-500" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">هیچ پرداختی برای این مشتری ثبت نشده است.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 border">تاریخ</th>
                    <th className="py-2 px-4 border">مبلغ (؋)</th>
                    <th className="py-2 px-4 border">توضیحات</th>
                    <th className="py-2 px-4 border">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="py-2 px-4 border text-center">
                        {new Date(pay.createdAt).toLocaleDateString("fa-IR")}
                      </td>
                      <td className="py-2 px-4 border text-center">{pay.amountofmoney}</td>
                      <td className="py-2 px-4 border">{pay.description || "—"}</td>
                      <td className="py-2 px-4 border text-center">
                        <button
                          onClick={() => handleOpenModal(pay)}
                          className="text-blue-600 hover:text-blue-800 mx-1"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(pay.id)}
                          className="text-red-600 hover:text-red-800 mx-1"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Success/Error messages */}
          {success && <div className="mt-4 text-green-600 text-sm">{success}</div>}
          {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
        </>
      )}

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingId ? "ویرایش پرداخت" : "پرداخت جدید"}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  مبلغ (؋) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
              {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border rounded-lg"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"
                >
                  {submitLoading ? <FaSpinner className="animate-spin" /> : <FaSave />}
                  {editingId ? "به‌روزرسانی" : "ذخیره"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayManager;