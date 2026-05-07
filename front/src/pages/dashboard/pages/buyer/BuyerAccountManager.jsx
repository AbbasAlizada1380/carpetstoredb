// components/accounting/BuyerAccountManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSearch, FaTimes, FaEye, FaTrash, FaPlus, FaMinus } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BUYER_API = `${BASE_URL}/buyer`;
const ACCOUNT_API = `${BASE_URL}/buyeraccount`;

const BuyerAccountManager = () => {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sellIdInput, setSellIdInput] = useState("");
  const [receiptIdInput, setReceiptIdInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch all buyers for selection
  const fetchBuyers = async () => {
    try {
      const res = await axios.get(BUYER_API);
      setBuyers(res.data.buyers || res.data);
    } catch (err) {
      console.error(err);
      setError("خطا در بارگیری لیست خریداران");
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, []);

  // Fetch account for selected buyer
  const fetchAccount = async () => {
    if (!selectedBuyerId) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${ACCOUNT_API}/${selectedBuyerId}`);
      setAccount(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "خطا در بارگیری حساب");
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBuyerId) fetchAccount();
  }, [selectedBuyerId]);

  // Manual add sell to account
  const handleAddSell = async () => {
    if (!sellIdInput.trim()) return;
    setActionLoading(true);
    try {
      await axios.post(`${ACCOUNT_API}/add-sell`, {
        buyerId: selectedBuyerId,
        sellId: parseInt(sellIdInput),
      });
      fetchAccount(); // refresh
      setSellIdInput("");
    } catch (err) {
      setError(err.response?.data?.message || "خطا در افزودن فروش");
    } finally {
      setActionLoading(false);
    }
  };

  // Manual remove sell from account
  const handleRemoveSell = async (sellId) => {
    if (!confirm("آیا از حذف این فروش از حساب مطمئن هستید؟")) return;
    setActionLoading(true);
    try {
      await axios.delete(`${ACCOUNT_API}/remove-sell`, {
        data: { buyerId: selectedBuyerId, sellId },
      });
      fetchAccount();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در حذف فروش");
    } finally {
      setActionLoading(false);
    }
  };

  // Manual add receipt to account
  const handleAddReceipt = async () => {
    if (!receiptIdInput.trim()) return;
    setActionLoading(true);
    try {
      await axios.post(`${ACCOUNT_API}/add-receipt`, {
        buyerId: selectedBuyerId,
        receiptId: parseInt(receiptIdInput),
      });
      fetchAccount();
      setReceiptIdInput("");
    } catch (err) {
      setError(err.response?.data?.message || "خطا در افزودن رسید");
    } finally {
      setActionLoading(false);
    }
  };

  // Manual remove receipt from account
  const handleRemoveReceipt = async (receiptId) => {
    if (!confirm("آیا از حذف این رسید از حساب مطمئن هستید؟")) return;
    setActionLoading(true);
    try {
      await axios.delete(`${ACCOUNT_API}/remove-receipt`, {
        data: { buyerId: selectedBuyerId, receiptId },
      });
      fetchAccount();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت حساب خریداران</h1>
        <p className="text-gray-600">مشاهده و مدیریت ارتباط فروش‌ها و رسیدهای خریدار</p>
      </div>

      {/* Buyer selection */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">انتخاب خریدار</label>
        <div className="flex gap-3">
          <select
            value={selectedBuyerId}
            onChange={(e) => setSelectedBuyerId(e.target.value)}
            className="flex-1 border rounded-lg px-4 py-2"
          >
            <option value="">انتخاب کنید</option>
            {buyers.map(b => (
              <option key={b.id} value={b.id}>{b.fullname}</option>
            ))}
          </select>
          <button
            onClick={fetchAccount}
            className="bg-cyan-800 hover:bg-cyan-900 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <FaSearch /> نمایش
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-xl border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center p-8">
          <FaSpinner className="animate-spin text-3xl text-cyan-800" />
        </div>
      )}

      {account && (
        <>
          {/* Account summary */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">اطلاعات حساب</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">شناسه خریدار</p>
                <p className="text-2xl font-bold text-cyan-800">{account.buyerId}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">تعداد فروش‌ها</p>
                <p className="text-2xl font-bold text-green-600">{account.sellIds?.length || 0}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">تعداد رسیدها</p>
                <p className="text-2xl font-bold text-purple-600">{account.receiptIds?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Sells list */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">لیست فروش‌های مرتبط</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="شناسه فروش"
                  value={sellIdInput}
                  onChange={(e) => setSellIdInput(e.target.value)}
                  className="text-gray-800 rounded px-2 py-1 w-32"
                />
                <button
                  onClick={handleAddSell}
                  disabled={actionLoading}
                  className="bg-white text-cyan-800 px-3 py-1 rounded-lg flex items-center gap-1"
                >
                  <FaPlus /> افزودن
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">شناسه فروش</th>
                    <th className="p-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {account.sellIds?.length ? account.sellIds.map((sid) => (
                    <tr key={sid} className="border-b hover:bg-gray-50">
                      <td className="p-3">{sid}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleRemoveSell(sid)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="2" className="p-4 text-gray-500">هیچ فروشی ثبت نشده</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receipts list */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">لیست رسیدهای مرتبط</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="شناسه رسید"
                  value={receiptIdInput}
                  onChange={(e) => setReceiptIdInput(e.target.value)}
                  className="text-gray-800 rounded px-2 py-1 w-32"
                />
                <button
                  onClick={handleAddReceipt}
                  disabled={actionLoading}
                  className="bg-white text-cyan-800 px-3 py-1 rounded-lg flex items-center gap-1"
                >
                  <FaPlus /> افزودن
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">شناسه رسید</th>
                    <th className="p-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {account.receiptIds?.length ? account.receiptIds.map((rid) => (
                    <tr key={rid} className="border-b hover:bg-gray-50">
                      <td className="p-3">{rid}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleRemoveReceipt(rid)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="2" className="p-4 text-gray-500">هیچ رسیدی ثبت نشده</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BuyerAccountManager;