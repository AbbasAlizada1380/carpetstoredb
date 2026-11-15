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
  FaHandHoldingUsd,
} from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import ReceiptReportsDownload from "../report/ReceiptReportsDownload";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const RECEIPT_API = `${BASE_URL}/receipt`;
const UNPAID_BUYERS_API = `${BASE_URL}/buyeraccount/unpaid`;

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const groupByCurrency = (items, getAmount, getIsAfn) => {
  const grouped = { afn: 0, usd: 0 };
  for (const item of items) {
    const amt = parseFloat(getAmount(item)) || 0;
    if (getIsAfn(item)) grouped.afn += amt;
    else grouped.usd += amt;
  }
  return grouped;
};

const formatGrouped = (grouped) => {
  const parts = [];
  if (grouped.usd > 0) parts.push(`$ ${grouped.usd.toFixed(2)}`);
  if (grouped.afn > 0) parts.push(`؋ ${grouped.afn.toFixed(2)}`);
  return parts.length ? parts.join(" + ") : "0";
};

/* ✅ Aggregate per-buyer debt per currency for display */
const buildBuyerRows = (unpaidData) => {
  const map = new Map(); // buyerId → { id, fullname, usd, afn }
  for (const item of unpaidData) {
    const id = item.customer.id;
    if (!map.has(id)) {
      map.set(id, {
        id,
        fullname: item.customer.fullname,
        usd: 0,
        afn: 0,
      });
    }
    const row = map.get(id);
    if (item.isAfn) row.afn += parseFloat(item.total_due) || 0;
    else row.usd += parseFloat(item.total_due) || 0;
  }
  return Array.from(map.values());
};

const ReceiptManager = () => {
  const [allReceipts, setAllReceipts] = useState([]);
  const [totalAllReceipts, setTotalAllReceipts] = useState({ afn: 0, usd: 0 });
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  const [unpaidData, setUnpaidData] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState({ afn: 0, usd: 0 });
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(true);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isAfn, setIsAfn] = useState(false);
  const [DV, setDV] = useState(65);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchAllReceipts(currentPage);
    fetchUnpaidBuyers();
  }, [currentPage]);

  // ─── Fetch receipts ───────────────────────────────────────────────
  const fetchAllReceipts = async (page = 1) => {
    setLoadingReceipts(true);
    try {
      const res = await axios.get(`${RECEIPT_API}?page=${page}&limit=${itemsPerPage}`);
      const { data, pagination } = res.data;
      setAllReceipts(data);
      setTotalAllReceipts(groupByCurrency(data, "amountofmoney", "isAfn"));
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.totalItems);
    } catch (err) {
      setError("خطا در دریافت لیست رسیدها");
    } finally {
      setLoadingReceipts(false);
    }
  };

  // ─── Fetch unpaid buyers ──────────────────────────────────────────
  const fetchUnpaidBuyers = async () => {
    setLoadingUnpaid(true);
    try {
      const res = await axios.get(UNPAID_BUYERS_API);
      if (res.data.success) {
        setUnpaidData(res.data.data);
        setTotalUnpaid(
          groupByCurrency(
            res.data.data,
            (item) => item.total_due,
            (item) => !!item.isAfn
          )
        );
        if (selectedBuyerId) {
          const stillExists = res.data.data.some(
            (item) => item.customer.id === parseInt(selectedBuyerId)
          );
          if (!stillExists) setSelectedBuyerId("");
        }
      }
    } catch (err) {
      setError("خطا در دریافت اطلاعات بدهی خریداران");
    } finally {
      setLoadingUnpaid(false);
    }
  };

  const resetForm = () => {
    setSelectedBuyerId("");
    setAmount("");
    setDescription("");
    setIsAfn(false);
    setDV(65);
  };

  // ─── Create receipt ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("مبلغ باید یک عدد مثبت باشد");
      return;
    }
    if (!selectedBuyerId) {
      setError("لطفاً یک خریدار بدهکار انتخاب کنید");
      return;
    }
    const DVNum = parseFloat(DV);
    if (isNaN(DVNum) || DVNum <= 0) {
      setError("نرخ دالر باید یک عدد مثبت باشد");
      return;
    }

    setSubmitLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await axios.post(RECEIPT_API, {
        buyerId: selectedBuyerId,
        amountofmoney: amountNum,
        description: description.trim() || null,
        isAfn,
        DV: DVNum,
      });
      const convertedCount =
        res.data?.updatedBills?.appliedTo?.filter((a) => a.converted).length || 0;
      setSuccess(
        convertedCount > 0
          ? `رسید ثبت شد — ${convertedCount} فاکتور با تبدیل ارز تسویه شد`
          : "رسید با موفقیت ثبت شد"
      );
      resetForm();
      await fetchAllReceipts(currentPage);
      await fetchUnpaidBuyers();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در ثبت رسید");
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رسید اطمینان دارید؟")) return;
    try {
      await axios.delete(`${RECEIPT_API}/${id}`);
      setSuccess("رسید حذف شد");
      const newPage =
        allReceipts.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(newPage);
      await fetchAllReceipts(newPage);
      await fetchUnpaidBuyers();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در حذف رسید");
    }
  };

  // ─── Edit (prompt-based, matching PayManager) ─────────────────────
  const handleEdit = async (receipt) => {
    const newAmount = prompt("مبلغ جدید:", receipt.amountofmoney);
    if (newAmount === null) return;
    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("مبلغ باید یک عدد مثبت باشد");
      return;
    }

    const currentCurrency = receipt.isAfn ? "AFN" : "USD";
    const currencyInput = prompt(`واحد پول (AFN یا USD):`, currentCurrency);
    if (currencyInput === null) return;
    const newIsAfn = currencyInput.trim().toUpperCase() === "AFN";

    const dvInput = prompt("نرخ دالر (DV):", receipt.DV ?? 65);
    if (dvInput === null) return;
    const DVNum = parseFloat(dvInput);
    if (isNaN(DVNum) || DVNum <= 0) {
      setError("نرخ دالر باید یک عدد مثبت باشد");
      return;
    }

    const newDescription = prompt("توضیحات جدید:", receipt.description || "");

    try {
      await axios.put(`${RECEIPT_API}/${receipt.id}`, {
        buyerId: receipt.buyerId,
        amountofmoney: amountNum,
        description: newDescription?.trim() || null,
        isAfn: newIsAfn,
        DV: DVNum,
      });
      setSuccess("رسید با موفقیت ویرایش شد");
      await fetchAllReceipts(currentPage);
      await fetchUnpaidBuyers();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در ویرایش رسید");
    }
  };

  const handlePageChange = (page) => setCurrentPage(page);

  const getBuyerName = (buyerId) => {
    const unpaidBuyer = unpaidData.find((item) => item.customer.id === buyerId);
    if (unpaidBuyer) return unpaidBuyer.customer.fullname;
    const receiptWithBuyer = allReceipts.find((r) => r.buyerId === buyerId);
    return receiptWithBuyer?.buyer?.fullname || `خریدار ${buyerId}`;
  };

  // ✅ one row per buyer, both currency debts shown
  const buyerRows = buildBuyerRows(unpaidData);

  // Preview of what the current amount will do (rough, before submit)
  const selectedRow = buyerRows.find((b) => b.id === parseInt(selectedBuyerId));
  const amountNum = parseFloat(amount) || 0;
  const previewNote = (() => {
    if (!selectedRow || amountNum <= 0) return null;
    const payDV = parseFloat(DV) || 65;
    const payCurrencyDebt = isAfn ? selectedRow.afn : selectedRow.usd;
    const otherCurrencyDebt = isAfn ? selectedRow.usd : selectedRow.afn;
    const otherInPayCurrency = isAfn
      ? otherCurrencyDebt * payDV
      : otherCurrencyDebt / payDV;
    const totalPayable = payCurrencyDebt + otherInPayCurrency;

    if (amountNum > totalPayable + 0.01) {
      return {
        type: "warn",
        text: `مبلغ بیشتر از کل بدهی قابل پرداخت (${totalPayable.toFixed(2)} ${symbolFor(isAfn)}) است`,
      };
    }
    if (amountNum > payCurrencyDebt + 0.01 && otherCurrencyDebt > 0) {
      return {
        type: "info",
        text: `بخشی از این رسید با نرخ ${payDV} به بدهی ${currencyLabel(!isAfn)} تبدیل خواهد شد`,
      };
    }
    return null;
  })();

  if (loadingReceipts && allReceipts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <FaSpinner className="text-5xl text-cyan-800 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">در حال بارگذاری رسیدها</h2>
        <p className="text-gray-600">لطفاً چند لحظه صبر کنید...</p>
      </div>
    );
  }

  const totalUnpaidSum = totalUnpaid.afn + totalUnpaid.usd;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت رسیدهای خریداران</h1>
        <p className="text-gray-600">ثبت و مدیریت رسیدهای پرداختی از خریداران بدهکار</p>
        {totalUnpaidSum > 0 && (
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm">
            <FaHandHoldingUsd />
            <span>مجموع بدهی خریداران: {formatGrouped(totalUnpaid)}</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="w-full bg-gradient-to-r from-cyan-800 to-cyan-600 p-4 flex justify-between items-center hover:from-cyan-900 hover:to-cyan-700 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FaReceipt className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-white">ثبت رسید جدید</h2>
              <p className="text-sm text-white/80">رسید چند ارزی مجاز است</p>
            </div>
          </div>
          {isFormOpen ? <FaChevronUp className="text-white" /> : <FaChevronDown className="text-white" />}
        </button>

        {isFormOpen && (
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> واحد پول رسید
                  </label>
                  <select
                    value={isAfn ? "afn" : "usd"}
                    onChange={(e) => setIsAfn(e.target.value === "afn")}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                  >
                    <option value="usd">$ دالر امریکایی</option>
                    <option value="afn">؋ افغانی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> نرخ دالر (DV)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={DV}
                    onChange={(e) => setDV(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    required
                  />
                </div>

                {/* Buyer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> انتخاب خریدار بدهکار
                  </label>
                  {loadingUnpaid ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                      <FaSpinner className="animate-spin text-cyan-600" />
                      <span className="text-gray-600">در حال بارگیری...</span>
                    </div>
                  ) : buyerRows.length === 0 ? (
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
                      {buyerRows.map((b) => {
                        const parts = [];
                        if (b.usd > 0) parts.push(`$ ${b.usd.toFixed(2)}`);
                        if (b.afn > 0) parts.push(`؋ ${b.afn.toFixed(2)}`);
                        return (
                          <option key={b.id} value={b.id}>
                            {b.fullname} (بدهی: {parts.join(" + ") || "0"})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> مبلغ ({symbolFor(isAfn)})
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

              {/* ✅ conversion preview */}
              {previewNote && (
                <div
                  className={`p-3 rounded-lg text-sm border ${
                    previewNote.type === "warn"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-blue-50 text-blue-800 border-blue-200"
                  }`}
                >
                  {previewNote.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitLoading || buyerRows.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-lg hover:from-cyan-900 hover:to-cyan-700 transition font-medium shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submitLoading ? (
                    <>
                      <FaSpinner className="animate-spin" /> در حال ثبت...
                    </>
                  ) : (
                    <>
                      <FaSave /> ثبت رسید
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
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
            <div className="flex items-center gap-4">
              {loadingReceipts && (
                <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                  <FaSpinner className="animate-spin" /> در حال بارگذاری...
                </div>
              )}
              <ReceiptReportsDownload />
            </div>
          </div>
        </div>

        {loadingReceipts ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری رسیدها...</p>
          </div>
        ) : allReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaReceipt className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">هیچ رسیدی ثبت نشده است</p>
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
                        <FaCalendarAlt /> تاریخ
                      </div>
                    </th>
                    <th className="p-3 border-b font-semibold">واحد</th>
                    <th className="p-3 border-b font-semibold">نرخ دالر</th>
                    <th className="p-3 border-b font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <FaMoneyBillWave /> مبلغ
                      </div>
                    </th>
                    <th className="p-3 border-b font-semibold">تسویه چند ارزی</th>
                    <th className="p-3 border-b font-semibold">توضیحات</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {allReceipts.map((r) => {
                    const converted =
                      (r.appliedTo || []).filter((a) => a.converted) || [];
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-gray-50 border-b last:border-0 transition-colors"
                      >
                        <td className="p-3 font-medium text-gray-800">
                          {getBuyerName(r.buyerId)}
                        </td>
                        <td className="p-3 text-gray-600">
                          {new Date(r.createdAt).toLocaleDateString("en-US")}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.isAfn
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {symbolFor(r.isAfn)} {currencyLabel(r.isAfn)}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{r.DV ?? "—"}</td>
                        <td className="p-3">
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                            {parseFloat(r.amountofmoney).toLocaleString()}{" "}
                            {symbolFor(r.isAfn)}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          {converted.length === 0 ? (
                            "—"
                          ) : (
                            <span className="inline-flex flex-col gap-0.5">
                              {converted.map((c, i) => (
                                <span key={i} className="text-cyan-700">
                                  فاکتور #{c.billId}: {c.appliedInBillCurrency}{" "}
                                  {c.billCurrency} (نرخ {c.rate})
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-600 max-w-xs truncate">
                          {r.description || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(r)}
                              className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
                              title="ویرایش"
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
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="5" className="p-3 text-left font-semibold text-gray-700">
                      جمع کل این صفحه:
                    </td>
                    <td colSpan="3" className="p-3 text-center font-bold text-green-700 text-lg">
                      {formatGrouped(totalAllReceipts)}
                    </td>
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

      {/* Notifications */}
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