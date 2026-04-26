import { useEffect, useState } from "react";
import axios from "axios";
import Pagination from "../pagination/Pagination";
import RemainOrderItems from "./RemainOrderItems"; // adjust path if needed
import { FaUsers, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { useSelector } from "react-redux";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const limit = 20;

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const { currentUser } = useSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    fullname: "",
    phoneNumber: "",
    isActive: true,
  });

  /* ======================
     Fetch Customers
  ====================== */
  const fetchCustomers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${BASE_URL}/customers?page=${page}&limit=${limit}`
      );

      setCustomers(res.data.customers);
      setCurrentPage(res.data.pagination.currentPage);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(currentPage);
  }, [currentPage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      if (editingId) {
        await axios.put(`${BASE_URL}/customers/${editingId}`, form);
      } else {
        await axios.post(`${BASE_URL}/customers`, form);
      }

      resetForm();
      fetchCustomers(currentPage);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };


  /* ======================
     Edit
  ====================== */
  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      fullname: customer.fullname,
      phoneNumber: customer.phoneNumber,
      isActive: customer.isActive,
    });
    setIsModalOpen(true);
  };

  /* ======================
     Delete
  ====================== */
  const handleDelete = async (id) => {
    if (!window.confirm("آیا مطمئن هستید؟")) return;

    try {
      await axios.delete(`${BASE_URL}/customers/${id}`);
      fetchCustomers(currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  /* ======================
     Reset
  ====================== */
  const resetForm = () => {
    setForm({ fullname: "", phoneNumber: "", isActive: true });
    setEditingId(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          مدیریت مشتریان
        </h1>
        <p className="text-gray-600">مدیریت اطلاعات مشتریان</p>

        {editingId && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded-xl">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <FaEdit />
              <span className="font-semibold">
                حالت ویرایش – مشتری #{editingId}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-100">
        {/* Table Header */}
        <div className="flex bg-gray-200 items-center justify-between rounded-t-md p-6">
          <div className="flex items-center gap-x-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <FaUsers className="text-cyan-800 text-xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              لیست مشتریان
            </h2>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-cyan-800 text-white px-4 py-2 rounded-lg hover:bg-cyan-900"
          >
            <FaPlus />
            افزودن مشتری
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center border border-gray-300">
            <thead className="bg-cyan-800 text-white">
              <tr>
                <th className="border px-4 py-2">#</th>
                <th className="border px-4 py-2">نام کامل</th>
                <th className="border px-4 py-2">شماره تماس</th>
                <th className="border px-4 py-2">وضعیت</th>
                <th className="border px-4 py-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-4">
                    در حال بارگذاری...
                  </td>
                </tr>
              ) : customers.length ? (
                customers.map((c, index) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedCustomer(c)} // <-- select customer
                  >
                    <td className="border px-4 py-2">
                      {c.id}
                    </td>
                    <td className="border px-4 py-2">{c.fullname}</td>
                    <td className="border px-4 py-2">{c.phoneNumber}</td>
                    <td className="border px-4 py-2">{c.isActive ? "فعال" : "غیرفعال"}</td>
                    <td className="border px-4 py-2">
                     {currentUser.role=="admin"?( <div className="flex justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                          className="h-8 w-8 flex items-center justify-center border border-cyan-800 rounded-md hover:scale-105"
                        >
                          <FaEdit className="text-cyan-800" />
                        </button>
                      </div>):"--"}
                    </td>
                  </tr>
                ))

              ) : (
                <tr>
                  <td colSpan="5" className="py-4 text-gray-500">
                    هیچ مشتری‌ای وجود ندارد
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-lg w-[400px]"
          >
            <h3 className="text-lg font-bold mb-4">
              {editingId ? "ویرایش مشتری" : "افزودن مشتری"}
            </h3>

            <input
              required
              placeholder="نام کامل"
              value={form.fullname}
              onChange={(e) =>
                setForm({ ...form, fullname: e.target.value })
              }
              className="w-full border p-2 rounded mb-3"
            />

            <input
              placeholder="شماره تماس"
              value={form.phoneNumber}
              onChange={(e) =>
                setForm({ ...form, phoneNumber: e.target.value })
              }
              className="w-full border p-2 rounded mb-3"
            />

            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              فعال
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border rounded"
              >
                لغو
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="
    px-4 py-2 bg-cyan-800 text-white rounded
    flex items-center justify-center gap-2
    disabled:opacity-60 disabled:cursor-not-allowed
  "
              >
                {submitting ? "در حال ذخیره..." : "ذخیره"}
              </button>

            </div>
          </form>
        </div>
      )}
      {selectedCustomer && (
        <div className="mt-8">
          <RemainOrderItems customer={selectedCustomer} />
        </div>
      )}

    </div>
  );
};

export default Customers;
