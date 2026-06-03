import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaEdit, FaTrash, FaTimes, FaExclamationTriangle, FaUserCheck, FaListAlt, FaChevronDown, FaChevronUp } from "react-icons/fa";
import Pagination from "../pagination/Pagination";

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
      // Response format: { success: true, data: [ { customer: {...}, total_due, details } ], total }
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

  // Helper to get buyer name from the unpaidBuyers array (structure: { customer: { id, fullname }, ... })
  const getBuyerName = (buyerId) => {
    const buyerEntry = unpaidBuyers.find(item => item.customer?.id === buyerId);
    return buyerEntry?.customer?.fullname || `خریدار ${buyerId}`;
  };

  // Build dropdown options from unpaidBuyers using the correct "customer" field
  const buyersWithUnpaid = unpaidBuyers.map(item => ({
    id: item.customer.id,
    fullname: item.customer.fullname,
    due: item.total_due,
  }));

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">مدیریت رسیدهای خریداران</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-center">
            <FaListAlt className="text-green-500" />
            <span className="font-semibold">مجموع رسیدها (صفحه جاری):</span>
            <span className="text-xl font-bold text-green-600">{totalAllReceipts.toFixed(2)} ؋</span>
          </div>
          <div className="mt-2 text-sm">کل رسیدها: {totalItems} | نمایش {allReceipts.length} مورد</div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <FaExclamationTriangle className="text-red-500" />
            <span className="font-semibold">مجموع بدهی خریداران:</span>
            <span className="text-xl font-bold text-red-600">{totalUnpaid.toFixed(2)} ؋</span>
          </div>
          <div className="mt-2 text-sm">تعداد خریداران بدهکار: {unpaidBuyers.length}</div>
        </div>
      </div>

      {/* Toggleable form */}
      <div className="mb-8 border rounded-lg overflow-hidden">
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="w-full flex justify-between p-4 bg-gray-50">
          <span className="font-semibold">ثبت رسید جدید برای خریدار بدهکار</span>
          {isFormOpen ? <FaChevronUp /> : <FaChevronDown />}
        </button>
        {isFormOpen && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">انتخاب خریدار بدهکار *</label>
              {loadingUnpaid ? <FaSpinner className="animate-spin" /> : buyersWithUnpaid.length === 0 ? (
                <div className="flex items-center gap-2 text-green-700"><FaUserCheck /> هیچ خریدار بدهکاری وجود ندارد</div>
              ) : (
                <select value={selectedBuyerId} onChange={(e) => setSelectedBuyerId(e.target.value)} className="w-full border rounded-lg px-4 py-2" required>
                  <option value="">-- انتخاب کنید --</option>
                  {buyersWithUnpaid.map(b => (
                    <option key={b.id} value={b.id}>{b.fullname} (بدهی: {b.due.toFixed(2)} ؋)</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">مبلغ (؋) *</label>
              <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">توضیحات</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="2" className="w-full border rounded-lg px-3 py-2" />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={submitLoading || buyersWithUnpaid.length === 0} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              {submitLoading ? <FaSpinner className="animate-spin" /> : <FaSave />} ثبت رسید
            </button>
          </form>
        )}
      </div>

      {/* Receipts table */}
      <h3 className="text-lg font-semibold mb-4">لیست تمام رسیدها</h3>
      {loadingReceipts ? <FaSpinner className="animate-spin mx-auto" /> : allReceipts.length === 0 ? (
        <p className="text-gray-500 text-center py-8">هیچ رسیدی ثبت نشده است.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 border">خریدار</th>
                  <th className="py-2 px-4 border">تاریخ</th>
                  <th className="py-2 px-4 border">مبلغ (؋)</th>
                  <th className="py-2 px-4 border">توضیحات</th>
                  <th className="py-2 px-4 border">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {allReceipts.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 px-4 border">{getBuyerName(r.buyerId)}</td>
                    <td className="py-2 px-4 border text-center">
                      {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                    </td>
                    <td className="py-2 px-4 border text-center">{r.amountofmoney}</td>
                    <td className="py-2 px-4 border">{r.description || "—"}</td>
                    <td className="py-2 px-4 border text-center">
                      <button onClick={() => handleEdit(r)} className="text-blue-600 mx-1"><FaEdit /></button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 mx-1"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2" className="py-2 px-4 border font-semibold">جمع کل:</td>
                  <td className="py-2 px-4 border text-center font-bold text-green-600">
                    {totalAllReceipts.toFixed(2)} ؋
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
        </>
      )}
      {success && <div className="mt-4 text-green-600">{success}</div>}
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
};

export default ReceiptManager;