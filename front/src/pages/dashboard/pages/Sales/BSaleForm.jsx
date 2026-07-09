// components/stock/BSaleForm.jsx
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
const BSALES_API = `${BASE_URL}/bsales`;
const BUYER_API = `${BASE_URL}/buyer/active`;
const TYPE_API = `${BASE_URL}/type`;
const BEXIST_API = `${BASE_URL}/bexist`;

const BSaleForm = ({ onSuccess, editingId, initialEntries, onCancel }) => {
  const [entries, setEntries] = useState(
    initialEntries || [
      {
        typeId: "",
        categoryId: "",
        bexistId: "",
        quantity: "",
        unitPrice: "",
        total: "",
      },
    ]
  );

  const [buyers, setBuyers] = useState([]);
  const [buyerMode, setBuyerMode] = useState("existing");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [newBuyerName, setNewBuyerName] = useState("");

  const [types, setTypes] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [bexistMap, setBexistMap] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const [totalReceipt, setTotalReceipt] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [buyerRes, typeRes] = await Promise.all([
          axios.get(BUYER_API),
          axios.get(TYPE_API),
        ]);
        setBuyers(buyerRes.data.buyers || buyerRes.data);
        setTypes(typeRes.data || []);
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };
    fetchData();
  }, []);

  const fetchCategoriesForType = async (typeId) => {
    if (!typeId) return;
    if (categoriesMap[typeId]) return;
    try {
      const res = await axios.get(`${TYPE_API}/${typeId}/categories`);
      setCategoriesMap((prev) => ({ ...prev, [typeId]: res.data }));
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const fetchBexistForCategory = async (categoryId) => {
    if (!categoryId) return;
    if (bexistMap[categoryId]) return;
    try {
      const res = await axios.get(`${BEXIST_API}?categoryId=${categoryId}&limit=1000`);
      const items = res.data.data || [];
      setBexistMap((prev) => ({ ...prev, [categoryId]: items }));
    } catch (err) {
      console.error("Error loading blanket stock:", err);
    }
  };

  // ─── Compute total from quantity & unitPrice ──────────────────────────
  const computeTotal = (entry) => {
    const qty = parseFloat(entry.quantity) || 0;
    const price = parseFloat(entry.unitPrice) || 0;
    return (qty * price).toFixed(2);
  };

  // ─── Compute unitPrice from total & quantity ──────────────────────────
  const computeUnitPriceFromTotal = (entry) => {
    const qty = parseFloat(entry.quantity) || 0;
    const total = parseFloat(entry.total) || 0;
    if (qty > 0) {
      return (total / qty).toFixed(2);
    }
    return "";
  };

  // ─── Handle entry field changes ──────────────────────────────────────
  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;

    if (field === "typeId") {
      newEntries[index].categoryId = "";
      newEntries[index].bexistId = "";
      newEntries[index].quantity = "";
      newEntries[index].unitPrice = "";
      newEntries[index].total = "";
      fetchCategoriesForType(value);
      setEntries(newEntries);
      return;
    }

    if (field === "categoryId") {
      newEntries[index].bexistId = "";
      newEntries[index].quantity = "";
      newEntries[index].unitPrice = "";
      newEntries[index].total = "";
      fetchBexistForCategory(value);
      setEntries(newEntries);
      return;
    }

    // ─── Handle total edit – recalc unitPrice ──────────────────────────
    if (field === "total") {
      const totalVal = parseFloat(value);
      if (!isNaN(totalVal) && totalVal >= 0) {
        const qty = parseFloat(newEntries[index].quantity) || 0;
        if (qty > 0) {
          const newUnitPrice = (totalVal / qty).toFixed(2);
          newEntries[index].unitPrice = newUnitPrice;
        } else {
          // Quantity is zero, cannot compute unitPrice; keep it empty.
          // But we should not clear total.
        }
      }
      // ✅ Do NOT recalc total again – preserve user input
      setEntries(newEntries);
      return;
    }

    // ─── Handle quantity or unitPrice changes ──────────────────────────
    if (["quantity", "unitPrice"].includes(field)) {
      // Recalculate total
      const qty = parseFloat(newEntries[index].quantity) || 0;
      const price = parseFloat(newEntries[index].unitPrice) || 0;
      if (qty > 0 && price > 0) {
        newEntries[index].total = (qty * price).toFixed(2);
      } else {
        newEntries[index].total = "";
      }
    }

    setEntries(newEntries);
  };

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        typeId: "",
        categoryId: "",
        bexistId: "",
        quantity: "",
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

  const validateEntry = (entry) => {
    if (!entry.typeId) return "نوع باید انتخاب شود";
    if (!entry.categoryId) return "دسته‌بندی باید انتخاب شود";
    if (!entry.bexistId) return "موجودی (بلاکت) باید انتخاب شود";
    if (!entry.quantity || parseFloat(entry.quantity) <= 0)
      return "تعداد باید بزرگتر از صفر باشد";
    if (!entry.unitPrice || parseFloat(entry.unitPrice) <= 0)
      return "قیمت واحد باید بزرگتر از صفر باشد";
    if (!entry.total || parseFloat(entry.total) <= 0)
      return "مبلغ کل باید بزرگتر از صفر باشد";
    return null;
  };

  const originalTotal = entries.reduce((sum, entry) => sum + (parseFloat(entry.total) || 0), 0);
  const discount = parseFloat(discountAmount) || 0;
  const totalAmount = Math.max(originalTotal - discount, 0);
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

    if (discount > originalTotal + 0.01) {
      setError("مبلغ تخفیف نمی‌تواند بیشتر از کل فاکتور باشد");
      return;
    }
    if (receiptValue < 0) {
      setError("مبلغ دریافتی نمی‌تواند منفی باشد");
      return;
    }
    if (receiptValue > totalAmount + 0.01) {
      setError("مبلغ دریافتی نمی‌تواند بیشتر از کل فاکتور (پس از تخفیف) باشد");
      return;
    }

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

    // ─── Distribute receipt proportionally ──────────────────────────────
    const totalOriginal = originalTotal;
    const totalReceiptToDistribute = receiptValue;

    const baseEntries = entries.map((entry) => ({
      bexistId: parseInt(entry.bexistId),
      quantity: parseFloat(entry.quantity) || 0,
      unitPrice: parseFloat(entry.unitPrice) || 0,
      amount: parseFloat(entry.total) || 0,
    }));

    let shares = baseEntries.map((entry) => {
      if (totalOriginal === 0) return 0;
      return (entry.amount / totalOriginal) * totalReceiptToDistribute;
    });
    shares = shares.map((s) => Math.round(s * 100) / 100);
    shares = shares.map((s, idx) => Math.min(s, baseEntries[idx].amount));

    let sumShares = shares.reduce((a, b) => a + b, 0);
    let diff = Math.round((totalReceiptToDistribute - sumShares) * 100) / 100;
    if (Math.abs(diff) > 0.001 && shares.length > 0) {
      const lastIdx = shares.length - 1;
      let newShare = shares[lastIdx] + diff;
      newShare = Math.min(newShare, baseEntries[lastIdx].amount);
      newShare = Math.max(newShare, 0);
      shares[lastIdx] = newShare;
    }

    const bsalesArray = baseEntries.map((entry, idx) => {
      const receipt = shares[idx];
      const remaind = entry.amount - receipt;
      return {
        bexistId: entry.bexistId,
        quantity: entry.quantity,
        unit_price: entry.unitPrice,
        amount: entry.amount,
        receipt: Math.round(receipt * 100) / 100,
        remaind: Math.round(remaind * 100) / 100,
      };
    });

    mainPayload.bsales = bsalesArray;
    mainPayload.discount_amount = discount;

    setSubmitLoading(true);
    setError("");

    try {
      if (editingId) {
        await axios.put(`${BSALES_API}/${editingId}`, bsalesArray[0]);
      } else {
        await axios.post(BSALES_API, mainPayload);
      }

      onSuccess();
      if (!editingId) {
        setEntries([
          {
            typeId: "",
            categoryId: "",
            bexistId: "",
            quantity: "",
            unitPrice: "",
            total: "",
          },
        ]);
        setBuyerMode("existing");
        setSelectedBuyerId("");
        setNewBuyerName("");
        setTotalReceipt("");
        setDiscountAmount("");
      } else {
        onCancel();
      }
    } catch (err) {
      setError(err.response?.data?.message || "عملیات ناموفق بود");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          {editingId ? "ویرایش فروش بلنکت" : "ثبت فروش بلنکت جدید (چند ردیف)"}
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

      {/* Buyer selection */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          خریدار <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="existing"
              checked={buyerMode === "existing"}
              onChange={() => setBuyerMode("existing")}
            />
            انتخاب از لیست
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="new"
              checked={buyerMode === "new"}
              onChange={() => setBuyerMode("new")}
            />
            خریدار جدید
          </label>
        </div>
        {buyerMode === "existing" ? (
          <select
            value={selectedBuyerId}
            onChange={(e) => setSelectedBuyerId(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="">انتخاب خریدار</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.fullname}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newBuyerName}
            onChange={(e) => setNewBuyerName(e.target.value)}
            placeholder="نام خریدار جدید"
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        )}
      </div>

      {/* Table */}
      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">نوع *</th>
                <th className="p-2 border">دسته‌بندی *</th>
                <th className="p-2 border">موجودی (بلنکت) *</th>
                <th className="p-2 border">تعداد *</th>
                <th className="p-2 border">قیمت واحد *</th>
                <th className="p-2 border">جمع (قابل ویرایش) *</th>
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
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
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
                      {categoriesMap[entry.typeId]?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={entry.bexistId}
                      onChange={(e) => handleEntryChange(idx, "bexistId", e.target.value)}
                      className="w-40 border rounded px-1 py-1"
                      disabled={!entry.categoryId}
                      required
                    >
                      <option value="">انتخاب موجودی</option>
                      {bexistMap[entry.categoryId]?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.id} - موجودی: {item.quantity} - قیمت: {item.unitPrice}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.quantity}
                      onChange={(e) => handleEntryChange(idx, "quantity", e.target.value)}
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.unitPrice}
                      onChange={(e) => handleEntryChange(idx, "unitPrice", e.target.value)}
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.total}
                      onChange={(e) => handleEntryChange(idx, "total", e.target.value)}
                      className="w-24 border rounded px-1 py-1"
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
              className="px-5 py-2 bg-indigo-700 text-white rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50"
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

        {/* Financial summary */}
        <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">جمع کل (قبل از تخفیف)</label>
              <div className="text-xl font-bold text-gray-600">{originalTotal.toFixed(2)} افغانی</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تخفیف (مبلغ)</label>
              <input
                type="number"
                step="any"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-lg"
                placeholder="مبلغ تخفیف"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">جمع کل پس از تخفیف</label>
              <div className="text-2xl font-bold text-indigo-700">{totalAmount.toFixed(2)} افغانی</div>
            </div> */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">باقیمانده کل</label>
              <div className="text-2xl font-bold text-red-600">{totalRemaind.toFixed(2)} افغانی</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
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
          </div>
        </div>
      </form>
    </div>
  );
};

export default BSaleForm;