// components/stock/BSaleForm.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  FaSpinner,
  FaSave,
  FaTimes,
  FaMinusCircle,
  FaPlusCircle,
  FaLock,
} from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const BSALES_API = `${BASE_URL}/bsales`;
const BUYER_API = `${BASE_URL}/buyer/active`;
const TYPE_API = `${BASE_URL}/type`;
const BEXIST_API = `${BASE_URL}/bexist`;

const CURRENCY_SYMBOL = { afn: "؋", usd: "$" };
const symbolFor = (isAfn) => (isAfn ? CURRENCY_SYMBOL.afn : CURRENCY_SYMBOL.usd);
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const emptyEntry = (defaults = {}) => ({
  bsaleId: null,
  typeId: "",
  categoryId: "",
  bexistId: "",
  quantity: "",
  unitPrice: "",
  total: "",
  receipt: 0,
  remaind: 0,
  isAfn: defaults.isAfn ?? false,
  DV: defaults.DV ?? 65,
});

const BSaleForm = ({
  onSuccess,
  editingId,
  editingIds, // ✅ NEW — array of BSale ids for multi-row edit
  initialEntries,
  onCancel,
  editingData,
  editingMeta,
}) => {
  // ✅ Consider "edit mode" if EITHER a single id or a non-empty array is passed
  const isEdit =
    Boolean(editingId) ||
    (Array.isArray(editingIds) && editingIds.length > 0);

  const [globalIsAfn, setGlobalIsAfn] = useState(false);
  const [globalDV, setGlobalDV] = useState(65);

  const [entries, setEntries] = useState(initialEntries || [emptyEntry()]);

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

  // ─── Initial data ──────────────────────────────────────────────────────
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

  // ✅ Hydrate global currency from first entry when editing
  useEffect(() => {
    if (initialEntries && initialEntries.length > 0) {
      const first = initialEntries[0];
      if (first.isAfn !== undefined) setGlobalIsAfn(!!first.isAfn);
      if (first.DV !== undefined && first.DV !== null) {
        setGlobalDV(parseFloat(first.DV) || 65);
      }
    }
  }, [initialEntries]);

  // ✅ Hydrate buyer + receipt (edit mode) — primitive deps
  useEffect(() => {
    if (!isEdit || !editingMeta) return;
    if (editingMeta.buyerId) {
      setBuyerMode("existing");
      setSelectedBuyerId(String(editingMeta.buyerId));
    }
    if (editingMeta.receipt !== undefined && editingMeta.receipt !== null) {
      setTotalReceipt(String(editingMeta.receipt));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMeta?.buyerId, editingMeta?.receipt]);

  // ✅ Preload categories + bExists for ALL rows (not just [0])
  useEffect(() => {
    if (!initialEntries || initialEntries.length === 0) return;
    const seenTypes = new Set();
    const seenCats = new Set();
    initialEntries.forEach((e) => {
      if (e.typeId && !seenTypes.has(e.typeId)) {
        seenTypes.add(e.typeId);
        if (!categoriesMap[e.typeId]) fetchCategoriesForType(e.typeId);
      }
      if (e.categoryId && !seenCats.has(e.categoryId)) {
        seenCats.add(e.categoryId);
        if (!bexistMap[e.categoryId]) fetchBexistForCategory(e.categoryId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const res = await axios.get(
        `${BEXIST_API}?categoryId=${categoryId}&limit=1000`
      );
      const items = res.data.data || [];
      setBexistMap((prev) => ({ ...prev, [categoryId]: items }));
    } catch (err) {
      console.error("Error loading blanket stock:", err);
    }
  };

  const handleRowCurrencyChange = (index, isAfn) => {
    const newEntries = [...entries];
    newEntries[index].isAfn = isAfn;
    setEntries(newEntries);
  };

  const handleRowDVChange = (index, DV) => {
    const newEntries = [...entries];
    newEntries[index].DV = DV;
    setEntries(newEntries);
  };

  const applyGlobalCurrency = (isAfn) => {
    setGlobalIsAfn(isAfn);
    setEntries((prev) => prev.map((e) => ({ ...e, isAfn })));
  };

  const applyGlobalDV = (DV) => {
    setGlobalDV(DV);
    setEntries((prev) => prev.map((e) => ({ ...e, DV })));
  };

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

    if (field === "total") {
      const totalVal = parseFloat(value);
      if (!isNaN(totalVal) && totalVal >= 0) {
        const qty = parseFloat(newEntries[index].quantity) || 0;
        if (qty > 0) {
          newEntries[index].unitPrice = (totalVal / qty).toFixed(2);
        }
      }
      setEntries(newEntries);
      return;
    }

    if (["quantity", "unitPrice"].includes(field)) {
      const qty = parseFloat(newEntries[index].quantity) || 0;
      const price = parseFloat(newEntries[index].unitPrice) || 0;
      newEntries[index].total =
        qty > 0 && price > 0 ? (qty * price).toFixed(2) : "";
    }

    setEntries(newEntries);
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

  const validateEntry = (entry, index) => {
    // In edit mode, type/category/bexist are locked — don't require them to be
    // re-selected; just verify their existing values are valid.
    if (!isEdit) {
      if (!entry.typeId) return `ردیف ${index + 1}: نوع باید انتخاب شود`;
      if (!entry.categoryId) return `ردیف ${index + 1}: دسته‌بندی باید انتخاب شود`;
      if (!entry.bexistId) return `ردیف ${index + 1}: موجودی (بلاکت) باید انتخاب شود`;
    }
    if (!entry.quantity || parseFloat(entry.quantity) <= 0)
      return `ردیف ${index + 1}: تعداد باید بزرگتر از صفر باشد`;
    if (!entry.unitPrice || parseFloat(entry.unitPrice) <= 0)
      return `ردیف ${index + 1}: قیمت واحد باید بزرگتر از صفر باشد`;
    if (!entry.total || parseFloat(entry.total) <= 0)
      return `ردیف ${index + 1}: مبلغ کل باید بزرگتر از صفر باشد`;
    if (!entry.DV || parseFloat(entry.DV) <= 0)
      return `ردیف ${index + 1}: نرخ دالر باید بزرگتر از صفر باشد`;
    return null;
  };

  const originalTotal = entries.reduce(
    (sum, e) => sum + (parseFloat(e.total) || 0),
    0
  );
  const discount = parseFloat(discountAmount) || 0;
  const totalAmount = Math.max(originalTotal - discount, 0);
  const receiptValue = parseFloat(totalReceipt) || 0;
  const totalRemaind = totalAmount - receiptValue;

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (let i = 0; i < entries.length; i++) {
      const err = validateEntry(entries[i], i);
      if (err) {
        setError(err);
        return;
      }
    }

    const currencySet = new Set(entries.map((en) => !!en.isAfn));
    if (currencySet.size > 1) {
      setError(
        "همه ردیف‌ها باید یک واحد پول داشته باشند. لطفاً واحد پول را یکسان کنید یا فاکتور را جدا ثبت کنید."
      );
      return;
    }

    if (!isEdit) {
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
    }

    // Build base entries once — carries per-row receipt/remaind/bsaleId
    const baseEntries = entries.map((entry) => ({
      bsaleId: entry.bsaleId || null,
      bexistId: parseInt(entry.bexistId),
      quantity: parseFloat(entry.quantity) || 0,
      unitPrice: parseFloat(entry.unitPrice) || 0,
      amount: parseFloat(entry.total) || 0,
      receipt: parseFloat(entry.receipt) || 0,
      remaind: parseFloat(entry.remaind) || 0,
      isAfn: !!entry.isAfn,
      DV: parseFloat(entry.DV) || 65,
    }));

    // ─── EDIT MODE: one PUT per row ───────────────────────────────────
    if (isEdit) {
      if (baseEntries.some((be) => !be.bsaleId)) {
        setError(
          "خطای داده: یکی از ردیف‌ها شناسه فروش ندارد. لطفاً فرم را ببندید و دوباره باز کنید."
        );
        return;
      }

      setSubmitLoading(true);
      setError("");
      try {
        await Promise.all(
          baseEntries.map((be) => {
            const payload = {
              bexistId: be.bexistId,
              quantity: be.quantity,
              unit_price: be.unitPrice,
              total: be.amount,
              receipt: be.receipt,
              remaind: be.remaind,
              // isAfn intentionally NOT sent — currency is locked on edit
              DV: be.DV,
            };
            return axios.put(`${BSALES_API}/${be.bsaleId}`, payload);
          })
        );
        onSuccess();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "برخی ردیف‌ها به‌روزرسانی نشدند. لطفاً دوباره تلاش کنید."
        );
        console.error(err);
      } finally {
        setSubmitLoading(false);
      }
      return;
    }

    // ─── CREATE MODE ──────────────────────────────────────────────────
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

    let shares = baseEntries.map((entry) =>
      originalTotal === 0 ? 0 : (entry.amount / originalTotal) * receiptValue
    );
    shares = shares.map((s) => Math.round(s * 100) / 100);
    shares = shares.map((s, idx) => Math.min(s, baseEntries[idx].amount));

    let sumShares = shares.reduce((a, b) => a + b, 0);
    let diff = Math.round((receiptValue - sumShares) * 100) / 100;
    if (Math.abs(diff) > 0.001 && shares.length > 0) {
      const lastIdx = shares.length - 1;
      let newShare = Math.min(shares[lastIdx] + diff, baseEntries[lastIdx].amount);
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
        isAfn: entry.isAfn,
        DV: entry.DV,
      };
    });

    mainPayload.bsales = bsalesArray;
    mainPayload.discount_amount = discount;
    mainPayload.isAfn = !!globalIsAfn;
    mainPayload.DV = parseFloat(globalDV) || 65;

    setSubmitLoading(true);
    setError("");

    try {
      await axios.post(BSALES_API, mainPayload);
      onSuccess();
      setEntries([emptyEntry()]);
      setBuyerMode("existing");
      setSelectedBuyerId("");
      setNewBuyerName("");
      setTotalReceipt("");
      setDiscountAmount("");
      setGlobalIsAfn(false);
      setGlobalDV(65);
    } catch (err) {
      setError(err.response?.data?.message || "عملیات ناموفق بود");
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── Fallback helpers (per row via editingData[idx]) ─────────────────
  const isCurrentBexistMissing = (entry) => {
    if (!entry.bexistId) return false;
    const list = bexistMap[entry.categoryId] || [];
    return !list.some((item) => Number(item.id) === Number(entry.bexistId));
  };

  const isCurrentCategoryMissing = (entry) => {
    if (!entry.categoryId) return false;
    const list = categoriesMap[entry.typeId] || [];
    return !list.some((cat) => Number(cat.id) === Number(entry.categoryId));
  };

  const buyerDisplayName =
    editingMeta?.buyerName ||
    buyers.find((b) => Number(b.id) === Number(editingMeta?.buyerId))?.fullname ||
    (editingMeta?.buyerId ? `خریدار #${editingMeta.buyerId}` : "—");

  const summaryIsAfn = isEdit ? entries[0]?.isAfn ?? false : globalIsAfn;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          {isEdit
            ? `ویرایش فروش بلنکت (${entries.length} ردیف)`
            : "ثبت فروش بلنکت جدید (چند ردیف)"}
        </h3>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <FaTimes />
          </button>
        )}
      </div>

      {isEdit && (
        <div className="mb-4 p-3 bg-blue-50 border-r-4 border-blue-500 text-blue-800 rounded-lg text-sm flex items-center gap-2">
          <FaLock />
          در حالت ویرایش فقط <strong>تعداد</strong>، <strong>قیمت واحد</strong>،{" "}
          <strong>مبلغ کل</strong> و <strong>DV</strong> قابل تغییر هستند. سایر
          فیلدها ثابت‌اند.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Buyer */}
      {!isEdit ? (
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
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            خریدار
          </label>
          <div className="w-full bg-gray-100 border rounded-lg px-4 py-2 text-gray-700">
            {buyerDisplayName}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            خریدار پس از ایجاد فاکتور قابل تغییر نیست.
          </p>
        </div>
      )}

      {/* Global currency */}
      {!isEdit ? (
        <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                واحد پول پیش‌فرض:
              </span>
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
              <span className="text-sm font-medium text-gray-700">
                نرخ دالر (DV):
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={globalDV}
                onChange={(e) => applyGlobalDV(e.target.value)}
                className="w-28 border rounded-lg px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">واحد پول:</span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  summaryIsAfn
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {symbolFor(summaryIsAfn)} {currencyLabel(summaryIsAfn)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                نرخ دالر (DV):
              </span>
              <span className="text-sm text-gray-800 font-mono">
                {entries[0]?.DV ?? "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">نوع {isEdit ? "" : "*"}</th>
                <th className="p-2 border">دسته‌بندی {isEdit ? "" : "*"}</th>
                <th className="p-2 border">موجودی (بلنکت) {isEdit ? "" : "*"}</th>
                <th className="p-2 border">تعداد {isEdit ? "" : "*"}</th>
                <th className="p-2 border">قیمت واحد {isEdit ? "" : "*"}</th>
                <th className="p-2 border">واحد</th>
                <th className="p-2 border">DV</th>
                <th className="p-2 border">جمع (قابل ویرایش)</th>
                <th className="p-2 border">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.bsaleId ?? `new-${idx}`} className="border-b">
                  <td className="p-2 text-center">{idx + 1}</td>

                  <td className="p-2">
                    <select
                      value={entry.typeId}
                      onChange={(e) =>
                        handleEntryChange(idx, "typeId", e.target.value)
                      }
                      className="w-28 border rounded px-1 py-1 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                      disabled={isEdit}
                      required
                    >
                      <option value="">انتخاب نوع</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                      {entry.typeId &&
                        !types.some((t) => Number(t.id) === Number(entry.typeId)) &&
                        editingData?.[idx]?.category?.type && (
                          <option value={editingData[idx].category.type.id}>
                            {editingData[idx].category.type.name}
                          </option>
                        )}
                    </select>
                  </td>

                  <td className="p-2">
                    <select
                      value={entry.categoryId}
                      onChange={(e) =>
                        handleEntryChange(idx, "categoryId", e.target.value)
                      }
                      className="w-32 border rounded px-1 py-1 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                      disabled={isEdit || !entry.typeId}
                      required
                    >
                      <option value="">انتخاب دسته</option>
                      {categoriesMap[entry.typeId]?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                      {isCurrentCategoryMissing(entry) &&
                        editingData?.[idx]?.category && (
                          <option value={editingData[idx].category.id}>
                            {editingData[idx].category.name}
                          </option>
                        )}
                    </select>
                  </td>

                  <td className="p-2">
                    <select
                      value={entry.bexistId}
                      onChange={(e) =>
                        handleEntryChange(idx, "bexistId", e.target.value)
                      }
                      className="w-40 border rounded px-1 py-1 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                      disabled={isEdit || !entry.categoryId}
                      required
                    >
                      <option value="">انتخاب موجودی</option>
                      {bexistMap[entry.categoryId]?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.id} - موجودی: {item.quantity} - قیمت:{" "}
                          {item.unitPrice}
                        </option>
                      ))}
                      {isCurrentBexistMissing(entry) && (
                        <option value={entry.bexistId}>
                          {editingData?.[idx]?.bExist?.id
                            ? `#${editingData[idx].bExist.id} - موجودی: ${
                                editingData[idx].bExist.quantity ?? "?"
                              } - قیمت: ${
                                editingData[idx].bExist.unitPrice ?? "?"
                              }${
                                Number(editingData[idx].bExist.quantity) === 0
                                  ? " (تمام شده)"
                                  : ""
                              }`
                            : `bExist #${entry.bexistId}`}
                        </option>
                      )}
                    </select>
                  </td>

                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.quantity}
                      onChange={(e) =>
                        handleEntryChange(idx, "quantity", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                      required
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

                  <td className="p-2">
                    {isEdit ? (
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          entry.isAfn
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {symbolFor(entry.isAfn)} {currencyLabel(entry.isAfn)}
                      </span>
                    ) : (
                      <select
                        value={entry.isAfn ? "afn" : "usd"}
                        onChange={(e) =>
                          handleRowCurrencyChange(
                            idx,
                            e.target.value === "afn"
                          )
                        }
                        className="w-20 border rounded px-1 py-1"
                      >
                        <option value="usd">$ دالر</option>
                        <option value="afn">؋ افغانی</option>
                      </select>
                    )}
                  </td>

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

                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.total}
                      onChange={(e) =>
                        handleEntryChange(idx, "total", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {symbolFor(entry.isAfn)}
                    </div>
                  </td>

                  <td className="p-2 text-center">
                    {!isEdit && entries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeEntry(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaMinusCircle />
                      </button>
                    ) : (
                      <span className="text-gray-300">
                        <FaLock />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center">
          {!isEdit && (
            <button
              type="button"
              onClick={addEntry}
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
            >
              <FaPlusCircle /> افزودن ردیف جدید
            </button>
          )}
          <div className="flex gap-3 mr-auto">
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
                  <FaSave />{" "}
                  {isEdit
                    ? `به‌روزرسانی ${entries.length} ردیف`
                    : "ذخیره همه"}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                جمع کل فاکتور
              </label>
              <div className="text-2xl font-bold text-indigo-700">
                {totalAmount.toFixed(2)} {symbolFor(summaryIsAfn)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مبلغ دریافتی (کل)
              </label>
              {isEdit ? (
                <div className="w-full bg-white border rounded-lg px-3 py-2 text-lg text-gray-700">
                  {receiptValue.toFixed(2)} {symbolFor(summaryIsAfn)}
                </div>
              ) : (
                <input
                  type="number"
                  step="any"
                  value={totalReceipt}
                  onChange={(e) => setTotalReceipt(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-lg"
                  placeholder="مبلغ دریافت شده"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                باقیمانده کل
              </label>
              <div className="text-2xl font-bold text-red-600">
                {totalRemaind.toFixed(2)} {symbolFor(summaryIsAfn)}
              </div>
            </div>
          </div>
          {isEdit && (
            <p className="text-xs text-gray-500 mt-3">
              * مبلغ دریافتی و باقیمانده از فاکتور اصلی محاسبه شده‌اند و در
              حالت ویرایش قابل تغییر نیستند.
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default BSaleForm;