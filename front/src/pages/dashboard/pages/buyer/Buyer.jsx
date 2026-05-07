import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaCheck, FaTimes, FaSpinner, FaUserPlus, FaSearch, FaUsers, FaUserCheck } from "react-icons/fa";
import Pagination from "../../pagination/Pagination";

const Buyer = () => {
  const BASE_URL = import.meta.env.VITE_BASE_URL;
  const API = `${BASE_URL}/buyer`;

  const [buyers, setBuyers] = useState([]);
  const [search, setSearch] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage] = useState(10);
  const [isFiltering, setIsFiltering] = useState(false);

  const [formData, setFormData] = useState({
    fullname: "",
    phoneNumber: "",
    isActive: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false); // Toggle form visibility

  /* ===========================
     Get Buyers (with pagination)
  =========================== */
  const fetchBuyers = async (page = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      if (isFiltering) return;
      const res = await axios.get(`${API}`, {
        params: { page, limit: perPage }
      });
      setBuyers(res.data.buyers || []);
      if (res.data.pagination) {
        setCurrentPage(res.data.pagination.currentPage);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setTotalPages(1);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to fetch buyers");
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers(1);
  }, []);

  /* ===========================
     Get Active Buyers (all)
  =========================== */
  const getActiveBuyers = async () => {
    setLoading(true);
    setError(null);
    setIsFiltering(true);
    setCurrentPage(1);
    try {
      const res = await axios.get(`${API}/active`);
      setBuyers(res.data.customers || []);
      setTotalPages(1);
    } catch (error) {
      console.error(error);
      setError("Failed to fetch active buyers");
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  /* ===========================
     Search Buyers (all)
  =========================== */
  const searchBuyers = async () => {
    setLoading(true);
    setError(null);
    if (!search.trim()) {
      setIsFiltering(false);
      fetchBuyers(1);
      setLoading(false);
      return;
    }
    setIsFiltering(true);
    setCurrentPage(1);
    try {
      const res = await axios.get(`${API}/search?q=${search}`);
      setBuyers(res.data);
      setTotalPages(1);
    } catch (error) {
      console.error(error);
      setError("Search failed");
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  /* ===========================
     Show All (reset to paginated list)
  =========================== */
  const showAll = () => {
    setIsFiltering(false);
    setSearch("");
    fetchBuyers(1);
  };

  /* ===========================
     Handle Page Change
  =========================== */
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    fetchBuyers(page);
  };

  /* ===========================
     Create Buyer
  =========================== */
  const createBuyer = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API}`, formData);
      setFormData({ fullname: "", phoneNumber: "", isActive: true });
      setEditingId(null);
      setShowForm(false); // Close form after successful creation
      if (isFiltering) {
        if (search.trim()) searchBuyers();
        else getActiveBuyers();
      } else {
        fetchBuyers(currentPage);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to create buyer");
    } finally {
      setLoading(false);
    }
  };

  /* ===========================
     Update Buyer
  =========================== */
  const updateBuyer = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.put(`${API}/${editingId}`, formData);
      setEditingId(null);
      setFormData({ fullname: "", phoneNumber: "", isActive: true });
      setShowForm(false); // Close form after update
      if (isFiltering) {
        if (search.trim()) searchBuyers();
        else getActiveBuyers();
      } else {
        fetchBuyers(currentPage);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to update buyer");
    } finally {
      setLoading(false);
    }
  };

  /* ===========================
     Delete Buyer
  =========================== */
  const deleteBuyer = async (id) => {
    if (!window.confirm("Are you sure you want to delete this buyer?")) return;
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API}/${id}`);
      if (isFiltering) {
        if (search.trim()) searchBuyers();
        else getActiveBuyers();
      } else {
        fetchBuyers(currentPage);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to delete buyer");
    } finally {
      setLoading(false);
    }
  };

  /* ===========================
     Edit Buyer (populate form & show)
  =========================== */
  const editBuyer = (buyer) => {
    setEditingId(buyer.id);
    setFormData({
      fullname: buyer.fullname,
      phoneNumber: buyer.phoneNumber || "",
      isActive: buyer.isActive,
    });
    setShowForm(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Cancel editing / close form
  const cancelForm = () => {
    setEditingId(null);
    setFormData({ fullname: "", phoneNumber: "", isActive: true });
    setShowForm(false);
  };

  // Initial loading (only before first data)
  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    const init = async () => {
      await fetchBuyers(1);
      setInitialLoading(false);
    };
    init();
  }, []);

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <FaSpinner className="text-5xl text-cyan-800 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">در حال بارگذاری خریداران</h2>
        <p className="text-gray-600">لطفاً چند لحظه صبر کنید...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت خریداران</h1>
        <p className="text-gray-600">ثبت، جستجو و مدیریت اطلاعات خریداران</p>
        {editingId && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded-xl max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <FaEdit className="h-5 w-5" />
              <span className="font-semibold">حالت ویرایش – خریدار #{editingId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Form Button */}
      <div className=" justify-center">
        <button
          onClick={() => {
            if (!showForm) {
              setEditingId(null);
              setFormData({ fullname: "", phoneNumber: "", isActive: true });
            }
            setShowForm(!showForm);
          }}
          className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-xl hover:from-cyan-900 hover:to-cyan-700 transition font-medium shadow-md flex items-center gap-2"
        >
          <FaUserPlus />
          {showForm ? "بستن فرم" : "ثبت خریدار جدید"}
        </button>
      </div>

      {/* Form Section (toggleable) */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <FaUserPlus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "ویرایش خریدار" : "ثبت خریدار جدید"}
                </h2>
                <p className="text-sm text-white/80">
                  {editingId ? "ویرایش اطلاعات خریدار" : "اطلاعات خریدار را وارد کنید"}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <input
                type="text"
                name="fullname"
                placeholder="نام کامل"
                value={formData.fullname}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              <input
                type="text"
                name="phoneNumber"
                placeholder="شماره تماس"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-5 w-5 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                />
                <span>فعال</span>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelForm}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                لغو
              </button>
              <button
                onClick={editingId ? updateBuyer : createBuyer}
                disabled={loading}
                className="px-5 py-2 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-lg hover:from-cyan-900 hover:to-cyan-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                {editingId ? "ذخیره تغییرات" : "ثبت خریدار"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error & Loading */}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-xl border border-red-200">
          ⚠️ {error}
        </div>
      )}


      {/* Buyers Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <FaUsers className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست خریداران</h2>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
                <FaSpinner className="animate-spin" />
                در حال بارگذاری...
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead className="bg-blue-50 text-cyan-800">
              <tr>
                <th className="p-3 border-b font-semibold">ID</th>
                <th className="p-3 border-b font-semibold">نام کامل</th>
                <th className="p-3 border-b font-semibold">شماره تماس</th>
                <th className="p-3 border-b font-semibold">وضعیت</th>
                <th className="p-3 border-b font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {buyers.length === 0 && !loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    هیچ خریداری یافت نشد.
                  </td>
                </tr>
              ) : (
                buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                    <td className="p-3 text-gray-600">{buyer.id}</td>
                    <td className="p-3 font-medium text-gray-800">{buyer.fullname}</td>
                    <td className="p-3 text-gray-600">{buyer.phoneNumber || "—"}</td>
                    <td className="p-3">
                      {buyer.isActive ? (
                        <span className="flex items-center justify-center gap-1 text-green-600">
                          <FaCheck /> فعال
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-red-600">
                          <FaTimes /> غیرفعال
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => editBuyer(buyer)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                          title="ویرایش"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => deleteBuyer(buyer.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="حذف"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Component */}
      {!isFiltering && totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default Buyer;