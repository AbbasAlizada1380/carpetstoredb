// components/BincomeForm.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaTimes, FaMinusCircle, FaPlusCircle } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/bincome`;
const CUSTOMER_API = `${BASE_URL}/customer/active`;
const TYPE_API = `${BASE_URL}/type`;

// ✅ Currency helpers
const CURRENCY_SYMBOL = { afn: "؋", usd: "$" };
const symbolFor = (isAfn) => (isAfn ? CURRENCY_SYMBOL.afn : CURRENCY_SYMBOL.usd);

const emptyEntry = (defaults = {}) => ({
  typeId: "",
  categoryId: "",
  amount: "",
  weight: "",
  unitPrice: "",
  total: "",
  // ✅ per-row currency
  isAfn: defaults.isAfn ?? false,
  DV: defaults.DV ?? 65,
});

const BincomeForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  // ✅ global currency (applies to all rows unless overridden)
  const [globalIsAfn, setGlobalIsAfn] = useState(false);
  const [globalDV, setGlobalDV] = useState(65);

  const [entries, setEntries] = useState(initialEntries || [emptyEntry()]);
  const [customers, setCustomers] = useState([]);
  const [customerMode, setCustomerMode] = useState("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [types, setTypes] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const [totalReceipt, setTotalReceipt] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchTypes();
  }, []);

  // ✅ hydrate global currency from first entry when editing
  useEffect(() => {
    if (initialEntries && initialEntries.length > 0) {
      const first = initialEntries[0];
      if (first.isAfn !== undefined) setGlobalIsAfn(!!first.isAfn);
      if (first.DV !== undefined && first.DV !== null) {
        setGlobalDV(parseFloat(first.DV) || 65);
      }
    }
  }, [initialEntries]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(CUSTOMER_API);
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTypes = async () => {
    try {
      const res = await axios.get(TYPE_API);
      setTypes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategoriesForType = async (typeId) => {
    if (!typeId) return;
    if (categoriesMap[typeId]) return;
    try {
      const res = await axios.get(`${TYPE_API}/${typeId}/categories`);
      setCategoriesMap(prev => ({ ...prev, [typeId]: res.data }));
    } catch (err) {
      console.error(err);
    }
  };

  const calculateEntryValues = (entry) => {
    const amount = parseFloat(entry.amount) || 0;
    const unitPrice = parseFloat(entry.unitPrice) || 0;
    return { total: (amount * unitPrice).toFixed(2) };
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;

    if (field === "typeId") {
      newEntries[index].categoryId = "";
      newEntries[index].amount = "";
      newEntries[index].weight = "";
      newEntries[index].unitPrice = "";
      newEntries[index].total = "";
      fetchCategoriesForType(value);
    }

    if (["amount", "unitPrice"].includes(field)) {
      const { total } = calculateEntryValues(newEntries[index]);
      newEntries[index].total = total;
    }

    setEntries(newEntries);
  };

  // ✅ per-row currency
  const handleRowCurrencyChange = (index, isAfn) => {
    const newEntries = [...entries];
    newEntries[index].isAfn = isAfn;
    setEntries(newEntries);
  };

  // ✅ per-row DV
  const handleRowDVChange = (index, DV) => {
    const newEntries = [...entries];
    newEntries[index].DV = DV;
    setEntries(newEntries);
  };

  // ✅ apply currency to ALL rows
  const applyGlobalCurrency = (isAfn) => {
    setGlobalIsAfn(isAfn);
    setEntries(prev => prev.map(e => ({ ...e, isAfn })));
  };

  // ✅ apply DV to ALL rows
  const applyGlobalDV = (DV) => {
    setGlobalDV(DV);
    setEntries(prev => prev.map(e => ({ ...e, DV })));
  };

  const addEntry = () => {
    setEntries([...entries, emptyEntry({ isAfn: globalIsAfn, DV: globalDV })]);
  };

  const removeEntry = (index) => {
    if (entries.length === 1) {
      setError("حداقل یک ردیف باید وجود داشته باشد");
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  const validateEntry = (entry) => {
    if (!entry.typeId) return "نوع باید انتخاب شود";
    if (!entry.categoryId) return "دسته‌بندی باید انتخاب شود";
    if (!entry.amount || parseFloat(entry.amount) <= 0) return "تعداد باید بزرگتر از صفر باشد";
    if (entry.weight !== "" && entry.weight !== null && parseFloat(entry.weight) <= 0)
      return "وزن باید بزرگتر از صفر باشد (اختیاری)";
    if (!entry.unitPrice || parseFloat(entry.unitPrice) <= 0) return "قیمت واحد باید بزرگتر از صفر باشد";
    // ✅ DV must be positive
    if (!entry.DV || parseFloat(entry.DV) <= 0) return "نرخ دالر باید بزرگتر از صفر باشد";
    return null;
  };

  const totalAmount = entries.reduce((sum, entry) => sum + (parseFloat(entry.total) || 0), 0);
  const receiptValue = parseFloat(totalReceipt) || 0;
  const totalRemaind = totalAmount - receiptValue;

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (let i = 0; i < entries.length; i++) {
      const err = validateEntry(entries[i]);
      if (err) {
        setError(`ردیف ${i + 1}: ${err}`);
        return;
      }
    }

    if (receiptValue < 0) {
      setError("مبلغ پرداختی نمی‌تواند منفی باشد");
      return;
    }
    if (receiptValue > totalAmount + 0.01) {
      setError("مبلغ پرداختی نمی‌تواند بیشتر از کل فاکتور باشد");
      return;
    }

    const mainPayload = {};
    if (customerMode === "existing") {
      if (!selectedCustomerId) {
        setError("لطفاً مشتری را از لیست انتخاب کنید");
        return;
      }
      mainPayload.customerId = selectedCustomerId;
    } else {
      if (!newCustomerName.trim()) {
        setError("لطفاً نام مشتری جدید را وارد کنید");
        return;
      }
      mainPayload.newCustomer = newCustomerName.trim();
    }

    const entriesArray = entries.map(entry => ({
      categoryId: parseInt(entry.categoryId),
      amount: parseFloat(entry.amount),
      weight: entry.weight !== "" && entry.weight !== null ? parseFloat(entry.weight) : null,
      unitPrice: parseFloat(entry.unitPrice),
      // ✅ per-row currency
      isAfn: !!entry.isAfn,
      DV: parseFloat(entry.DV) || 65,
    }));

    mainPayload.entries = entriesArray;
    mainPayload.totalReceipt = receiptValue;
    // ✅ global currency defaults (backend can use these for the bill)
    mainPayload.isAfn = !!globalIsAfn;
    mainPayload.DV = parseFloat(globalDV) || 65;

    setSubmitLoading(true);
    setError("");
    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}/${editingId}`, entriesArray[0]);
      } else {
        await axios.post(API_BASE_URL, mainPayload);
      }
      onSuccess();
      if (!editingId) {
        setEntries([emptyEntry()]);
        setCustomerMode("existing");
        setSelectedCustomerId("");
        setNewCustomerName("");
        setTotalReceipt("");
        setGlobalIsAfn(false);
        setGlobalDV(65);
      } else {
        onCancel();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || (editingId ? "ویرایش ناکام ماند" : "ایجاد ناکام ماند"));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          {editingId ? "ویرایش رکورد" : "ثبت رکورد جدید (چند ردیف)"}
        </h3>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <FaTimes />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Customer selection */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">مشتری <span className="text-red-500">*</span></label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2">
            <input type="radio" value="existing" checked={customerMode === "existing"} onChange={() => setCustomerMode("existing")} />
            انتخاب از لیست
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="new" checked={customerMode === "new"} onChange={() => setCustomerMode("new")} />
            مشتری جدید
          </label>
        </div>
        {customerMode === "existing" ? (
          <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">انتخاب مشتری</option>
            {Array.isArray(customers) && customers.map(cust => (
              <option key={cust.id} value={cust.id}>{cust.fullname}</option>
            ))}
          </select>
        ) : (
          <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="نام مشتری جدید" className="w-full border rounded-lg px-4 py-2" required />
        )}
      </div>

      {/* ✅ Global currency controls */}
      <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">واحد پول پیش‌فرض:</span>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={globalIsAfn === false}
                onChange={() => applyGlobalCurrency(false)}
              />
              دالر ($)
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={globalIsAfn === true}
                onChange={() => applyGlobalCurrency(true)}
              />
              افغانی (؋)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">نرخ دالر (DV):</span>
            <input
              type="number"
              step="any"
              min="0"
              value={globalDV}
              onChange={(e) => applyGlobalDV(e.target.value)}
              className="w-28 border rounded-lg px-2 py-1 text-sm"
            />
          </div>
          <span className="text-xs text-gray-500">
            (این مقدار به همه ردیف‌ها اعمال می‌شود؛ هر ردیف می‌تواند جداگانه تغییر کند)
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">نوع*</th>
                <th className="p-2 border">دسته‌بندی*</th>
                <th className="p-2 border">تعداد*</th>
                <th className="p-2 border">وزن</th>
                <th className="p-2 border">قیمت واحد*</th>
                {/* ✅ per-row currency + DV columns */}
                <th className="p-2 border">واحد</th>
                <th className="p-2 border">DV</th>
                <th className="p-2 border">مبلغ کل (محاسبه)</th>
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
                      onChange={(e) => handleEntryChange(idx, "typeId", e.target.value)}
                      className="w-28 border rounded px-1 py-1"
                      required
                    >
                      <option value="">انتخاب نوع</option>
                      {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={entry.categoryId}
                      onChange={(e) => handleEntryChange(idx, "categoryId", e.target.value)}
                      className="w-28 border rounded px-1 py-1"
                      disabled={!entry.typeId}
                      required
                    >
                      <option value="">انتخاب دسته</option>
                      {categoriesMap[entry.typeId]?.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.amount} onChange={(e) => handleEntryChange(idx, "amount", e.target.value)} className="w-20 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.weight} onChange={(e) => handleEntryChange(idx, "weight", e.target.value)} className="w-20 border rounded px-1 py-1" />
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.unitPrice} onChange={(e) => handleEntryChange(idx, "unitPrice", e.target.value)} className="w-24 border rounded px-1 py-1" required />
                  </td>
                  {/* ✅ per-row currency */}
                  <td className="p-2">
                    <select
                      value={entry.isAfn ? "afn" : "usd"}
                      onChange={(e) => handleRowCurrencyChange(idx, e.target.value === "afn")}
                      className="w-20 border rounded px-1 py-1"
                    >
                      <option value="usd">$ دالر</option>
                      <option value="afn">؋ افغانی</option>
                    </select>
                  </td>
                  {/* ✅ per-row DV */}
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={entry.DV}
                      onChange={(e) => handleRowDVChange(idx, e.target.value)}
                      className="w-20 border rounded px-1 py-1"
                      required
                    />
                  </td>
                  <td className="p-2 text-gray-700 font-medium">
                    {entry.total || "—"} {symbolFor(entry.isAfn)}
                  </td>
                  <td className="p-2 text-center">
                    <button type="button" onClick={() => removeEntry(idx)} className="text-red-600 hover:text-red-800">
                      <FaMinusCircle />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center">
          <button type="button" onClick={addEntry} className="flex items-center gap-1 text-cyan-600 hover:text-cyan-800">
            <FaPlusCircle /> افزودن ردیف جدید
          </button>
          <div className="flex gap-3">
            {onCancel && <button type="button" onClick={onCancel} className="px-5 py-2 border rounded-lg">انصراف</button>}
            <button type="submit" disabled={submitLoading} className="px-5 py-2 bg-cyan-700 text-white rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50">
              {submitLoading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ذخیره همه"}</>}
            </button>
          </div>
        </div>
        {/* Payment section (global) */}
        <div className="mt-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">جمع کل فاکتور</label>
              <div className="text-2xl font-bold text-cyan-700">
                {totalAmount.toFixed(2)} {symbolFor(globalIsAfn)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ پرداختی (کل)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">باقیمانده کل</label>
              <div className="text-2xl font-bold text-red-600">
                {totalRemaind.toFixed(2)} {symbolFor(globalIsAfn)}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BincomeForm;