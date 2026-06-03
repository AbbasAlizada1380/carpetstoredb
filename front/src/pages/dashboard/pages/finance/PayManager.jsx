// PayManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaEdit, FaTrash, FaTimes, FaExclamationTriangle, FaUserCheck, FaListAlt, FaChevronDown, FaChevronUp } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const PAY_API = `${BASE_URL}/pay`;
const UNPAID_API = `${BASE_URL}/customeraccount/unpaid`;

const PayManager = () => {
  // All payments data with pagination
  const [allPayments, setAllPayments] = useState([]);
  const [totalAllPayments, setTotalAllPayments] = useState(0);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  // Unpaid customers data
  const [unpaidData, setUnpaidData] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(true); // toggle form visibility
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch all payments (paginated) on mount and when page changes
  useEffect(() => {
    fetchAllPayments(currentPage);
  }, [currentPage]);

  useEffect(() => {
    fetchUnpaidCustomers();
  }, []);

  const fetchAllPayments = async (page = 1) => {
    setLoadingPayments(true);
    try {
      const res = await axios.get(`${PAY_API}?page=${page}&limit=${itemsPerPage}`);
      const { data, pagination } = res.data;
      const payments = data || [];
      setAllPayments(payments);
      const total = payments.reduce((sum, p) => sum + parseFloat(p.amountofmoney), 0);
      setTotalAllPayments(total);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.totalItems);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError("خطا در دریافت لیست تمام پرداخت‌ها");
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchUnpaidCustomers = async () => {
    setLoadingUnpaid(true);
    try {
      const res = await axios.get(UNPAID_API);
      if (res.data.success) {
        setUnpaidData(res.data.data);
        setTotalUnpaid(res.data.total);
        // Clear selected customer if they no longer owe money
        if (selectedCustomerId) {
          const stillExists = res.data.data.some(
            (item) => item.customer.id === parseInt(selectedCustomerId)
          );
          if (!stillExists) setSelectedCustomerId("");
        }
      }
    } catch (err) {
      console.error("Error fetching unpaid data:", err);
      setError("خطا در دریافت اطلاعات بدهی مشتریان");
    } finally {
      setLoadingUnpaid(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId("");
    setAmount("");
    setDescription("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("مبلغ باید یک عدد مثبت باشد");
      return;
    }
    if (!selectedCustomerId) {
      setError("لطفاً یک مشتری بدهکار انتخاب کنید");
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

      await axios.post(PAY_API, payload);
      setSuccess("پرداخت با موفقیت ثبت شد");
      resetForm();

      // Refresh current page and unpaid list
      await fetchAllPayments(currentPage);
      await fetchUnpaidCustomers();
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
      // Refresh current page (may need to go to previous page if last item on page)
      const newPage = allPayments.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(newPage);
      await fetchAllPayments(newPage);
      await fetchUnpaidCustomers();
    } catch (err) {
      setError("خطا در حذف پرداخت");
      console.error(err);
    }
  };

  const handleEdit = async (payment) => {
    // For edit, we could implement inline editing, but here we'll just show a simple prompt or open a modal? 
    // The requirement didn't specify edit, but we keep the edit button functionality similar to before.
    // Let's implement a simple edit modal for consistency.
    const newAmount = prompt("مبلغ جدید:", payment.amountofmoney);
    if (newAmount === null) return;
    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("مبلغ باید یک عدد مثبت باشد");
      return;
    }
    const newDescription = prompt("توضیحات جدید:", payment.description || "");
    try {
      await axios.put(`${PAY_API}/${payment.id}`, {
        customerId: payment.customerId,
        amountofmoney: amountNum,
        description: newDescription?.trim() || null,
      });
      setSuccess("پرداخت با موفقیت ویرایش شد");
      await fetchAllPayments(currentPage);
      await fetchUnpaidCustomers();
    } catch (err) {
      setError("خطا در ویرایش پرداخت");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Helper to get customer name by ID
  const getCustomerName = (customerId) => {
    const unpaidCustomer = unpaidData.find(item => item.customer.id === customerId);
    if (unpaidCustomer) return unpaidCustomer.customer.fullname;
    const paymentWithCustomer = allPayments.find(p => p.customerId === customerId);
    return paymentWithCustomer?.customer?.fullname || `مشتری ${customerId}`;
  };

  // Build customer list for dropdown (only those with unpaid)
  const customersWithUnpaid = unpaidData.map((item) => ({
    id: item.customer.id,
    fullname: item.customer.fullname,
    due: item.total_due,
  }));

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">مدیریت پرداخت‌ها</h2>

      {/* Two-column layout: Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Total payments card (current page sum) */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FaListAlt className="text-green-500" />
              <span className="font-semibold text-gray-700">مجموع پرداخت‌ها (صفحه جاری):</span>
            </div>
            <span className="text-xl font-bold text-green-600">
              {loadingPayments ? "..." : `${totalAllPayments.toFixed(2)} ؋`}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            تعداد کل پرداخت‌ها: {totalItems} | نمایش {allPayments.length} مورد در این صفحه
          </div>
        </div>

        {/* Unpaid summary card */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="text-red-500" />
              <span className="font-semibold text-gray-700">مجموع بدهی مشتریان:</span>
            </div>
            <span className="text-xl font-bold text-red-600">
              {loadingUnpaid ? "..." : `${totalUnpaid.toFixed(2)} ؋`}
            </span>
          </div>
          {unpaidData.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              تعداد مشتریان بدهکار: {unpaidData.length}
            </div>
          )}
        </div>
      </div>

      {/* Toggleable New Payment Form */}
      <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition"
        >
          <span className="font-semibold text-gray-800">ثبت پرداخت جدید برای مشتری بدهکار</span>
          {isFormOpen ? <FaChevronUp /> : <FaChevronDown />}
        </button>
        {isFormOpen && (
          <div className="p-4 bg-white">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  انتخاب مشتری بدهکار <span className="text-red-500">*</span>
                </label>
                {loadingUnpaid ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <FaSpinner className="animate-spin" />
                    <span>در حال بارگیری...</span>
                  </div>
                ) : customersWithUnpaid.length === 0 ? (
                  <div className="p-2 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                    <FaUserCheck />
                    <span>هیچ مشتری طلبکار وجود ندارد</span>
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">-- مشتری طلبکار را انتخاب کنید --</option>
                    {customersWithUnpaid.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullname} (بدهی: {c.due.toFixed(2)} ؋)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitLoading || customersWithUnpaid.length === 0}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  {submitLoading ? <FaSpinner className="animate-spin" /> : <FaSave />}
                  ثبت پرداخت
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* All Payments Table */}
      <div>
        <h3 className="text-lg font-semibold mb-4">لیست تمام پرداخت‌ها</h3>
        {loadingPayments ? (
          <div className="flex justify-center py-8">
            <FaSpinner className="animate-spin text-3xl text-gray-500" />
          </div>
        ) : allPayments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">هیچ پرداختی ثبت نشده است.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 border">مشتری</th>
                    <th className="py-2 px-4 border">تاریخ</th>
                    <th className="py-2 px-4 border">مبلغ (؋)</th>
                    <th className="py-2 px-4 border">توضیحات</th>
                    <th className="py-2 px-4 border">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="py-2 px-4 border">{getCustomerName(pay.customerId)}</td>
                      <td className="py-2 px-4 border text-center">
                        {new Date(pay.createdAt).toLocaleDateString("fa-IR")}
                      </td>
                      <td className="py-2 px-4 border text-center">{pay.amountofmoney}</td>
                      <td className="py-2 px-4 border">{pay.description || "—"}</td>
                      <td className="py-2 px-4 border text-center">
                        <button
                          onClick={() => handleEdit(pay)}
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
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="2" className="py-2 px-4 border text-left font-semibold">جمع کل این صفحه:</td>
                    <td className="py-2 px-4 border text-center font-bold text-green-600">
                      {totalAllPayments.toFixed(2)} ؋
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Success/Error messages */}
      {success && <div className="mt-4 text-green-600 text-sm">{success}</div>}
      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
    </div>
  );
};

export default PayManager;