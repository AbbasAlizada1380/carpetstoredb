import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FaEdit,
  FaTrash,
  FaSave,
  FaTimes,
  FaSpinner,
  FaFileInvoiceDollar,
  FaCalendarAlt,
  FaCheck,
  FaUndo,
  FaSearch,
  FaTimesCircle
} from "react-icons/fa";
import Pagination from "../pagination/Pagination";
import SelectedOrderItemsDownload from "./SelectedOrderItemsDownload";
import { useSelector } from "react-redux";
import SearchBar from "../searching/SearchBar"; // Import the SearchBar component
import DateOrderDownload from "./report/DateOrderDownload";
const BASE_URL = import.meta.env.VITE_BASE_URL;

const OrderItemsList = ({
  refreshTrigger
}) => {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [selectedItemsData, setSelectedItemsData] = useState([]);
  const { currentUser } = useSelector((state) => state.user);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // 🔹 NEW: Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchActive, setSearchActive] = useState(false);
  const searchBarRef = useRef(null);

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    size: "",
    qnty: "",
    price: "",
    money: "",
    fileName: ""
  });
  const [originalItem, setOriginalItem] = useState(null);

  // Fetch order items
  const fetchOrderItems = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page: currentPage,
        limit: perPage,
      };

      const res = await axios.get(`${BASE_URL}/orderItems`, { params });

      setOrderItems(res.data.orderItems || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalItems(res.data.pagination?.totalItems || 0);

    } catch (err) {
      console.error("Error fetching order items:", err);
      setError(err.response?.data?.message || "خطا در دریافت سفارشات");
      setOrderItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Handle search results from SearchBar
  const handleSearchResults = (results, count) => {
    setSearchResults(results);
    setOrderItems(results); // Display search results in table
    setTotalItems(count || results.length);
    setTotalPages(1); // Search results typically don't need pagination
    setCurrentPage(1);
    setSearchActive(results.length > 0);

    // Clear selection when search changes
    setSelectedItemIds([]);
    setSelectedItemsData([]);
  };

  // 🔹 Clear search and show all items
  const clearSearch = () => {
    if (searchBarRef.current) {
      searchBarRef.current.reset();
    }
    setSearchActive(false);
    setSearchResults([]);
    fetchOrderItems(); // Reload all items
  };

  const toggleSelectItem = (item) => {
    setSelectedItemIds((prev) =>
      prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id]
    );

    setSelectedItemsData((prev) =>
      prev.find((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  const toggleSelectAll = () => {
    const pageIds = orderItems.map((i) => i.id);
    const allSelected = pageIds.every((id) => selectedItemIds.includes(id));

    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      setSelectedItemsData((prev) =>
        prev.filter((i) => !pageIds.includes(i.id))
      );
    } else {
      setSelectedItemIds((prev) => [...new Set([...prev, ...pageIds])]);
      setSelectedItemsData((prev) => [
        ...prev,
        ...orderItems.filter(
          (i) => !prev.find((p) => p.id === i.id)
        ),
      ]);
    }
  };

  useEffect(() => {
    if (!searchActive) {
      fetchOrderItems();
    }
  }, [currentPage, perPage, refreshTrigger, searchActive]);

  // Start editing an item
  const startEdit = (item) => {
    setEditingId(item.id);
    setOriginalItem({ ...item });
    setEditForm({
      size: item.size || "",
      qnty: item.qnty || "",
      price: item.price || "",
      money: item.money || "",
      fileName: item.fileName || ""
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      size: "",
      qnty: "",
      price: "",
      money: "",
      fileName: ""
    });
    setOriginalItem(null);
  };

  // Handle edit form changes
  const handleEditChange = (field, value) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: value };

      if (field === "qnty" || field === "price") {
        const qnty = Number(updated.qnty) || 0;
        const price = Number(updated.price) || 0;
        updated.money = (qnty * price).toString();
      }

      return updated;
    });
  };

  // Save edited item
  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const payload = {
        size: editForm.size,
        qnty: Number(editForm.qnty),
        price: Number(editForm.price),
        money: Number(editForm.money),
        fileName: editForm.fileName
      };

      await axios.put(`${BASE_URL}/orderItems/${editingId}`, payload);

      setOrderItems(prev => prev.map(item =>
        item.id === editingId
          ? { ...item, ...payload }
          : item
      ));

      cancelEdit();
      alert("سفارش با موفقیت ویرایش شد");

      // Refresh after edit
      if (searchActive) {
        // If in search mode, refresh the search
        if (searchBarRef.current) {
          searchBarRef.current.search(searchQuery);
        }
      } else {
        fetchOrderItems();
      }

    } catch (err) {
      console.error("Error updating order item:", err);
      alert(err.response?.data?.message || "خطا در ویرایش سفارش");
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    return orderItems.reduce((acc, item) => {
      acc.totalQuantity += parseInt(item.qnty) || 0;
      acc.totalMoney += parseFloat(item.money) || 0;
      return acc;
    }, { totalQuantity: 0, totalMoney: 0 });
  };

  const totals = calculateTotals();

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString("eng-en");
    return formatted.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  };

  // Check if there are changes
  const hasChanges = () => {
    if (!originalItem) return false;
    return (
      editForm.size !== originalItem.size ||
      editForm.qnty !== originalItem.qnty ||
      editForm.price !== originalItem.price ||
      editForm.money !== originalItem.money ||
      editForm.fileName !== originalItem.fileName
    );
  };

  if (loading && orderItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FaSpinner className="text-4xl text-cyan-800 animate-spin mb-4" />
        <p className="text-gray-600">در حال بارگذاری سفارشات...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FaFileInvoiceDollar className="text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold">لیست سفارشات</h2>
              <p className="text-sm text-white/80">
                {searchActive ? (
                  <span>
                    نتایج جستجو: {searchResults.length} مورد یافت شد
                  </span>
                ) : (
                  <span>
                    {totalItems} سفارش | صفحه {currentPage} از {totalPages}
                  </span>
                )}
                {editingId && (
                  <span className="ml-4 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                    حالت ویرایش #{editingId}
                  </span>
                )}
              </p>
            </div>
          </div>
          {editingId && hasChanges() && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-200 text-sm animate-pulse">
                تغییرات ذخیره نشده!
              </span>
            </div>
          )}
        </div>

        {/* 🔹 SearchBar Component */}
        <div className=" grid grid-cols-1 sm:grid-cols-2 items-center">
          <div className="w-full">
            <SearchBar
              ref={searchBarRef}
              onResults={handleSearchResults}
              placeholder="جستجو بر اساس شماره بیل یا نام فایل..."
            />
          </div>
          <div className="flex justify-end">
            <DateOrderDownload />
          </div>
        </div>
        {/* 🔹 Search Active Indicator */}
        {searchActive && searchResults.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm bg-white/10 p-2 rounded-lg">
            <span className="text-cyan-100">
              نتایج جستجو: {searchResults.length} مورد یافت شد
            </span>
            <button
              onClick={clearSearch}
              className="text-white hover:text-cyan-200 underline flex items-center gap-1 text-sm"
            >
              <FaTimesCircle /> نمایش همه سفارشات
            </button>
          </div>
        )}
      </div>

      {/* 🔹 No Search Results */}
      {searchActive && searchResults.length === 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4 text-center">
          <div className="flex flex-col items-center gap-2 text-yellow-800">
            <FaSearch className="text-xl" />
            <p className="font-medium">نتیجه‌ای یافت نشد</p>
            <p className="text-sm text-yellow-600">
              هیچ سفارشی با این مشخصات یافت نشد
            </p>
            <button
              onClick={clearSearch}
              className="text-sm bg-yellow-100 hover:bg-yellow-200 px-4 py-2 rounded mt-2"
            >
              نمایش همه سفارشات
            </button>
          </div>
        </div>
      )}

      {/* Order Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-center">
          <thead className="bg-cyan-50 text-cyan-800">
            <tr>
              <th className="p-3 border-b font-semibold">
                <input
                  type="checkbox"
                  onChange={toggleSelectAll}
                  checked={
                    orderItems.length > 0 &&
                    orderItems.every(i => selectedItemIds.includes(i.id))
                  }
                />
              </th>
              <th className="p-3 border-b font-semibold">#</th>
              <th className="p-3 border-b font-semibold">نام فایل</th>
              <th className="p-3 border-b font-semibold">سایز</th>
              <th className="p-3 border-b font-semibold">تعداد</th>
              <th className="p-3 border-b font-semibold">نمبر بیل</th>
              <th className="p-3 border-b font-semibold">نام مشتری</th>
              <th className="p-3 border-b font-semibold">قیمت (افغانی)</th>
              <th className="p-3 border-b font-semibold">مبلغ (افغانی)</th>
              <th className="p-3 border-b font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <FaCalendarAlt />
                  <span>تاریخ ثبت</span>
                </div>
              </th>
              <th className="p-3 border-b font-semibold">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.length === 0 && !loading ? (
              <tr>
                <td colSpan="9" className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FaFileInvoiceDollar className="text-4xl text-gray-300" />
                    <p className="text-lg">
                      {searchActive ? "هیچ نتیجه‌ای یافت نشد" : "هیچ سفارشی یافت نشد"}
                    </p>
                    <p className="text-sm text-gray-400">
                      {searchActive
                        ? "لطفاً عبارت جستجوی دیگری را امتحان کنید"
                        : "شروع به ثبت سفارش جدید کنید"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orderItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 border-b last:border-0 transition-colors ${editingId === item.id ? "bg-yellow-50" : ""
                    } ${searchActive ? "bg-blue-50/30" : ""}`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={() => toggleSelectItem(item)}
                    />
                  </td>
                  <td className="p-3 text-gray-600">
                    {item.id}
                  </td>

                  {/* File Name Cell */}
                  <td className="p-3">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editForm.fileName}
                        onChange={(e) => handleEditChange("fileName", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="نام فایل"
                      />
                    ) : (
                      <div className="font-medium text-gray-800 max-w-xs truncate">
                        {item.fileName || "—"}
                      </div>
                    )}
                  </td>

                  {/* Size Cell */}
                  <td className="p-3">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editForm.size}
                        onChange={(e) => handleEditChange("size", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="سایز"
                        required
                      />
                    ) : (
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                        {item.size}
                      </span>
                    )}
                  </td>

                  {/* Quantity Cell */}
                  <td className="p-3">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        min="1"
                        value={editForm.qnty}
                        onChange={(e) => handleEditChange("qnty", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center"
                        placeholder="تعداد"
                        required
                      />
                    ) : (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">
                        {item.qnty}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">
                      {item.invoiceNumber || 0}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">
                      {item.customerName}
                    </span>
                  </td>

                  {/* Price Cell */}
                  <td className="p-3">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.price}
                        onChange={(e) => handleEditChange("price", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center"
                        placeholder="قیمت"
                        required
                      />
                    ) : (
                      <span className="text-green-700 font-semibold">
                        {parseFloat(item.price || 0).toLocaleString('en-US')}
                      </span>
                    )}
                  </td>

                  {/* Money Cell */}
                  <td className="p-3">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.money}
                        onChange={(e) => handleEditChange("money", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center bg-gray-50"
                        placeholder="مبلغ"
                        required
                        readOnly
                        onFocus={(e) => e.target.removeAttribute('readonly')}
                      />
                    ) : (
                      <span className="text-purple-700 font-bold">
                        {parseFloat(item.money || 0).toLocaleString('en-US')}
                      </span>
                    )}
                  </td>

                  {/* Date Cell */}
                  <td className="p-3 text-gray-500 text-sm">
                    {formatDate(item.createdAt)}
                  </td>

                  {/* Actions Cell */}
                  <td className="p-3">
                    {currentUser?.role === "admin" ? (
                      <div className="flex items-center justify-center gap-2">
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                              title="ذخیره"
                              disabled={!hasChanges()}
                            >
                              <FaSave />
                            </button>

                            <button
                              onClick={cancelEdit}
                              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                              title="لغو"
                            >
                              <FaTimes />
                            </button>

                            {hasChanges() && (
                              <button
                                onClick={() => {
                                  setEditForm({
                                    size: originalItem.size || "",
                                    qnty: originalItem.qnty || "",
                                    price: originalItem.price || "",
                                    money: originalItem.money || "",
                                    fileName: originalItem.fileName || "",
                                  });
                                }}
                                className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                title="بازنشانی"
                              >
                                <FaUndo />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg"
                            title="ویرایش"
                            disabled={editingId !== null}
                          >
                            <FaEdit />
                          </button>
                        )}
                      </div>
                    ) : "--"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Items Download Section */}
      {selectedItemsData.length > 0 && (
        <div className="p-6 border-t bg-gray-50">
          <SelectedOrderItemsDownload
            items={selectedItemsData}
          />
        </div>
      )}


      <div className="p-6 border-t border-gray-200">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>


      {/* Editing Warning */}
      {editingId && (
        <div className="bg-yellow-50 border border-yellow-200 p-3">
          <div className="flex items-center justify-center gap-2 text-yellow-800">
            <FaEdit />
            <span className="font-medium">شما در حال ویرایش سفارش #{editingId} هستید</span>
            <button
              onClick={cancelEdit}
              className="text-sm bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded"
            >
              لغو ویرایش
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderItemsList;