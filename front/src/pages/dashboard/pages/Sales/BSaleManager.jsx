// components/stock/BSaleManager.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaTimes } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";
import BSaleForm from "./BSaleForm";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BSALES_API = `${BASE_URL}/bsales`;
const BILL_API = `${BASE_URL}/bill`;

const symbolFor = (isAfn) => (isAfn ? "؋" : "$");
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const BSaleManager = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // ✅ Edit state — array of BSale rows + bill meta
  const [editingBSales, setEditingBSales] = useState(null);
  const [editingMeta, setEditingMeta] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchSales = async (currentPage = page, itemsPerPage = limit) => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(BSALES_API, {
        params: { page: currentPage, limit: itemsPerPage },
      });
      const { data, totalItems, totalPages, currentPage: curPage } = res.data;
      setSales(data || []);
      setTotalItems(totalItems || 0);
      setTotalPages(totalPages || 1);
      setPage(curPage || 1);
    } catch (err) {
      setError(err.response?.data?.message || "بارگیری داده‌ها ناکام ماند");
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(page, limit);
  }, [page, limit]);

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingBSales(null);
    setEditingMeta(null);
    fetchSales(page, limit);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingBSales(null);
    setEditingMeta(null);
  };

  const handleAddNew = () => {
    setEditingBSales(null);
    setEditingMeta(null);
    setShowForm(true);
  };

  // ✅ Edit: load the full bill details so we get ALL bsales + bill meta.
  // We use GET /bill/:id/details for consistency with SellManager.
  const handleEdit = async (sale) => {
    try {
      setLoadingEdit(true);
      setError("");

      // The row in the table has bill info implicitly. If it doesn't,
      // fall back to a per-row fetch + resolve parent bill via /bsales/by-bill/:id.
      // Most BSales queries include `id` from the sale row.
      // Strategy: fetch the parent bill via the by-bill endpoint if sale.billId is present,
      // otherwise fetch the single bsale and use its parentBill discovery.
      let details = null;

      // If the row already carries the billId (from a custom backend field), use it.
      if (sale.billId) {
        const res = await axios.get(`${BILL_API}/${sale.billId}/details`);
        details = res.data;
      } else {
        // Fallback: fetch the bsale row directly (single-row edit)
        const res = await axios.get(`${BSALES_API}/${sale.id}`);
        const bsale = res.data;

        // Build a minimal "details" shape matching /bill/:id/details
        details = {
          id: null,
          billNumber: null,
          buyerId: bsale.buyerId,
          buyer: bsale.buyer,
          isAfn: !!bsale.isAfn,
          DV: bsale.DV != null ? parseFloat(bsale.DV) : 65,
          bsaleRecords: [bsale],
          sellRecords: [],
        };
      }

      const allBSales = Array.isArray(details.bsaleRecords)
        ? details.bsaleRecords
        : [];

      if (allBSales.length === 0) {
        setError("این فاکتور هیچ فروش بلنکتی ندارد.");
        return;
      }

      setEditingBSales(allBSales);
      setEditingMeta({
        billId: details.id,
        billNumber: details.billNumber,
        buyerId: details.buyerId,
        buyerName: details.buyer?.fullname || null,
        isAfn: !!details.isAfn,
        DV: details.DV != null ? parseFloat(details.DV) : 65,
      });

      setShowForm(true);
    } catch (err) {
      setError(err.response?.data?.message || "بارگیری داده‌های ویرایش ناکام ماند");
      console.error(err);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
    setLoading(true);
    try {
      await axios.delete(`${BSALES_API}/${id}`);
      if (sales.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchSales(page, limit);
      }
    } catch (err) {
      setError(err.response?.data?.message || "حذف ناکام ماند");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  // ✅ Build initialEntries (one per row) — same shape as SellForm's
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
          receipt: 0,
          remaind: 0,
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

  const editKey =
    editingBSales && editingBSales.length
      ? `edit-bsales-${editingBSales.map((b) => b.id).join("-")}`
      : "new";

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-xl shadow-lg border border-gray-100 mt-8" dir="rtl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">مدیریت فروش بلنکت</h2>
        <p className="text-sm text-gray-500">ثبت و مدیریت فروش از موجودی بلنکت</p>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mb-6">
          <div className="flex items-center gap-2">
            <FaTimes className="text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="flex justify-center mb-6">
        {!showForm ? (
          <button
            onClick={handleAddNew}
            className="px-6 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
          >
            <FaPlus />
            ثبت فروش جدید
          </button>
        ) : (
          <button
            onClick={handleFormCancel}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition font-medium shadow-md flex items-center gap-2"
          >
            <FaTimes />
            بستن فرم
          </button>
        )}
      </div>

      {showForm && (
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

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-indigo-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست فروش‌های بلنکت</h2>
                <p className="text-sm text-white/80">مدیریت تمام فروش‌های ثبت شده</p>
              </div>
            </div>
            {(loading || loadingEdit) && (
              <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                <FaSpinner className="animate-spin" />
                {loadingEdit ? "در حال بارگیری ویرایش..." : "در حال بارگذاری..."}
              </div>
            )}
          </div>
        </div>

        {loading && sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-4xl text-indigo-800 animate-spin mb-4" />
            <p className="text-gray-600">در حال بارگذاری داده‌ها...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">هیچ فروشی ثبت نشده است</p>
              <p className="text-gray-400 text-sm mt-1">برای شروع، روی دکمه "ثبت فروش جدید" کلیک کنید</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-indigo-50 text-indigo-800">
                  <tr>
                    <th className="p-3 border-b font-semibold">شناسه</th>
                    <th className="p-3 border-b font-semibold">دسته‌بندی</th>
                    <th className="p-3 border-b font-semibold">موجودی</th>
                    <th className="p-3 border-b font-semibold">تعداد</th>
                    <th className="p-3 border-b font-semibold">قیمت واحد</th>
                    <th className="p-3 border-b font-semibold">واحد</th>
                    <th className="p-3 border-b font-semibold">نرخ دالر</th>
                    <th className="p-3 border-b font-semibold">جمع کل</th>
                    <th className="p-3 border-b font-semibold">دریافتی</th>
                    <th className="p-3 border-b font-semibold">باقیمانده</th>
                    <th className="p-3 border-b font-semibold">خریدار</th>
                    <th className="p-3 border-b font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                      <td className="p-3 text-gray-600">{item.id}</td>
                      <td className="p-3">{item.category?.name || item.categoryId}</td>
                      <td className="p-3">{item.bExist?.id || item.bexistId}</td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3">{item.unit_price}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.isAfn ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {symbolFor(item.isAfn)} {currencyLabel(item.isAfn)}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{item.DV ?? "—"}</td>
                      <td className="p-3 font-bold text-indigo-700">
                        {item.total} {symbolFor(item.isAfn)}
                      </td>
                      <td className="p-3">{item.receipt} {symbolFor(item.isAfn)}</td>
                      <td className="p-3">{item.remaind} {symbolFor(item.isAfn)}</td>
                      <td className="p-3">{item.buyer?.fullname || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                            title="ویرایش"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
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
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <div className="text-center text-gray-500 text-sm py-2 border-t">
              مجموع {totalItems} رکورد | صفحه {page} از {totalPages}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BSaleManager;