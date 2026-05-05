import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaTimes, FaMinusCircle, FaPlusCircle } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/income`;
const CUSTOMER_API = `${BASE_URL}/customer`; // adjust to your customer endpoint

const IncomeForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  const [entries, setEntries] = useState(
    initialEntries || [{ width: "", color: "", degree: "", lotNumber: "", area: "", length: "" }]
  );
  const [customers, setCustomers] = useState([]);
  const [customerMode, setCustomerMode] = useState("existing"); // "existing" or "new"
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(CUSTOMER_API);
      setCustomers(response.data.customers);
    } catch (err) {
      console.error("Error loading customers:", err);
    }
  };

  const calculateLength = (width, area) => {
    if (width && area && parseFloat(width) > 0) {
      return (parseFloat(area) / parseFloat(width)).toFixed(2);
    }
    return "";
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    if (field === "width" || field === "area") {
      newEntries[index].length = calculateLength(newEntries[index].width, newEntries[index].area);
    }
    setEntries(newEntries);
  };

  const addEntry = () => {
    setEntries([...entries, { width: "", color: "", degree: "", lotNumber: "", area: "", length: "" }]);
  };

  const removeEntry = (index) => {
    if (entries.length === 1) {
      setError("حداقل یک ردیف باید وجود داشته باشد");
      return;
    }
    const newEntries = entries.filter((_, i) => i !== index);
    setEntries(newEntries);
  };

  const validateEntry = (entry) => {
    if (!entry.width || parseFloat(entry.width) <= 0) return "عرض باید بزرگتر از صفر باشد";
    if (!entry.area || parseFloat(entry.area) <= 0) return "مساحت باید بزرگتر از صفر باشد";
    if (!entry.color.trim()) return "رنگ الزامی است";
    if (!entry.lotNumber.trim()) return "شماره لات الزامی است";
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

    // Build customer part of payload
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
      const basePayload = {
        width: parseFloat(entries[0].width),
        color: entries[0].color.trim(),
        degree: entries[0].degree.trim() || null,
        lotNumber: entries[0].lotNumber.trim(),
        area: parseFloat(entries[0].area),
        ...customerPayload,
      };

      if (editingId) {
        // Update single record
        await axios.put(`${API_BASE_URL}/${editingId}`, basePayload);
      } else {
        // Create multiple records – each entry as separate request
        for (const entry of entries) {
          const payload = {
            width: parseFloat(entry.width),
            color: entry.color.trim(),
            degree: entry.degree.trim() || null,
            lotNumber: entry.lotNumber.trim(),
            area: parseFloat(entry.area),
            ...customerPayload,
          };
          await axios.post(API_BASE_URL, payload);
        }
      }

      onSuccess(); // refresh the list
      if (!editingId) {
        // Reset form after successful creation, keep it open for new entries
        setEntries([{ width: "", color: "", degree: "", lotNumber: "", area: "", length: "" }]);
        setCustomerMode("existing");
        setSelectedCustomerId("");
        setNewCustomerName("");
      } else {
        onCancel(); // close form after edit
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

      {/* Customer selection section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">مشتری <span className="text-red-500">*</span></label>
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
            {Array.isArray(customers) && customers.map(cust => (
              <option key={cust.id} value={cust.id}>{cust.fullname}</option>
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

      {/* Multi‑item table */}
      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">عرض (متر)*</th>
                <th className="p-2 border">مساحت (متر مربع)*</th>
                <th className="p-2 border">طول (محاسبه)</th>
                <th className="p-2 border">رنگ*</th>
                <th className="p-2 border">درجه</th>
                <th className="p-2 border">شماره لات*</th>
                <th className="p-2 border">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2 text-center">{idx + 1}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.width}
                      onChange={(e) => handleEntryChange(idx, "width", e.target.value)}
                      className="w-24 border rounded px-2 py-1"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.area}
                      onChange={(e) => handleEntryChange(idx, "area", e.target.value)}
                      className="w-24 border rounded px-2 py-1"
                      required
                    />
                  </td>
                  <td className="p-2 text-gray-600">{entry.length || "—"}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={entry.color}
                      onChange={(e) => handleEntryChange(idx, "color", e.target.value)}
                      className="w-28 border rounded px-2 py-1"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={entry.degree}
                      onChange={(e) => handleEntryChange(idx, "degree", e.target.value)}
                      className="w-24 border rounded px-2 py-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={entry.lotNumber}
                      onChange={(e) => handleEntryChange(idx, "lotNumber", e.target.value)}
                      className="w-32 border rounded px-2 py-1"
                      required
                    />
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
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
          >
            <FaPlusCircle /> افزودن ردیف جدید
          </button>
          <div className="flex gap-3">
            {onCancel && (
              <button type="button" onClick={onCancel} className="px-5 py-2 border rounded-lg">
                انصراف
              </button>
            )}
            <button
              type="submit"
              disabled={submitLoading}
              className="px-5 py-2 bg-indigo-800 text-white rounded-lg shadow-md flex items-center gap-2"
            >
              {submitLoading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ذخیره همه"}</>}
            </button>
          </div>
        </div>

        {!editingId && (
          <p className="text-xs text-gray-400 mt-3">
            توجه: هر ردیف به صورت جداگانه در دیتابیس ثبت می‌شود. شماره لات و مشتری باید معتبر باشد.
          </p>
        )}
      </form>
    </div>
  );
};

export default IncomeForm;