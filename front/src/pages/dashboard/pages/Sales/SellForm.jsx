import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaTimes, FaMinusCircle, FaPlusCircle } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const SELLS_API_URL = `${BASE_URL}/sells`;
const CUSTOMER_API = `${BASE_URL}/customer`;
const CATEGORY_API = `${BASE_URL}/category`;

const SellForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  // Each entry: categoryId, amount, unit_price, receipt, remaind (calculated)
  const [entries, setEntries] = useState(
    initialEntries || [{ categoryId: "", amount: "", unit_price: "", receipt: "", remaind: "" }]
  );
  const [customers, setCustomers] = useState([]);
  const [customerMode, setCustomerMode] = useState("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [categories, setCategories] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchCategories();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(CUSTOMER_API);
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(CATEGORY_API);
      // Assuming API returns array of categories with id, name
      setCategories(res.data.items || res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const calculateRemaind = (amount, unit_price, receipt) => {
    const total = (parseFloat(amount) || 0) * (parseFloat(unit_price) || 0);
    const paid = parseFloat(receipt) || 0;
    return total - paid;
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    // Recalculate remaind when amount, unit_price, or receipt change
    if (field === "amount" || field === "unit_price" || field === "receipt") {
      const remaind = calculateRemaind(newEntries[index].amount, newEntries[index].unit_price, newEntries[index].receipt);
      newEntries[index].remaind = remaind.toFixed(2);
    }
    setEntries(newEntries);
  };

  const addEntry = () => {
    setEntries([...entries, { categoryId: "", amount: "", unit_price: "", receipt: "", remaind: "" }]);
  };

  const removeEntry = (index) => {
    if (entries.length === 1) {
      setError("حداقل یک ردیف باید وجود داشته باشد");
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  const validateEntry = (entry) => {
    if (!entry.categoryId) return "دسته‌بندی باید انتخاب شود";
    if (!entry.amount || parseFloat(entry.amount) <= 0) return "مقدار باید بزرگتر از صفر باشد";
    if (!entry.unit_price || parseFloat(entry.unit_price) <= 0) return "قیمت واحد باید بزرگتر از صفر باشد";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all entries
    for (let i = 0; i < entries.length; i++) {
      const err = validateEntry(entries[i]);
      if (err) {
        setError(`ردیف ${i + 1}: ${err}`);
        return;
      }
    }

    // Customer part
    let customerPayload = {};
    if (customerMode === "existing") {
      if (!selectedCustomerId) {
        setError("لطفاً مشتری را از لیست انتخاب کنید");
        return;
      }
      customerPayload = { customerId: selectedCustomerId };
    } else {
      if (!newCustomerName.trim()) {
        setError("لطفاً نام مشتری جدید را وارد کنید");
        return;
      }
      customerPayload = { newCustomer: newCustomerName.trim() };
    }

    setSubmitLoading(true);
    setError("");
    try {
      const payloads = entries.map(entry => ({
        Category: entry.categoryId,
        amount: parseFloat(entry.amount),
        unit_price: parseFloat(entry.unit_price),
        receipt: parseFloat(entry.receipt) || 0,
        // remaind is auto-calculated on backend, but we can send it too
        ...customerPayload,
      }));

      if (editingId) {
        // Edit mode – only one entry expected
        await axios.put(`${SELLS_API_URL}/${editingId}`, payloads[0]);
      } else {
        for (const payload of payloads) {
          await axios.post(SELLS_API_URL, payload);
        }
      }
      onSuccess();
      if (!editingId) {
        // Reset form
        setEntries([{ categoryId: "", amount: "", unit_price: "", receipt: "", remaind: "" }]);
        setCustomerMode("existing");
        setSelectedCustomerId("");
        setNewCustomerName("");
      } else {
        onCancel();
      }
    } catch (err) {
      const msg = err.response?.data?.message || (editingId ? "ویرایش ناکام ماند" : "ایجاد ناکام ماند");
      setError(msg);
      console.error(err);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          {editingId ? "ویرایش فروش" : "ثبت فروش جدید (چند ردیف)"}
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

      {/* Customer selection (global) */}
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
            {customers.map(cust => (
              <option key={cust.id} value={cust.id}>{cust.fullname}</option>
            ))}
          </select>
        ) : (
          <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="نام مشتری جدید" className="w-full border rounded-lg px-4 py-2" required />
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">دسته‌بندی*</th>
                <th className="p-2 border">مقدار*</th>
                <th className="p-2 border">قیمت واحد*</th>
                <th className="p-2 border">دریافتی</th>
                <th className="p-2 border">باقیمانده (محاسبه)</th>
                <th className="p-2 border">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2 text-center">{idx + 1}</td>
                  <td className="p-2">
                    <select
                      value={entry.categoryId}
                      onChange={(e) => handleEntryChange(idx, "categoryId", e.target.value)}
                      className="w-32 border rounded px-1 py-1"
                      required
                    >
                      <option value="">انتخاب دسته</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.amount} onChange={(e) => handleEntryChange(idx, "amount", e.target.value)} className="w-20 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.unit_price} onChange={(e) => handleEntryChange(idx, "unit_price", e.target.value)} className="w-24 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.receipt} onChange={(e) => handleEntryChange(idx, "receipt", e.target.value)} className="w-24 border rounded px-1 py-1" />
                  </td>
                  <td className="p-2 text-gray-600">{entry.remaind ? parseFloat(entry.remaind).toFixed(2) : "—"}</td>
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
          <button type="button" onClick={addEntry} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
            <FaPlusCircle /> افزودن ردیف جدید
          </button>
          <div className="flex gap-3">
            {onCancel && <button type="button" onClick={onCancel} className="px-5 py-2 border rounded-lg">انصراف</button>}
            <button type="submit" disabled={submitLoading} className="px-5 py-2 bg-green-800 text-white rounded-lg shadow-md flex items-center gap-2">
              {submitLoading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ذخیره همه"}</>}
            </button>
          </div>
        </div>
        {!editingId && (
          <p className="text-xs text-gray-400 mt-3">
            توجه: هر ردیف به صورت جداگانه در دیتابیس ثبت می‌شود. مشتری برای همه ردیف‌ها یکسان است.
          </p>
        )}
      </form>
    </div>
  );
};

export default SellForm;