import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaTrash } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const RECEIPTS_API = `${BASE_URL}/receipts`;
const BUYER_API = `${BASE_URL}/buyer/active`;

const ReceiptManager = () => {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [buyerDebt, setBuyerDebt] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchBuyers();
  }, []);

  useEffect(() => {
    if (selectedBuyerId) {
      fetchReceipts(selectedBuyerId);
      fetchBuyerDebt(selectedBuyerId);
    } else {
      setReceipts([]);
      setBuyerDebt(0);
    }
  }, [selectedBuyerId]);

  const fetchBuyers = async () => {
    try {
      const res = await axios.get(BUYER_API);
      setBuyers(res.data.buyers || res.data);
    } catch (err) {
      console.error("Error loading buyers:", err);
    }
  };

  const fetchReceipts = async (buyerId) => {
    try {
      const res = await axios.get(`${RECEIPTS_API}/buyer/${buyerId}`);
      setReceipts(res.data);
    } catch (err) {
      console.error("Error loading receipts:", err);
    }
  };

  const fetchBuyerDebt = async (buyerId) => {
    try {
      // You need an endpoint that returns the buyer's total outstanding debt
      // Example: GET /buyer/:buyerId/debt -> { totalDebt }
      const res = await axios.get(`${BASE_URL}/buyer/${buyerId}/debt`);
      setBuyerDebt(res.data.totalDebt);
    } catch (err) {
      console.error("Error fetching buyer debt:", err);
      // Fallback: we could compute from remaindIds if we fetch the account
      // For now, just set 0
      setBuyerDebt(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBuyerId) {
      setError("لطفاً خریدار را انتخاب کنید");
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
        buyerId: selectedBuyerId,
        amountofmoney: amountNum,
        description: description.trim() || null,
      };
      const response = await axios.post(RECEIPTS_API, payload);
      // After successful creation, refresh receipts and debt
      await fetchReceipts(selectedBuyerId);
      await fetchBuyerDebt(selectedBuyerId);
      setAmount("");
      setDescription("");
      setSuccess(`دریافت ${amountNum}؋ با موفقیت ثبت شد`);
      // Optionally show updated sells info (if needed)
      if (response.data.updatedSells && response.data.updatedSells.length) {
        setSuccess(prev => `${prev} – ${response.data.updatedSells.length} قلم فروش تسویه شد.`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "خطا در ثبت دریافت";
      setError(msg);
      console.error(err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    if (!window.confirm("آیا از حذف این دریافت اطمینان دارید؟")) return;
    try {
      await axios.delete(`${RECEIPTS_API}/${receiptId}`);
      fetchReceipts(selectedBuyerId);
      fetchBuyerDebt(selectedBuyerId);
      setSuccess("دریافت حذف شد");
    } catch (err) {
      setError("خطا در حذف دریافت");
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">مدیریت دریافتی‌ها</h2>

      {/* Buyer Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">انتخاب خریدار</label>
        <select
          value={selectedBuyerId}
          onChange={(e) => setSelectedBuyerId(e.target.value)}
          className="w-full md:w-1/2 border rounded-lg px-4 py-2"
        >
          <option value="">انتخاب کنید</option>
          {buyers.map(b => (
            <option key={b.id} value={b.id}>{b.fullname}</option>
          ))}
        </select>
      </div>

      {selectedBuyerId && (
        <>
          {/* Debt Summary */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">بدهی جاری خریدار:</span>
              <span className="text-2xl font-bold text-red-600">{buyerDebt.toFixed(2)} ؋</span>
            </div>
          </div>

          {/* Receipt Form */}
          <form onSubmit={handleSubmit} className="mb-8 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ (؋) *</label>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="مبلغ دریافت شده"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="اختیاری"
                />
              </div>
            </div>
            {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}
            {success && <div className="mt-3 text-green-600 text-sm">{success}</div>}
            <div className="mt-4">
              <button
                type="submit"
                disabled={submitLoading}
                className="px-5 py-2 bg-green-600 text-white rounded-lg shadow-md flex items-center gap-2"
              >
                {submitLoading ? <><FaSpinner className="animate-spin" /> در حال ثبت...</> : <><FaSave /> ثبت دریافت</>}
              </button>
            </div>
          </form>

          {/* Receipts List */}
          <div>
            <h3 className="text-xl font-semibold mb-3">لیست دریافتی‌ها</h3>
            {receipts.length === 0 ? (
              <p className="text-gray-500">هیچ دریافت ثبت نشده است.</p>
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
                    {receipts.map(rec => (
                      <tr key={rec.id}>
                        <td className="py-2 px-4 border text-center">
                          {new Date(rec.createdAt).toLocaleDateString("fa-IR")}
                        </td>
                        <td className="py-2 px-4 border text-center">{rec.amountofmoney}</td>
                        <td className="py-2 px-4 border">{rec.description || "—"}</td>
                        <td className="py-2 px-4 border text-center">
                          <button
                            onClick={() => handleDeleteReceipt(rec.id)}
                            className="text-red-600 hover:text-red-800"
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
          </div>
        </>
      )}
    </div>
  );
};

export default ReceiptManager;