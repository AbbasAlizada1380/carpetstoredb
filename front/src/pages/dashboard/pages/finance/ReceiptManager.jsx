import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaSpinner,
  FaSave,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaReceipt,
  FaUsers,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaFileInvoiceDollar,
} from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import ReceiptReportsDownload from "../report/ReceiptReportsDownload";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const RECEIPT_API = `${BASE_URL}/receipt`;
const UNPAID_BUYERS_API = `${BASE_URL}/buyeraccount/unpaid`;

const ReceiptManager = () => {
  const [allReceipts, setAllReceipts] = useState([]);
  const [totalAllReceipts, setTotalAllReceipts] = useState(0);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  const [unpaidBuyers, setUnpaidBuyers] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(true);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchAllReceipts(currentPage);
    fetchUnpaidBuyers();
  }, [currentPage]);

  const fetchAllReceipts = async (page) => {
    setLoadingReceipts(true);
    try {
      const res = await axios.get(`${RECEIPT_API}?page=${page}&limit=${itemsPerPage}`);
      const { data, pagination } = res.data;
      setAllReceipts(data);
      const total = data.reduce((sum, r) => sum + parseFloat(r.amountofmoney), 0);
      setTotalAllReceipts(total);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.totalItems);
    } catch (err) {
      setError("خطا در دریافت لیست رسیدها");
    } finally {
      setLoadingReceipts(false);
    }
  };

  const fetchUnpaidBuyers = async () => {
    setLoadingUnpaid(true);
    try {
      const res = await axios.get(UNPAID_BUYERS_API);
      setUnpaidBuyers(res.data.data || []);
      setTotalUnpaid(res.data.total || 0);
    } catch (err) {
      setError("خطا در دریافت اطلاعات بدهکاران");
    } finally {
      setLoadingUnpaid(false);
    }
  };

  const resetForm = () => {
    setSelectedBuyerId("");
    setAmount("");
    setDescription("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("مبلغ باید عدد مثبت باشد");
      return;
    }
    if (!selectedBuyerId) {
      setError("لطفاً خریدار بدهکار را انتخاب کنید");
      return;
    }

    setSubmitLoading(true);
    setError("");
    setSuccess("");
    try {
      await axios.post(RECEIPT_API, {
        buyerId: selectedBuyerId,
        amountofmoney: amountNum,
        description: description.trim() || null,
      });
      setSuccess("رسید با موفقیت ثبت شد");
      resetForm();
      await fetchAllReceipts(currentPage);
      await fetchUnpaidBuyers();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در ثبت رسید");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رسید اطمینان دارید؟")) return;
    try {
      await axios.delete(`${RECEIPT_API}/${id}`);
      setSuccess("رسید حذف شد");
      const newPage = allReceipts.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(newPage);
      await fetchAllReceipts(newPage);
      await fetchUnpaidBuyers();
    } catch (err) {
      setError("خطا در حذف رسید");
    }
  };

  const handleEdit = async (receipt) => {
    const newDesc = prompt("توضیحات جدید:", receipt.description || "");
    if (newDesc === null) return;
    try {
      await axios.put(`${RECEIPT_API}/${receipt.id}`, { description: newDesc });
      setSuccess("رسید ویرایش شد");
      await fetchAllReceipts(currentPage);
    } catch (err) {
      setError("خطا در ویرایش رسید");
    }
  };

  const getBuyerName = (buyerId) => {
    const buyerEntry = unpaidBuyers.find(item => item.customer?.id === buyerId);
    return buyerEntry?.customer?.fullname || `خریدار ${buyerId}`;
  };

  const buyersWithUnpaid = unpaidBuyers.map(item => ({
    id: item.customer.id,
    fullname: item.customer.fullname,
    due: item.total_due,
  }));

  // Loading screen for initial load
  if (loadingReceipts && allReceipts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <FaSpinner className="text-5xl text-cyan-800 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">در حال بارگذاری رسیدها</h2>
        <p className="text-gray-600">لطفاً چند لحظه صبر کنید...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت رسیدهای خریداران</h1>
        <p className="text-gray-600">ثبت و مدیریت رسیدهای پرداختی خریداران</p>
      </div>

      {/* Toggleable Form Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Form Header */}
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="w-full bg-gradient-to-r from-cyan-800 to-cyan-600 p-4 flex justify-between items-center hover:from-cyan-900 hover:to-cyan-700 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FaFileInvoiceDollar className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-white">ثبت رسید جدید</h2>
              <p className="text-sm text-white/80">برای خریدار بدهکار</p>
            </div>
          </div>
          {isFormOpen ? <FaChevronUp className="text-white" /> : <FaChevronDown className="text-white" />}
        </button>

        {/* Form Content */}
        {isFormOpen && (
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Buyer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> انتخاب خریدار بدهکار
                  </label>
                  {loadingUnpaid ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                      <FaSpinner className="animate-spin text-cyan-600" />
                      <span className="text-gray-600">در حال بارگیری...</span>
                    </div>
                  ) : buyersWithUnpaid.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                      <FaUsers />
                      <span>هیچ خریدار بدهکاری وجود ندارد</span>
                    </div>
                  ) : (
                    <select
                      value={selectedBuyerId}
                      onChange={(e) => setSelectedBuyerId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                      required
                    >
                      <option value="">-- انتخاب کنید --</option>
                      {buyersWithUnpaid.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.fullname} (بدهی: {b.due.toFixed(2)} ؋)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> مبلغ (؋)
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      <FaMoneyBillWave />
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">توضیحات</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="2"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    placeholder="توضیحات اختیاری..."
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitLoading || buyersWithUnpaid.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-lg hover:from-cyan-900 hover:to-cyan-700 transition font-medium shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submitLoading ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      در حال ثبت...
                    </>
                  ) : (
                    <>
                      <FaSave />
                      ثبت رسید
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Receipts Table Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <FaReceipt className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">لیست رسیدها</h2>
                <p className="text-sm text-white/80">
                  {totalItems} رسید
                  {loadingReceipts && " • در حال بارگذاری..."}
                </p>
              </div>
            </div>
            {loadingReceipts && (
              <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                <FaSpinner className="animate-spin" />
                در حال بارگذاری...
              </div>
            )}
            {/* Reports download component – styled as a button group */}
            <ReceiptReportsDownload />
          </div>
        </div>

        {/* Table Content */}
        {loadingReceipts ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری رسیدها...</p>
            <p className="text-sm text-gray-500 mt-2">لطفاً چند لحظه صبر کنید</p>
          </div>
        ) : allReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaReceipt className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">هیچ رسیدی ثبت نشده است</p>
            <p className="text-gray-400 text-sm mt-1">برای شروع، یک رسید جدید ثبت کنید</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-cyan-50 text-cyan-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">خریدار</th>
                    <th className="p-3 border-b font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <FaCalendarAlt />
                        تاریخ
                      </div>
                    </th>
                    <th className="p-3 border-b font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <FaMoneyBillWave />
                        مبلغ (؋)
                      </div>
                    </th>
                    <th className="p-3 border-b font-semibold">توضیحات</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {allReceipts.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 border-b last:border-0 transition-colors"
                    >
                      <td className="p-3 font-medium text-gray-800">{getBuyerName(r.buyerId)}</td>
                      <td className="p-3 text-gray-600">
                        {new Date(r.createdAt).toLocaleDateString("eng-en")}
                      </td>
                      <td className="p-3">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                          {parseFloat(r.amountofmoney).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 max-w-xs truncate">
                        {r.description || "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(r)}
                            className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
                            title="ویرایش توضیحات"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
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
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="2" className="p-3 text-left font-semibold text-gray-700">
                      جمع کل:
                    </td>
                    <td className="p-3 text-center font-bold text-green-700 text-lg">
                      {totalAllReceipts.toFixed(2)} ؋
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
              <div className="p-4 border-t">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
          </>
        )}
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg z-50">
          {success}
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default ReceiptManager;