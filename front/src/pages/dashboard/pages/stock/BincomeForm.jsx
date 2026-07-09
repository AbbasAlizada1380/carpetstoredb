// components/BincomeForm.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaSpinner,
  FaSave,
  FaTimes,
  FaMinusCircle,
  FaPlusCircle,
} from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE = `${BASE_URL}/bincome`;
const TYPE_API = `${BASE_URL}/type`;
const CUSTOMER_API = `${BASE_URL}/customer/active`;

const BincomeForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  // ─── State ──────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState(
    initialEntries || [
      {
        typeId: "",
        categoryId: "",
        amount: "",
        weight: "",
        unitPrice: "",
        total: "",
      },
    ]
  );

  const [customers, setCustomers] = useState([]);
  const [customerMode, setCustomerMode] = useState("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");

  const [types, setTypes] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({}); // { typeId: [categories] }
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const [totalReceipt, setTotalReceipt] = useState("");

  // ─── Fetch customers & types ──────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, typeRes] = await Promise.all([
          axios.get(CUSTOMER_API),
          axios.get(TYPE_API),
        ]);
        setCustomers(custRes.data.customers || []);
        setTypes(typeRes.data || []);
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };
    fetchData();
  }, []);

  // ─── Fetch categories for a given type ──────────────────────────────
  const fetchCategoriesForType = async (typeId) => {
    if (!typeId) return;
    if (categoriesMap[typeId]) return; // already loaded
    try {
      const res = await axios.get(`${TYPE_API}/${typeId}/categories`);
      setCategoriesMap((prev) => ({ ...prev, [typeId]: res.data }));
    } catch (err) {
      console.error("Error loading categories for type:", err);
    }
  };

  // ─── Compute total for a single entry (amount × unitPrice) ────────────
  const computeTotal = (entry) => {
    const amount = parseFloat(entry.amount) || 0;
    const unitPrice = parseFloat(entry.unitPrice) || 0;
    return (amount * unitPrice).toFixed(2);
  };

  // ─── Update entry field ──────────────────────────────────────────────
  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;

    // When type changes, reset category and fetch new categories
    if (field === "typeId") {
      newEntries[index].categoryId = "";
      newEntries[index].amount = "";
      newEntries[index].weight = "";
      newEntries[index].unitPrice = "";
      newEntries[index].total = "";
      fetchCategoriesForType(value);
    }

    // Recalculate total when amount or unitPrice changes
    if (["amount", "unitPrice"].includes(field)) {
      newEntries[index].total = computeTotal(newEntries[index]);
    }

    setEntries(newEntries);
  };

  // ─── Add / remove rows ──────────────────────────────────────────────────
  const addEntry = () => {
    setEntries([
      ...entries,
      {
        typeId: "",
        categoryId: "",
        amount: "",
        weight: "",
        unitPrice: "",
        total: "",
      },
    ]);
  };

  const removeEntry = (index) => {
    if (entries.length === 1) {
      setError("حداقل یک ردیف باید وجود داشته باشد");
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  // ─── Validate a single entry ────────────────────────────────────────────
  const validateEntry = (entry) => {
    if (!entry.typeId) return "نوع باید انتخاب شود";
    if (!entry.categoryId) return "دسته‌بندی باید انتخاب شود";
    if (!entry.amount || parseFloat(entry.amount) <= 0)
      return "تعداد باید بزرگتر از صفر باشد";
    // weight is optional
    if (entry.weight !== "" && parseFloat(entry.weight) <= 0)
      return "وزن باید بزرگتر از صفر باشد (اختیاری)";
    if (!entry.unitPrice || parseFloat(entry.unitPrice) <= 0)
      return "قیمت واحد باید بزرگتر از صفر باشد";
    return null;
  };

  // ─── Compute grand total ────────────────────────────────────────────────
  const grandTotal = entries.reduce(
    (sum, entry) => sum + (parseFloat(entry.total) || 0),
    0
  );
  const receiptValue = parseFloat(totalReceipt) || 0;
  const remaining = grandTotal - receiptValue;

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate customer
    if (customerMode === "existing") {
      if (!selectedCustomerId) {
        setError("لطفاً مشتری را از لیست انتخاب کنید");
        return;
      }
    } else {
      if (!newCustomerName.trim()) {
        setError("لطفاً نام مشتری جدید را وارد کنید");
        return;
      }
    }

    // Validate each entry
    for (let i = 0; i < entries.length; i++) {
      const err = validateEntry(entries[i]);
      if (err) {
        setError(`ردیف ${i + 1}: ${err}`);
        return;
      }
    }

    // Validate receipt
    if (receiptValue < 0) {
      setError("مبلغ دریافتی نمی‌تواند منفی باشد");
      return;
    }
    if (receiptValue > grandTotal + 0.01) {
      setError("مبلغ دریافتی نمی‌تواند بیشتر از کل فاکتور باشد");
      return;
    }

    // Build payload for each entry
    const payloadArray = entries.map((entry) => ({
      categoryId: parseInt(entry.categoryId),
      amount: parseFloat(entry.amount),
      weight: entry.weight !== "" ? parseFloat(entry.weight) : null,
      unitPrice: parseFloat(entry.unitPrice),
    }));

    setSubmitLoading(true);
    setError("");

    try {
      if (editingId) {
        // Edit single entry
        await axios.put(`${API_BASE}/${editingId}`, payloadArray[0]);
      } else {
        // Create multiple entries
        const payload = {
          entries: payloadArray,
          totalReceipt: receiptValue,
        };
        if (customerMode === "existing") {
          payload.customerId = selectedCustomerId;
        } else {
          payload.newCustomer = newCustomerName.trim();
        }
        await axios.post(API_BASE, payload);
      }

      onSuccess();

      // Reset form if not editing
      if (!editingId) {
        setEntries([
          {
            typeId: "",
            categoryId: "",
            amount: "",
            weight: "",
            unitPrice: "",
            total: "",
          },
        ]);
        setCustomerMode("existing");
        setSelectedCustomerId("");
        setNewCustomerName("");
        setTotalReceipt("");
        // keep types and categories as is
      } else {
        onCancel();
      }
    } catch (err) {
      setError(err.response?.data?.message || "عملیات ناموفق بود");
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          {editingId ? "ویرایش رکورد" : "ثبت رکورد جدید (چند ردیف)"}
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* ─── Customer selection ────────────────────────────────────────── */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          مشتری <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="existing"
              checked={customerMode === "existing"}
              onChange={() => setCustomerMode("existing")}
            />
            انتخاب از لیست
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="new"
              checked={customerMode === "new"}
              onChange={() => setCustomerMode("new")}
            />
            مشتری جدید
          </label>
        </div>
        {customerMode === "existing" ? (
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="">انتخاب مشتری</option>
            {Array.isArray(customers) &&
              customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.fullname}
                </option>
              ))}
          </select>
        ) : (
          <input
            type="text"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            placeholder="نام مشتری جدید"
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        )}
      </div>

      {/* ─── Table of entries ──────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">نوع *</th>
                <th className="p-2 border">دسته‌بندی *</th>
                <th className="p-2 border">تعداد (Amount) *</th>
                <th className="p-2 border">وزن (Weight)</th>
                <th className="p-2 border">قیمت واحد *</th>
                <th className="p-2 border">جمع (محاسبه)</th>
                <th className="p-2 border">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2 text-center">{idx + 1}</td>
                  <td className="p-2">
                    <select
                      value={entry.typeId}
                      onChange={(e) =>
                        handleEntryChange(idx, "typeId", e.target.value)
                      }
                      className="w-28 border rounded px-1 py-1"
                      required
                    >
                      <option value="">انتخاب نوع</option>
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={entry.categoryId}
                      onChange={(e) =>
                        handleEntryChange(idx, "categoryId", e.target.value)
                      }
                      className="w-32 border rounded px-1 py-1"
                      disabled={!entry.typeId}
                      required
                    >
                      <option value="">انتخاب دسته</option>
                      {categoriesMap[entry.typeId]?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name || cat.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.amount}
                      onChange={(e) =>
                        handleEntryChange(idx, "amount", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.weight}
                      onChange={(e) =>
                        handleEntryChange(idx, "weight", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.unitPrice}
                      onChange={(e) =>
                        handleEntryChange(idx, "unitPrice", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                  </td>
                  <td className="p-2 text-gray-700 font-medium">
                    {entry.total || "—"} افغانی
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeEntry(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaMinusCircle />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={addEntry}
            className="flex items-center gap-1 text-cyan-600 hover:text-cyan-800"
          >
            <FaPlusCircle /> افزودن ردیف جدید
          </button>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2 border rounded-lg"
              >
                انصراف
              </button>
            )}
            <button
              type="submit"
              disabled={submitLoading}
              className="px-5 py-2 bg-cyan-700 text-white rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {submitLoading ? (
                <>
                  <FaSpinner className="animate-spin" /> در حال ذخیره...
                </>
              ) : (
                <>
                  <FaSave /> {editingId ? "به‌روزرسانی" : "ذخیره همه"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── Financial summary ────────────────────────────────────────── */}
        <div className="mt-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                جمع کل فاکتور
              </label>
              <div className="text-2xl font-bold text-cyan-700">
                {grandTotal.toFixed(2)} افغانی
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مبلغ دریافتی (کل)
              </label>
              <input
                type="number"
                step="any"
                value={totalReceipt}
                onChange={(e) => setTotalReceipt(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-lg"
                placeholder="مبلغ دریافت شده"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                باقیمانده کل
              </label>
              <div
                className={`text-2xl font-bold ${
                  remaining >= 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {remaining.toFixed(2)} افغانی
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * مبلغ دریافتی به ترتیب (ردیف به ردیف) به اقلام فاکتور اختصاص
            می‌یابد تا تسویه شود.
          </p>
        </div>
      </form>
    </div>
  );
};

export default BincomeForm;
