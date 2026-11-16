// components/stock/SellManager.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  FaTrash,
  FaEdit,
  FaSpinner,
  FaPlus,
  FaTimes,
  FaLayerGroup,
  FaEye,
} from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import SellForm from "./SellForm";
import BSaleForm from "./BSaleForm";
import BillReportsDownload from "../report/BillReportsDownload";
import SingleBillDownload from "../report/SingleBillDownload";
import BillDetailsModal from "./BillDetailsModal";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BILL_API = `${BASE_URL}/bill`;

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");

const SellManager = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saleType, setSaleType] = useState("carpet");

  // ✅ Edit state: arrays, not single objects
  const [editingSells, setEditingSells] = useState(null);
  const [editingBSales, setEditingBSales] = useState(null);
  const [editingMeta, setEditingMeta] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // ✅ NEW: bill details modal state
  const [viewingBillId, setViewingBillId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchBills = async (page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    try {
      const response = await axios.get(BILL_API, { params: { page, limit } });
      const { bills: fetchedBills, pagination } = response.data;
      setBills(fetchedBills || []);
      setTotalItems(pagination.totalItems);
      setTotalPages(pagination.totalPages);
      setCurrentPage(pagination.currentPage);
      setError("");
    } catch (err) {
      setError("بارگیری فاکتورها ناکام ماند");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage]);

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این فاکتور مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${BILL_API}/${id}`);
      if (bills.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
      else fetchBills(currentPage, itemsPerPage);
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  const loadBillDetails = async (billId) => {
    const res = await axios.get(`${BILL_API}/${billId}/details`);
    return res.data;
  };

  // ─── Edit: carpet ──────────────────────────────────────────────────────
  const handleEdit = async (bill) => {
    try {
      setLoadingEdit(true);
      setError("");

      const details = await loadBillDetails(bill.id);
      const allSells = Array.isArray(details.sellRecords)
        ? details.sellRecords
        : [];

      if (allSells.length === 0) {
        setError("این فاکتور هیچ فروش فرشی ندارد.");
        return;
      }

      setEditingSells(allSells);
      setEditingBSales(null);
      setEditingMeta({
        billId: details.id,
        billNumber: details.billNumber,
        buyerId: details.buyerId,
        buyerName: details.buyer?.fullname || null,
        isAfn: !!details.isAfn,
        DV: details.DV != null ? parseFloat(details.DV) : 65,
      });

      setSaleType("carpet");
      setShowForm(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "بارگیری داده‌های ویرایش ناکام ماند"
      );
      console.error(err);
    } finally {
      setLoadingEdit(false);
    }
  };

  // ─── Edit: blanket ─────────────────────────────────────────────────────
  const handleEditBlanket = async (bill) => {
    try {
      setLoadingEdit(true);
      setError("");

      const details = await loadBillDetails(bill.id);
      const allBSales = Array.isArray(details.bsaleRecords)
        ? details.bsaleRecords
        : [];

      if (allBSales.length === 0) {
        setError("این فاکتور هیچ فروش بلنکتی ندارد.");
        return;
      }

      setEditingBSales(allBSales);
      setEditingSells(null);
      setEditingMeta({
        billId: details.id,
        billNumber: details.billNumber,
        buyerId: details.buyerId,
        buyerName: details.buyer?.fullname || null,
        isAfn: !!details.isAfn,
        DV: details.DV != null ? parseFloat(details.DV) : 65,
      });

      setSaleType("blanket");
      setShowForm(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "بارگیری داده‌های ویرایش ناکام ماند"
      );
      console.error(err);
    } finally {
      setLoadingEdit(false);
    }
  };

  // ─── Build initialEntries (one per DB row) ────────────────────────────
  const sellInitialEntries = useMemo(() => {
    if (!editingSells || editingSells.length === 0) {
      return [
        {
          typeId: "",
          categoryId: "",
          incomeId: "",
          incomeWidth: "",
          length: "",
          area: "",
          total: "",
          unit_price: "",
          isAfn: false,
          DV: 65,
        },
      ];
    }
    return editingSells.map((s) => ({
      sellId: s.id,
      typeId: s.categoryDetail?.type?.id || s.category?.typeId || "",
      categoryId: s.categoryId || "",
      incomeId: s.incomeId || "",
      incomeWidth: s.income?.width ?? "",
      length: s.length ?? "",
      area: s.area ?? "",
      total: s.total ?? "",
      unit_price: s.unit_price ?? "",
      isAfn: !!s.isAfn,
      DV: s.DV ?? 65,
      receipt: s.receipt ?? 0,
      remaind: s.remaind ?? 0,
    }));
  }, [editingSells]);

  const bsaleInitialEntries = useMemo(() => {
    if (!editingBSales || editingBSales.length === 0) {
      return [
        {
          typeId: "",
          categoryId: "",
          bexistId: "",
          quantity: "",
          unitPrice: "",
          total: "",
          isAfn: false,
          DV: 65,
        },
      ];
    }
    return editingBSales.map((b) => ({
      bsaleId: b.id,
      typeId: b.category?.typeId ?? b.categoryDetail?.typeId ?? "",
      categoryId: b.categoryId || "",
      bexistId: b.bexistId || "",
      quantity: b.quantity ?? "",
      unitPrice: b.unit_price ?? "",
      total: b.total ?? "",
      isAfn: !!b.isAfn,
      DV: b.DV ?? 65,
      receipt: b.receipt ?? 0,
      remaind: b.remaind ?? 0,
    }));
  }, [editingBSales]);

  const editingMetaMemo = useMemo(() => editingMeta, [editingMeta]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSells(null);
    setEditingBSales(null);
    setEditingMeta(null);
    fetchBills(currentPage, itemsPerPage);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSells(null);
    setEditingBSales(null);
    setEditingMeta(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "paid":
        return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">پرداخت شده</span>;
      case "partial":
        return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">پرداخت جزئی</span>;
      default:
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">پرداخت نشده</span>;
    }
  };

  const editKey =
    editingSells && editingSells.length
      ? `edit-sells-${editingSells.map((s) => s.id).join("-")}`
      : editingBSales && editingBSales.length
      ? `edit-bsales-${editingBSales.map((b) => b.id).join("-")}`
      : "new";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت فاکتورهای فروش</h1>
        <p className="text-gray-600">مشاهده، ویرایش و حذف فاکتورهای ثبت شده</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
        <div className="flex items-center gap-2 bg-white rounded-xl shadow-md p-1 border border-gray-200">
          <button
            onClick={() => setSaleType("carpet")}
            className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${saleType === "carpet" ? "bg-cyan-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            فروش فرش
          </button>
          <button
            onClick={() => setSaleType("blanket")}
            className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${saleType === "blanket" ? "bg-cyan-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <FaLayerGroup />
            فروش بلنکت
          </button>
        </div>

        <div>
          {!showForm ? (
            <button
              onClick={() => {
                setEditingSells(null);
                setEditingBSales(null);
                setEditingMeta(null);
                setShowForm(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 hover:from-cyan-900 hover:to-cyan-700 text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
            >
              <FaPlus />
              ثبت فروش {saleType === "carpet" ? "فرش" : "بلنکت"}
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
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaSpinner className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {showForm && (
        <>
          {saleType === "carpet" ? (
            <SellForm
              key={editKey}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              editingId={editingSells?.[0]?.id ?? null}
              editingIds={editingSells ? editingSells.map((s) => s.id) : null}
              editingData={editingSells}
              editingMeta={editingMeta}
              initialEntries={sellInitialEntries}
            />
          ) : (
            <BSaleForm
              key={editKey}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              editingId={editingBSales?.[0]?.id ?? null}
              editingIds={editingBSales ? editingBSales.map((b) => b.id) : null}
              editingData={editingBSales}
              editingMeta={editingMeta}
              initialEntries={bsaleInitialEntries}
            />
          )}
        </>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست فاکتورها</h2>
                <p className="text-sm text-white/80">مدیریت تمام فاکتورهای فروش ثبت شده</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(loading || loadingEdit) && (
                <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                  <FaSpinner className="animate-spin" />
                  {loadingEdit ? "در حال بارگیری ویرایش..." : "در حال بارگذاری..."}
                </div>
              )}
              <BillReportsDownload />
            </div>
          </div>
        </div>

        {loading && bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری فاکتورها...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ فاکتوری ثبت نشده است</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "ثبت فروش ..." کلیک کنید</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-blue-50 text-cyan-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شماره فاکتور</th>
                    <th className="p-3 border-b font-semibold">خریدار</th>
                    <th className="p-3 border-b font-semibold">تاریخ</th>
                    <th className="p-3 border-b font-semibold">واحد</th>
                    <th className="p-3 border-b font-semibold">نرخ دالر</th>
                    <th className="p-3 border-b font-semibold">جمع کل</th>
                    <th className="p-3 border-b font-semibold">پرداخت شده</th>
                    <th className="p-3 border-b font-semibold">باقیمانده</th>
                    <th className="p-3 border-b font-semibold">وضعیت</th>
                    <th className="p-3 border-b font-semibold">تخفیف</th>
                    <th className="p-3 border-b font-semibold">یادداشت</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const hasSells = Array.isArray(bill.sells) && bill.sells.length > 0;
                    const hasBSales = Array.isArray(bill.bsales) && bill.bsales.length > 0;
                    return (
                      <tr key={bill.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                        <td className="p-3 font-mono text-sm">{bill.billNumber}</td>
                        <td className="p-3 font-medium text-gray-800">{bill.buyer?.fullname || "—"}</td>
                        <td className="p-3 text-gray-600">{new Date(bill.date).toLocaleDateString("eng-en")}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bill.isAfn ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {symbolFor(bill.isAfn)} {bill.isAfn ? "افغانی" : "دالر"}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{bill.DV ?? "—"}</td>
                        <td className="p-3">{new Intl.NumberFormat().format(bill.totalAmount)} {symbolFor(bill.isAfn)}</td>
                        <td className="p-3">{new Intl.NumberFormat().format(bill.paidAmount)} {symbolFor(bill.isAfn)}</td>
                        <td className="p-3">{new Intl.NumberFormat().format(bill.remainingAmount)} {symbolFor(bill.isAfn)}</td>
                        <td className="p-3">{getStatusBadge(bill.status)}</td>
                        <td className="p-3">{bill.discounted_amount}</td>
                        <td className="p-3 max-w-xs truncate">{bill.notes || "—"}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            {/* ✅ NEW: view bill details */}
                            <button
                              onClick={() => setViewingBillId(bill.id)}
                              className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="مشاهده جزئیات"
                            >
                              <FaEye />
                            </button>

                            {hasSells && (
                              <button
                                onClick={() => handleEdit(bill)}
                                className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
                                title="ویرایش فروش فرش"
                              >
                                <FaEdit />
                              </button>
                            )}
                            {hasBSales && (
                              <button
                                onClick={() => handleEditBlanket(bill)}
                                className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                                title="ویرایش فروش بلنکت"
                              >
                                <FaLayerGroup />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(bill.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="حذف"
                            >
                              <FaTrash />
                            </button>
                            <SingleBillDownload billId={bill.id} billNumber={bill.billNumber} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
            <div className="text-center text-gray-500 text-sm py-2 border-t">
              مجموع {totalItems} فاکتور | صفحه {currentPage} از {totalPages}
            </div>
          </>
        )}
      </div>

      {/* ✅ Bill details modal */}
      {viewingBillId && (
        <BillDetailsModal
          billId={viewingBillId}
          onClose={() => setViewingBillId(null)}
        />
      )}
    </div>
  );
};

export default SellManager;