// CustomersManager.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  FaSpinner,
  FaEye,
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimes,
  FaSearch,
  FaUsers,
  FaUserCheck,
  FaUserPlus,
} from "react-icons/fa";
import Pagination from "../pagination/Pagination";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE = `${BASE_URL}/customer`;

const CustomersManager = () => {
  // State
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    perPage: 10,
  });
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    fullname: "",
    phoneNumber: "",
    isActive: true,
  });

  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (activeFilter === true) {
        response = await axios.get(`${API_BASE}/active`);
        setCustomers(response.data.customers);
        setPagination({
          totalItems: response.data.total,
          totalPages: 1,
          currentPage: 1,
          perPage: response.data.total,
        });
      } else if (searchQuery.trim()) {
        response = await axios.get(`${API_BASE}/search`, {
          params: { q: searchQuery },
        });
        setCustomers(response.data);
        setPagination((prev) => ({
          ...prev,
          totalItems: response.data.length,
          totalPages: 1,
          currentPage: 1,
        }));
      } else {
        const page = pagination?.currentPage || 1;
        const limit = pagination?.perPage || 10;
        response = await axios.get(API_BASE, {
          params: { page, limit },
        });
        setCustomers(response.data.customers);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to fetch customers");
      if (err.response?.status === 404 && searchQuery) {
        setCustomers([]);
        setError("No customers found");
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [activeFilter, searchQuery, pagination?.currentPage, pagination?.perPage]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filter handlers
  const handleSearch = (e) => {
    e.preventDefault();
    setActiveFilter(null);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveFilter(null);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handleActiveFilter = () => {
    setActiveFilter(true);
    setSearchQuery("");
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handleShowAll = () => {
    setActiveFilter(null);
    setSearchQuery("");
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // CRUD operations
  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({ fullname: "", phoneNumber: "", isActive: true });
    setViewingCustomer(null);
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      fullname: customer.fullname,
      phoneNumber: customer.phoneNumber || "",
      isActive: customer.isActive,
    });
    setViewingCustomer(null);
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCustomer) {
        await axios.put(`${API_BASE}/${editingCustomer.id}`, formData);
      } else {
        await axios.post(API_BASE, formData);
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleActiveStatus = async (customer) => {
    try {
      await axios.patch(`${API_BASE}/${customer.id}`, {
        isActive: !customer.isActive,
      });
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setError("Failed to update active status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/${id}`);
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setError("Failed to delete customer");
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (id) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/${id}`);
      setViewingCustomer(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  };

  const closeDetails = () => setViewingCustomer(null);

  const goToPage = (page) => {
    if (!pagination) return;
    if (page < 1 || page > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <FaSpinner className="text-5xl text-cyan-800 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">در حال بارگذاری مشتریان</h2>
        <p className="text-gray-600">لطفاً چند لحظه صبر کنید...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مدیریت مشتریان</h1>
        <p className="text-gray-600">ثبت، جستجو و مدیریت اطلاعات مشتریان</p>
        {editingCustomer && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded-xl max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <FaEdit className="h-5 w-5" />
              <span className="font-semibold">حالت ویرایش – مشتری #{editingCustomer.id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="items-center">

        <button
          onClick={openCreateModal}
          className="px-6 py-3 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white rounded-xl hover:from-cyan-900 hover:to-cyan-700 transition font-medium shadow-md flex items-center gap-2"
        >
          <FaUserPlus /> ثبت مشتری جدید
        </button>
      </div>

      {/* Error & Loading */}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-xl border border-red-200">
          ⚠️ {error}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <FaSpinner className="animate-spin" /> در حال بارگذاری...
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <FaUsers className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">لیست مشتریان</h2>
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
              {customers.length === 0 && !loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    هیچ مشتری‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                    <td className="p-3 text-gray-600">{cust.id}</td>
                    <td className="p-3 font-medium text-gray-800">{cust.fullname}</td>
                    <td className="p-3 text-gray-600">{cust.phoneNumber || "—"}</td>
                    <td className="p-3">
                      {cust.isActive ? (
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
                          onClick={() => viewDetails(cust.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="مشاهده"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => openEditModal(cust)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                          title="ویرایش"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => toggleActiveStatus(cust)}
                          className={`p-2 rounded-lg transition ${cust.isActive
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                            }`}
                          title={cust.isActive ? "غیرفعال کردن" : "فعال کردن"}
                        >
                          {cust.isActive ? <FaTimes /> : <FaCheck />}
                        </button>
                        <button
                          onClick={() => handleDelete(cust.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
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

      <div className="mt-6">
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={goToPage}
        />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <FaUserPlus className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold">
                  {editingCustomer ? "ویرایش مشتری" : "ثبت مشتری جدید"}
                </h2>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام کامل *
                </label>
                <input
                  type="text"
                  name="fullname"
                  value={formData.fullname}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شماره تماس
                </label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4 flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleFormChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">فعال</label>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition"
                >
                  لغو
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-cyan-800 to-cyan-600 hover:from-cyan-900 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                  {editingCustomer ? "ذخیره تغییرات" : "ثبت مشتری"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <FaEye className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold">جزئیات مشتری</h2>
              </div>
            </div>
            <div className="p-6 space-y-3 text-right">
              <p><strong className="font-semibold">شناسه:</strong> {viewingCustomer.id}</p>
              <p><strong className="font-semibold">نام کامل:</strong> {viewingCustomer.fullname}</p>
              <p><strong className="font-semibold">شماره تماس:</strong> {viewingCustomer.phoneNumber || "—"}</p>
              <p><strong className="font-semibold">وضعیت:</strong> {viewingCustomer.isActive ? "فعال" : "غیرفعال"}</p>
              <p><strong className="font-semibold">تاریخ ایجاد:</strong> {new Date(viewingCustomer.createdAt).toLocaleString()}</p>
              <p><strong className="font-semibold">آخرین بروزرسانی:</strong> {new Date(viewingCustomer.updatedAt).toLocaleString()}</p>
            </div>
            <div className="p-4 flex justify-end">
              <button
                onClick={closeDetails}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersManager;