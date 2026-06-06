// PayManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaSpinner,
  FaSave,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaMoneyBillWave,
  FaUsers,
  FaHandHoldingUsd,
  FaCalendarAlt,
} from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import PaymentReportsDownload from "../report/PaymentReportsDownload";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const PAY_API = `${BASE_URL}/pay`;
const UNPAID_API = `${BASE_URL}/customeraccount/unpaid`;

const PayManager = () => {
  const [allPayments, setAllPayments] = useState([]);
  const [totalAllPayments, setTotalAllPayments] = useState(0);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  const [unpaidData, setUnpaidData] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchAllPayments(currentPage);
    fetchUnpaidCustomers();
  }, [currentPage]);

  const fetchAllPayments = async (page = 1) => {
    setLoadingPayments(true);
    try {
      const res = await axios.get(`${PAY_API}?page=${page}&limit=${itemsPerPage}`);
      const { data, pagination } = res.data;
      setAllPayments(data);
      const total = data.reduce((sum, p) => sum + parseFloat(p.amountofmoney), 0);
      setTotalAllPayments(total);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.totalItems);
    } catch (err) {
      setError("خطا در دریافت لیست پرداخت‌ها");
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
        if (selectedCustomerId) {
          const stillExists = res.data.data.some(
            (item) => item.customer.id === parseInt(selectedCustomerId)
          );
          if (!stillExists) setSelectedCustomerId("");
        }
      }
    } catch (err) {
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
      await axios.post(PAY_API, {
        customerId: selectedCustomerId,
        amountofmoney: amountNum,
        description: description.trim() || null,
      });
      setSuccess("پرداخت با موفقیت ثبت شد");
      resetForm();
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
      const newPage = allPayments.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(newPage);
      await fetchAllPayments(newPage);
      await fetchUnpaidCustomers();
    } catch (err) {
      setError("خطا در حذف پرداخت");
    }
  };

  const handleEdit = async (payment) => {
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

  const getCustomerName = (customerId) => {
    const unpaidCustomer = unpaidData.find((item) => item.customer.id === customerId);
    if (unpaidCustomer) return unpaidCustomer.customer.fullname;
    const paymentWithCustomer = allPayments.find((p) => p.customerId === customerId);
    return paymentWithCustomer?.customer?.fullname || `مشتری ${customerId}`;
  };

  const customersWithUnpaid = unpaidData.map((item) => ({
    id: item.customer.id,
    fullname: item.customer.fullname,
    due: item.total_due,
  }));

  // Initial loading screen
  if (loadingPayments && allPayments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <FaSpinner className="text-5xl text-cyan-800 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">در حال بارگذاری پرداخت‌ها</h2>
        <p className="text-gray-600">لطفاً چند لحظه صبر کنید...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت پرداخت‌های مشتریان</h1>
        <p className="text-gray-600">ثبت و مدیریت پرداخت‌های دریافتی از مشتریان بدهکار</p>
        {totalUnpaid > 0 && (
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm">
            <FaHandHoldingUsd />
            <span>مجموع بدهی مشتریان: {totalUnpaid.toFixed(2)} ؋</span>
          </div>
        )}
      </div>

      {/* Toggleable Form Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="w-full bg-gradient-to-r from-cyan-800 to-cyan-600 p-4 flex justify-between items-center hover:from-cyan-900 hover:to-cyan-700 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FaMoneyBillWave className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-white">ثبت پرداخت جدید</h2>
              <p className="text-sm text-white/80">برای مشتری بدهکار</p>
            </div>
          </div>
          {isFormOpen ? <FaChevronUp className="text-white" /> : <FaChevronDown className="text-white" />}
        </button>

        {isFormOpen && (
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> انتخاب مشتری بدهکار
                  </label>
                  {loadingUnpaid ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                      <FaSpinner className="animate-spin text-cyan-600" />
                      <span className="text-gray-600">در حال بارگیری...</span>
                    </div>
                  ) : customersWithUnpaid.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                      <FaUsers />
                      <span>هیچ مشتری بدهکاری وجود ندارد</span>
                    </div>
                  ) : (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                      required
                    >
                      <option value="">-- انتخاب کنید --</option>
                      {customersWithUnpaid.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullname} (بدهی: {c.due.toFixed(2)} ؋)
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
                  disabled={submitLoading || customersWithUnpaid.length === 0}
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
                      ثبت پرداخت
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Payments Table Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white/20 rounded-full">
        <FaHandHoldingUsd className="h-6 w-6 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">لیست پرداخت‌ها</h2>
        <p className="text-sm text-white/80">
          {totalItems} پرداخت
          {loadingPayments && " • در حال بارگذاری..."}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      {loadingPayments && (
        <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
          <FaSpinner className="animate-spin" />
          در حال بارگذاری...
        </div>
      )}
      <PaymentReportsDownload />
    </div>
  </div>
</div>

        {loadingPayments ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری پرداخت‌ها...</p>
            <p className="text-sm text-gray-500 mt-2">لطفاً چند لحظه صبر کنید</p>
          </div>
        ) : allPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaMoneyBillWave className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">هیچ پرداختی ثبت نشده است</p>
            <p className="text-gray-400 text-sm mt-1">برای شروع، یک پرداخت جدید ثبت کنید</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">

              <table className="w-full text-center">
                <thead className="bg-cyan-50 text-cyan-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">مشتری</th>
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
                  {allPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                      <td className="p-3 font-medium text-gray-800">{getCustomerName(pay.customerId)}</td>
                      <td className="p-3 text-gray-600">
                        {new Date(pay.createdAt).toLocaleDateString("eng-en")}
                      </td>
                      <td className="p-3">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                          {parseFloat(pay.amountofmoney).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 max-w-xs truncate">
                        {pay.description || "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(pay)}
                            className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
                            title="ویرایش"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(pay.id)}
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
                      جمع کل این صفحه:
                    </td>
                    <td className="p-3 text-center font-bold text-green-700 text-lg">
                      {totalAllPayments.toFixed(2)} ؋
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
                  onPageChange={handlePageChange}
                />
              </div>
          </>
        )}
      </div>

      {/* Floating notifications */}
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

export default PayManager;