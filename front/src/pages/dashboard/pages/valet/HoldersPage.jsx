import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Pagination from "../../pagination/Pagination.jsx";
import {
  FaUserTie,
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaSpinner,
  FaCheckCircle,
  FaWallet,
  FaSearch,
} from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const LIMIT = 20;

/* ---------------- helpers ---------------- */
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "۰ افغانی";
  return new Intl.NumberFormat("en-US").format(Number(amount)) + " افغانی";
};

const balanceColor = (balance) => {
  if (balance > 0) return "text-emerald-700";
  if (balance < 0) return "text-red-600";
  return "text-gray-600";
};

export default function HoldersPage({ refreshKey = 0, onChanged }) {
  /* ---------- list state ---------- */
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  /* ---------- filter ---------- */
  const [search, setSearch] = useState("");

  /* ---------- form modal ---------- */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ fullName: "", NIC: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  /* ---------------- fetch ---------------- */
  const fetchHolders = useCallback(
    async (p = 1) => {
      try {
        setLoading(true);
        setError(null);

        const params = { page: p, limit: LIMIT };
        if (search.trim()) params.q = search.trim();

        const res = await axios.get(`${BASE_URL}/holders`, { params });
        setHolders(res.data.holders || []);
        setPage(res.data.pagination?.currentPage || p);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalItems(res.data.pagination?.totalItems || 0);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "خطا در دریافت سهام داران"
        );
        setHolders([]);
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    fetchHolders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, refreshKey]);

  /* ---------------- form handlers ---------------- */
  const resetForm = () => {
    setForm({ fullName: "", NIC: "" });
    setEditingId(null);
    setFormError(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (holder) => {
    setForm({ fullName: holder.fullName, NIC: holder.NIC });
    setEditingId(holder.id);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.fullName.trim()) {
      setFormError("نام کامل الزامی است");
      return;
    }
    if (!form.NIC.trim()) {
      setFormError("شماره تذکره الزامی است");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        NIC: form.NIC.trim(),
      };

      if (editingId) {
        await axios.put(`${BASE_URL}/holders/${editingId}`, payload);
      } else {
        await axios.post(`${BASE_URL}/holders`, payload);
      }

      closeForm();
      fetchHolders(editingId ? page : 1);
      onChanged?.();

      setSuccessMessage(
        editingId ? "تغییرات ذخیره شد" : "سهام دار  جدید ثبت شد"
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
          err.message ||
          "خطا در ذخیره اطلاعات"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این سهام دار  اطمینان دارید؟")) return;
    try {
      await axios.delete(`${BASE_URL}/holders/${id}`);
      fetchHolders(page);
      onChanged?.();
      setSuccessMessage("سهام دار  حذف شد");
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "خطا در حذف سهام دار "
      );
    }
  };

  /* ---------------- render ---------------- */
  return (
    <div className="space-y-4">
      {/* Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50 animate-slideDown">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaCheckCircle className="text-green-600" />
              </div>
              <p className="flex-1 text-green-700">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="p-1 hover:bg-green-100 rounded-lg transition-colors"
              >
                <FaTimes className="text-green-600 text-sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/20 rounded-xl">
            <FaUserTie className="text-primary text-lg" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              سهام داران
            </h2>
            <p className="text-xs text-gray-500">
              {totalItems} سهام دار  ثبت شده
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <FaSearch className="text-xs" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو نام یا تذکره..."
              className="border border-gray-300 rounded-xl pr-9 pl-3 py-2 text-sm w-full md:w-64 bg-white focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl hover:opacity-90 transition flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <FaPlus />
            افزودن سهام دار 
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <FaSpinner className="text-3xl text-primary animate-spin mx-auto mb-3" />
            <p className="text-gray-600">در حال بارگذاری...</p>
          </div>
        ) : holders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <FaUserTie className="text-primary text-2xl" />
            </div>
            <p className="text-gray-500">هیچ سهام دار ی ثبت نشده است</p>
            <p className="text-gray-400 text-xs mt-1">
              برای شروع، روی «افزودن سهام دار » کلیک کنید
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary to-primary/80">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase">
                    #
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase">
                    نام کامل
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase">
                    شماره تذکره
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase">
                    موجودی
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">
                    عملیات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {holders.map((h) => (
                  <tr key={h.id} className="hover:bg-primary/5 transition">
                    <td className="px-4 py-3 text-sm font-semibold text-primary">
                      #{h.id}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {h.fullName}
                    </td>
                    <td
                      className="px-4 py-3 text-sm text-gray-700 font-mono"
                    
                    >
                      {h.NIC}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`text-sm font-bold ${balanceColor(
                          Number(h.balance || 0)
                        )}`}
                      >
                        {formatCurrency(h.balance)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(h)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition"
                          title="ویرایش"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(h.id)}
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
        )}

        {totalPages > 1 && !loading && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => fetchHolders(p)}
            />
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <FaUserTie className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold">
                    {editingId ? "ویرایش سهام دار " : "افزودن سهام دار "}
                  </h3>
                  <p className="text-xs text-white/80">
                    {editingId
                      ? `ویرایش اطلاعات سهام دار  #${editingId}`
                      : "ثبت اطلاعات سهام دار  جدید"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeForm}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="بستن"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6">
              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500">*</span> نام کامل
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    placeholder="نام کامل سهام دار "
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={submitting}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500">*</span> شماره تذکره
                  </label>
                  <input
                    type="text"
                    value={form.NIC}
                    onChange={(e) =>
                      setForm({ ...form, NIC: e.target.value })
                    }
                    placeholder="XXXXX-XXXXXXX-X"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary focus:border-primary"
                    dir="ltr"
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={submitting}
                    className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium flex items-center gap-2"
                  >
                    <FaTimes />
                    لغو
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-5 py-2.5 rounded-xl font-medium shadow-md transition flex items-center gap-2 ${
                      submitting
                        ? "bg-gray-400 cursor-not-allowed text-white"
                        : "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 text-white"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <FaSpinner className="animate-spin h-4 w-4" />
                        در حال ذخیره...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle />
                        {editingId ? "ذخیره تغییرات" : "ثبت سهام دار "}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}