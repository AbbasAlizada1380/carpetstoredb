import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaTimes, FaMinusCircle, FaPlusCircle } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const API_BASE_URL = `${BASE_URL}/income`;
const CUSTOMER_API = `${BASE_URL}/customer/active`;
const TYPE_API = `${BASE_URL}/type`;

const IncomeForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  const [entries, setEntries] = useState(
    initialEntries || [{
      typeId: "",
      categoryId: "",
      width: "",
      color: "",
      degree: "",
      lotNumber: "",
      area: "",
      length: "",           // for display only
      unit_price: "",
      total: ""             // calculated = area * unit_price
    }]
  );
  const [customers, setCustomers] = useState([]);
  const [customerMode, setCustomerMode] = useState("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [types, setTypes] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  // Global payment state
  const [totalReceipt, setTotalReceipt] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchTypes();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(CUSTOMER_API);
      setCustomers(res.data.customers);
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

  // Calculate length (area/width) and total (area * unit_price)
  const calculateEntryValues = (entry) => {
    const width = parseFloat(entry.width) || 0;
    const area = parseFloat(entry.area) || 0;
    const length = (width > 0 && area > 0) ? (area / width) : 0;
    const unit_price = parseFloat(entry.unit_price) || 0;
    const total = area * unit_price;  // ✅ total based on area
    return {
      length: length.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;

    if (field === "typeId") {
      newEntries[index].categoryId = "";
      fetchCategoriesForType(value);
    }

    // Recalculate length and total when width, area, or unit_price changes
    if (["width", "area", "unit_price"].includes(field)) {
      const { length, total } = calculateEntryValues(newEntries[index]);
      newEntries[index].length = length;
      newEntries[index].total = total;
    }

    setEntries(newEntries);
  };

  const addEntry = () => {
    setEntries([...entries, {
      typeId: "",
      categoryId: "",
      width: "",
      color: "",
      degree: "",
      lotNumber: "",
      area: "",
      length: "",
      unit_price: "",
      total: ""
    }]);
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
    if (!entry.width || parseFloat(entry.width) <= 0) return "عرض باید بزرگتر از صفر باشد";
    if (!entry.area || parseFloat(entry.area) <= 0) return "مساحت باید بزرگتر از صفر باشد";
    if (!entry.color.trim()) return "رنگ الزامی است";
    if (!entry.lotNumber.trim()) return "شماره لات الزامی است";
    if (!entry.unit_price || parseFloat(entry.unit_price) <= 0) return "قیمت واحد باید بزرگتر از صفر باشد";
    return null;
  };

  // Compute global totals (based on area * unit_price)
  const totalAmount = entries.reduce((sum, entry) => sum + (parseFloat(entry.total) || 0), 0);
  const receiptValue = parseFloat(totalReceipt) || 0;
  const totalRemaind = totalAmount - receiptValue;

  const handleSubmit = async (e) => {
    e.preventDefault();

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
    if (receiptValue > totalAmount + 0.01) {
      setError("مبلغ دریافتی نمی‌تواند بیشتر از کل فاکتور باشد");
      return;
    }

    // Build customer part
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

    // Build incomes array using area * unit_price for amount
    const incomesArray = entries.map(entry => {
      const area = parseFloat(entry.area);
      const unit_price = parseFloat(entry.unit_price);
      const amount = area * unit_price;          // ✅ amount = area × unit_price
      return {
        typeId: entry.typeId,
        categoryId: entry.categoryId,
        width: parseFloat(entry.width),
        color: entry.color.trim(),
        degree: entry.degree.trim() || null,
        lotNumber: entry.lotNumber.trim(),
        area: area,
        unit_price: unit_price,
        amount: amount.toFixed(2)
      };
    });

    mainPayload.incomes = incomesArray;
    mainPayload.totalReceipt = receiptValue;

    setSubmitLoading(true);
    setError("");
    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}/${editingId}`, incomesArray[0]);
      } else {
        await axios.post(API_BASE_URL, mainPayload);
      }
      onSuccess();
      if (!editingId) {
        setEntries([{
          typeId: "",
          categoryId: "",
          width: "",
          color: "",
          degree: "",
          lotNumber: "",
          area: "",
          length: "",
          unit_price: "",
          total: ""
        }]);
        setCustomerMode("existing");
        setSelectedCustomerId("");
        setNewCustomerName("");
        setTotalReceipt("");
      } else {
        onCancel();
      }
    } catch (err) {
      setError(err.response?.data?.message || (editingId ? "ویرایش ناکام ماند" : "ایجاد ناکام ماند"));
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

      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">نوع*</th>
                <th className="p-2 border">دسته‌بندی*</th>
                <th className="p-2 border">عرض (متر)*</th>
                <th className="p-2 border">مساحت (م²)*</th>
                <th className="p-2 border">طول (محاسبه)</th>
                <th className="p-2 border">رنگ*</th>
                <th className="p-2 border">درجه</th>
                <th className="p-2 border">شماره لات*</th>
                <th className="p-2 border">قیمت واحد (؋/م²)*</th>
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
                    <input type="number" step="any" value={entry.width} onChange={(e) => handleEntryChange(idx, "width", e.target.value)} className="w-20 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.area} onChange={(e) => handleEntryChange(idx, "area", e.target.value)} className="w-20 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2 text-gray-600">{entry.length || "—"}</td>
                  <td className="p-2">
                    <input type="text" value={entry.color} onChange={(e) => handleEntryChange(idx, "color", e.target.value)} className="w-24 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2">
                    <input type="text" value={entry.degree} onChange={(e) => handleEntryChange(idx, "degree", e.target.value)} className="w-20 border rounded px-1 py-1" />
                  </td>
                  <td className="p-2">
                    <input type="text" value={entry.lotNumber} onChange={(e) => handleEntryChange(idx, "lotNumber", e.target.value)} className="w-32 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2">
                    <input type="number" step="any" value={entry.unit_price} onChange={(e) => handleEntryChange(idx, "unit_price", e.target.value)} className="w-24 border rounded px-1 py-1" required />
                  </td>
                  <td className="p-2 text-gray-700 font-medium">{entry.total || "—"} ؋</td>
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
            <button type="submit" disabled={submitLoading} className="px-5 py-2 bg-primary text-white rounded-lg shadow-md flex items-center gap-2">
              {submitLoading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ذخیره همه"}</>}
            </button>
          </div>
        </div>
        {/* Payment section (global) */}
        <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">جمع کل فاکتور</label>
              <div className="text-2xl font-bold text-indigo-700">{totalAmount.toFixed(2)} ؋</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ دریافتی (کل)</label>
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
              <div className="text-2xl font-bold text-red-600">{totalRemaind.toFixed(2)} ؋</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * مبلغ دریافتی به ترتیب (ردیف به ردیف) به اقلام فاکتور اختصاص می‌یابد تا تسویه شود.
          </p>
        </div>


      </form>
    </div>
  );
};

export default IncomeForm;