import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSpinner, FaSave, FaTimes, FaMinusCircle, FaPlusCircle } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const SELLS_API_URL = `${BASE_URL}/sells`;
const BUYER_API = `${BASE_URL}/buyer/active`;
const TYPE_API = `${BASE_URL}/type`;

const SellForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  // Each entry: typeId, categoryId, incomeId, incomeWidth, length, area, total, unit_price, receipt, remaind
  const [entries, setEntries] = useState(
    initialEntries || [{
      typeId: "",
      categoryId: "",
      incomeId: "",
      incomeWidth: "",
      length: "",
      area: "",
      total: "",
      unit_price: "",
      receipt: "",
      remaind: ""
    }]
  );
  const [buyers, setBuyers] = useState([]);
  const [buyerMode, setBuyerMode] = useState("existing");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [newBuyerName, setNewBuyerName] = useState("");
  const [types, setTypes] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [incomesMap, setIncomesMap] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchBuyers();
    fetchTypes();
  }, []);

  const fetchBuyers = async () => {
    try {
      const res = await axios.get(BUYER_API);
      setBuyers(res.data.buyers || res.data);
    } catch (err) {
      console.error("Error loading buyers:", err);
    }
  };

  const fetchTypes = async () => {
    try {
      const res = await axios.get(TYPE_API);
      setTypes(res.data);
    } catch (err) {
      console.error("Error loading types:", err);
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

  const fetchIncomesForCategory = async (categoryId) => {
    if (!categoryId) return;
    if (incomesMap[categoryId]) return;
    try {
      const res = await axios.get(`${BASE_URL}/category/${categoryId}/incomes`);
      setIncomesMap(prev => ({ ...prev, [categoryId]: res.data }));
    } catch (err) {
      console.error("Error loading incomes for category:", err);
      setIncomesMap(prev => ({ ...prev, [categoryId]: [] }));
    }
  };

  // Calculate area, total, and remaind
  const calculateDerivedValues = (entry) => {
    const length = parseFloat(entry.length) || 0;
    const width = parseFloat(entry.incomeWidth) || 0;
    const area = length * width;
    const unit_price = parseFloat(entry.unit_price) || 0;
    const total = length * unit_price;   // still linear meter pricing
    const receipt = parseFloat(entry.receipt) || 0;
    const remaind = total - receipt;
    return {
      area: area.toFixed(2),
      total: total.toFixed(2),
      remaind: remaind.toFixed(2),
    };
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;

    if (field === "typeId") {
      newEntries[index].categoryId = "";
      newEntries[index].incomeId = "";
      newEntries[index].incomeWidth = "";
      newEntries[index].length = "";
      newEntries[index].area = "";
      newEntries[index].total = "";
      newEntries[index].remaind = "";
      fetchCategoriesForType(value);
    }
    if (field === "categoryId") {
      newEntries[index].incomeId = "";
      newEntries[index].incomeWidth = "";
      newEntries[index].length = "";
      newEntries[index].area = "";
      newEntries[index].total = "";
      newEntries[index].remaind = "";
      fetchIncomesForCategory(value);
    }
    if (field === "incomeId") {
      // Find the selected income and store its width
      const selectedIncome = incomesMap[newEntries[index].categoryId]?.find(
        inc => inc.id === parseInt(value)
      );
      newEntries[index].incomeWidth = selectedIncome ? selectedIncome.width : "";
      newEntries[index].length = "";
      newEntries[index].area = "";
      newEntries[index].total = "";
      newEntries[index].remaind = "";
    }

    // Recalculate area, total, remaind when length, unit_price, receipt, or incomeWidth changes
    if (field === "length" || field === "unit_price" || field === "receipt" || field === "incomeWidth") {
      const { area, total, remaind } = calculateDerivedValues(newEntries[index]);
      newEntries[index].area = area;
      newEntries[index].total = total;
      newEntries[index].remaind = remaind;
    }

    setEntries(newEntries);
  };

  const addEntry = () => {
    setEntries([...entries, {
      typeId: "",
      categoryId: "",
      incomeId: "",
      incomeWidth: "",
      length: "",
      area: "",
      total: "",
      unit_price: "",
      receipt: "",
      remaind: ""
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
    if (!entry.incomeId) return "درآمد (Income) باید انتخاب شود";
    if (!entry.length || parseFloat(entry.length) <= 0) return "طول باید بزرگتر از صفر باشد";
    if (!entry.unit_price || parseFloat(entry.unit_price) <= 0) return "قیمت واحد باید بزرگتر از صفر باشد";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (let i = 0; i < entries.length; i++) {
      const err = validateEntry(entries[i]);
      if (err) {
        setError(`ردیف ${i + 1}: ${err}`);
        return;
      }
    }

    // Build the main payload object
    const mainPayload = {};

    if (buyerMode === "existing") {
      if (!selectedBuyerId) {
        setError("لطفاً خریدار را از لیست انتخاب کنید");
        return;
      }
      mainPayload.buyerId = selectedBuyerId;
    } else {
      if (!newBuyerName.trim()) {
        setError("لطفاً نام خریدار جدید را وارد کنید");
        return;
      }
      mainPayload.newBuyer = newBuyerName.trim();
    }

    // Build the sells array
    const sellsArray = entries.map(entry => {
      const length = parseFloat(entry.length);
      const unit_price = parseFloat(entry.unit_price);
      const receipt = parseFloat(entry.receipt) || 0;
      const total = length * unit_price;
      const remaind = total - receipt;
      const area = parseFloat(entry.area) || 0;
      return {
        categoryId: entry.categoryId,
        incomeId: entry.incomeId,
        length: length,
        area: area,
        amount: total.toFixed(2),
        unit_price,
        receipt,
        remaind: remaind.toFixed(2),
      };
    });

    // Attach sells array to main payload
    mainPayload.sells = sellsArray;

    setSubmitLoading(true);
    setError("");
    try {
      if (editingId) {
        // Edit mode – update a single sell (still uses first entry only)
        await axios.put(`${SELLS_API_URL}/${editingId}`, sellsArray[0]);
      } else {
        // Create mode – send the whole structure: { buyerId/newBuyer, sells: [...] }
        await axios.post(SELLS_API_URL, mainPayload);
      }

      onSuccess();
      if (!editingId) {
        // Reset form
        setEntries([{
          typeId: "",
          categoryId: "",
          incomeId: "",
          incomeWidth: "",
          length: "",
          area: "",
          total: "",
          unit_price: "",
          receipt: "",
          remaind: ""
        }]);
        setBuyerMode("existing");
        setSelectedBuyerId("");
        setNewBuyerName("");
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

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">خریدار <span className="text-red-500">*</span></label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2">
            <input type="radio" value="existing" checked={buyerMode === "existing"} onChange={() => setBuyerMode("existing")} />
            انتخاب از لیست
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="new" checked={buyerMode === "new"} onChange={() => setBuyerMode("new")} />
            خریدار جدید
          </label>
        </div>
        {buyerMode === "existing" ? (
          <select value={selectedBuyerId} onChange={(e) => setSelectedBuyerId(e.target.value)} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">انتخاب خریدار</option>
            {buyers.map(b => <option key={b.id} value={b.id}>{b.fullname}</option>)}
          </select>
        ) : (
          <input type="text" value={newBuyerName} onChange={(e) => setNewBuyerName(e.target.value)} placeholder="نام خریدار جدید" className="w-full border rounded-lg px-4 py-2" required />
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
                <th className="p-2 border">درآمد*</th>
                <th className="p-2 border">عرض (متر)</th>
                <th className="p-2 border">طول (متر)*</th>
                <th className="p-2 border">مساحت (محاسبه)</th>
                <th className="p-2 border">قیمت واحد*</th>
                <th className="p-2 border">مبلغ کل (محاسبه)</th>
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
                      className="w-32 border rounded px-1 py-1"
                      disabled={!entry.typeId}
                      required
                    >
                      <option value="">انتخاب دسته</option>
                      {categoriesMap[entry.typeId]?.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={entry.incomeId}
                      onChange={(e) => handleEntryChange(idx, "incomeId", e.target.value)}
                      className="w-40 border rounded px-1 py-1"
                      disabled={!entry.categoryId}
                      required
                    >
                      <option value="">انتخاب درآمد</option>
                      {incomesMap[entry.categoryId]?.map(inc => (
                        <option key={inc.id} value={inc.id}>
                          {inc.lotNumber} - {inc.width}x{inc.length} - {inc.color}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-center">{entry.incomeWidth || "—"}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.length}
                      onChange={(e) => handleEntryChange(idx, "length", e.target.value)}
                      className="w-20 border rounded px-1 py-1"
                      disabled={!entry.incomeId}
                      required
                    />
                  </td>
                  <td className="p-2 text-gray-700 font-medium">{entry.area || "—"} m²</td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.unit_price}
                      onChange={(e) => handleEntryChange(idx, "unit_price", e.target.value)}
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                  </td>
                  <td className="p-2 text-gray-700 font-medium">{entry.total || "—"} ؋</td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.receipt}
                      onChange={(e) => handleEntryChange(idx, "receipt", e.target.value)}
                      className="w-24 border rounded px-1 py-1"
                    />
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
            <button type="submit" disabled={submitLoading} className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-md flex items-center gap-2">
              {submitLoading ? <><FaSpinner className="animate-spin" />در حال ذخیره...</> : <><FaSave />{editingId ? "به‌روزرسانی" : "ذخیره همه"}</>}
            </button>
          </div>
        </div>
        {!editingId && (
          <p className="text-xs text-gray-400 mt-3">
            مساحت = عرض × طول. مبلغ کل = طول × قیمت واحد. باقیمانده = مبلغ کل - دریافتی.
          </p>
        )}
      </form>
    </div>
  );
};

export default SellForm;