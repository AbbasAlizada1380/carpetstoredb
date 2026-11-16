// components/stock/SellForm.jsx
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
const SELLS_API_URL = `${BASE_URL}/sells`;
const BUYER_API = `${BASE_URL}/buyer/active`;
const TYPE_API = `${BASE_URL}/type`;

// ✅ currency helpers
const CURRENCY_SYMBOL = { afn: "؋", usd: "$" };
const symbolFor = (isAfn) => (isAfn ? CURRENCY_SYMBOL.afn : CURRENCY_SYMBOL.usd);
const currencyLabel = (isAfn) => (isAfn ? "افغانی" : "دالر");

const emptyEntry = (defaults = {}) => ({
  sellId: null, // ✅ internal Sell.id (edit mode only)
  typeId: "",
  categoryId: "",
  incomeId: "",
  incomeWidth: "",
  length: "",
  area: "",
  total: "",
  unit_price: "",
  receipt: 0, // ✅ preserved per-row on edit
  remaind: 0, // ✅ preserved per-row on edit
  isAfn: defaults.isAfn ?? false,
  DV: defaults.DV ?? 65,
});

const SellForm = ({
  onSuccess,
  editingId, // used only to know "are we editing" — the actual PUTs use per-row sellId
  editingIds,
  initialEntries,
  onCancel,
  editingData, // array of Sell rows when editing
  editingMeta,
}) => {
  const isEdit = Boolean(editingId);

  // ✅ global currency (create mode only)
  const [globalIsAfn, setGlobalIsAfn] = useState(false);
  const [globalDV, setGlobalDV] = useState(65);

  const [entries, setEntries] = useState(initialEntries || [emptyEntry()]);
  const [buyers, setBuyers] = useState([]);
  const [buyerMode, setBuyerMode] = useState("existing");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [newBuyerName, setNewBuyerName] = useState("");
  const [types, setTypes] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [incomesMap, setIncomesMap] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const [totalReceipt, setTotalReceipt] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  // ─── Fetch base lists ──────────────────────────────────────────────────
  useEffect(() => {
    fetchBuyers();
    fetchTypes();
  }, []);

  // ✅ Memoize editingMeta so hydrate effect doesn't re-fire every render
  const editingMetaKey = useMemo(
    () =>
      editingMeta
        ? `${editingMeta.buyerId}|${editingMeta.receipt}|${editingMeta.remaind}`
        : "",
    [editingMeta]
  );

  // ✅ Hydrate buyer + receipt (edit mode)
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
  }, [editingMetaKey]);

  // ✅ Preload categories + incomes for ALL rows present in initialEntries
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
        if (!incomesMap[e.categoryId]) {
          fetchIncomesForCategory(e.categoryId, {
            extraIncomeIds: [e.incomeId],
          });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setCategoriesMap((prev) => ({ ...prev, [typeId]: res.data }));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIncomesForCategory = async (categoryId, opts = {}) => {
    if (!categoryId) return;
    if (incomesMap[categoryId] && !opts.force) return;
    try {
      const res = await axios.get(`${BASE_URL}/category/${categoryId}/incomes`);
      let list = Array.isArray(res.data) ? res.data : [];

      // Ensure the currently-attached income is in the list even if sold-out
      const idsInList = new Set(list.map((i) => Number(i.id)));
      const missingIds = (opts.extraIncomeIds || []).filter(
        (id) => id && !idsInList.has(Number(id))
      );
      if (missingIds.length) {
        const extras = await Promise.all(
          missingIds.map((id) =>
            axios
              .get(`${BASE_URL}/income/${id}`)
              .then((r) => r.data)
              .catch(() => null)
          )
        );
        list = [...list, ...extras.filter(Boolean)];
      }

      setIncomesMap((prev) => ({ ...prev, [categoryId]: list }));
    } catch (err) {
      console.error("Error loading incomes for category:", err);
      setIncomesMap((prev) => ({ ...prev, [categoryId]: [] }));
    }
  };

  const calculateEntryValues = (entry) => {
    const length = parseFloat(entry.length) || 0;
    const width = parseFloat(entry.incomeWidth) || 0;
    const area = length * width;
    const unit_price = parseFloat(entry.unit_price) || 0;
    const total = length * unit_price;
    return {
      area: area.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const recalcAll = (newEntries) => {
    const updated = newEntries.map((entry) => {
      const { area, total } = calculateEntryValues(entry);
      return { ...entry, area, total };
    });
    setEntries(updated);
    return updated;
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
      newEntries[index].incomeId = "";
      newEntries[index].incomeWidth = "";
      newEntries[index].length = "";
      newEntries[index].area = "";
      newEntries[index].total = "";
      fetchCategoriesForType(value);
    } else if (field === "categoryId") {
      newEntries[index].incomeId = "";
      newEntries[index].incomeWidth = "";
      newEntries[index].length = "";
      newEntries[index].area = "";
      newEntries[index].total = "";
      fetchIncomesForCategory(value);
    } else if (field === "incomeId") {
      const selectedIncome = incomesMap[newEntries[index].categoryId]?.find(
        (inc) => inc.id === parseInt(value)
      );
      newEntries[index].incomeWidth = selectedIncome ? selectedIncome.width : "";
      newEntries[index].length = "";
      newEntries[index].area = "";
      newEntries[index].total = "";
    } else if (field === "total") {
      const totalVal = parseFloat(value);
      if (!isNaN(totalVal)) {
        const length = parseFloat(newEntries[index].length) || 0;
        if (length > 0) {
          newEntries[index].unit_price = parseFloat((totalVal / length).toFixed(2));
        } else {
          newEntries[index].unit_price = 0;
        }
      }
      setEntries(newEntries);
      return;
    }

    if (["length", "unit_price", "incomeWidth"].includes(field)) {
      const { area, total } = calculateEntryValues(newEntries[index]);
      newEntries[index].area = area;
      newEntries[index].total = total;
    }

    recalcAll(newEntries);
  };

  const addEntry = () => {
    setEntries([...entries, emptyEntry({ isAfn: globalIsAfn, DV: globalDV })]);
  };

  const removeEntry = (index) => {
    if (entries.length === 1) {
      setError("حداقل یک ردیف باید وجود داشته باشد");
      return;
    }
    const newEntries = entries.filter((_, i) => i !== index);
    recalcAll(newEntries);
  };

  const validateEntry = (entry) => {
    if (!entry.typeId) return "نوع باید انتخاب شود";
    if (!entry.categoryId) return "دسته‌بندی باید انتخاب شود";
    if (!entry.incomeId) return "درآمد (Income) باید انتخاب شود";
    if (!entry.length || parseFloat(entry.length) <= 0)
      return "طول باید بزرگتر از صفر باشد";
    if (!entry.unit_price || parseFloat(entry.unit_price) <= 0)
      return "قیمت واحد باید بزرگتر از صفر باشد";
    if (!entry.DV || parseFloat(entry.DV) <= 0)
      return "نرخ دالر باید بزرگتر از صفر باشد";
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
      const err = validateEntry(entries[i]);
      if (err) {
        setError(`ردیف ${i + 1}: ${err}`);
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

    const mainPayload = {};
    if (!isEdit) {
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
    }

    const totalOriginal = originalTotal;
    const totalReceiptToDistribute = receiptValue;

    const baseEntries = entries.map((entry) => ({
      ...entry,
      sellId: entry.sellId || null,
      amount: parseFloat(entry.total) || 0,
      length: parseFloat(entry.length) || 0,
      unit_price: parseFloat(entry.unit_price) || 0,
      area: parseFloat(entry.area) || 0,
      receipt: parseFloat(entry.receipt) || 0,
      remaind: parseFloat(entry.remaind) || 0,
      incomeId: entry.incomeId,
      categoryId: entry.categoryId,
      isAfn: !!entry.isAfn,
      DV: parseFloat(entry.DV) || 65,
    }));

    // ─── EDIT MODE: one PUT per row ───────────────────────────────────
    if (isEdit) {
      if (baseEntries.some((be) => !be.sellId)) {
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
              categoryId: be.categoryId,
              incomeId: be.incomeId,
              length: be.length,
              area: be.area,
              total: be.amount,
              unit_price: be.unit_price,
              receipt: be.receipt,
              remaind: be.remaind,
              // isAfn intentionally omitted — currency is locked on edit
              DV: be.DV,
            };
            return axios.put(`${SELLS_API_URL}/${be.sellId}`, payload);
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
    let shares = baseEntries.map((entry) =>
      totalOriginal === 0 ? 0 : (entry.amount / totalOriginal) * totalReceiptToDistribute
    );
    shares = shares.map((s) => Math.round(s * 100) / 100);
    shares = shares.map((s, idx) => Math.min(s, baseEntries[idx].amount));

    let sumShares = shares.reduce((a, b) => a + b, 0);
    let diff = Math.round((totalReceiptToDistribute - sumShares) * 100) / 100;
    if (Math.abs(diff) > 0.001 && shares.length > 0) {
      const lastIdx = shares.length - 1;
      let newShare = Math.min(shares[lastIdx] + diff, baseEntries[lastIdx].amount);
      newShare = Math.max(newShare, 0);
      shares[lastIdx] = newShare;
    }

    const sellsArray = baseEntries.map((entry, idx) => {
      const receipt = shares[idx];
      const remaind = entry.amount - receipt;
      return {
        categoryId: entry.categoryId,
        incomeId: entry.incomeId,
        length: entry.length,
        area: entry.area,
        amount: entry.amount.toFixed(2),
        unit_price: entry.unit_price,
        receipt: Math.round(receipt * 100) / 100,
        remaind: Math.round(remaind * 100) / 100,
        isAfn: entry.isAfn,
        DV: entry.DV,
      };
    });

    mainPayload.sells = sellsArray;
    mainPayload.discount_amount = parseFloat(discountAmount) || 0;
    mainPayload.isAfn = !!globalIsAfn;
    mainPayload.DV = parseFloat(globalDV) || 65;

    setSubmitLoading(true);
    setError("");
    try {
      await axios.post(SELLS_API_URL, mainPayload);
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
      setError(err.response?.data?.message || "ایجاد ناکام ماند");
      console.error(err);
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── Fallback helpers (edit mode only) ──────────────────────────────
  const isCurrentTypeMissing = (entry) => {
    if (!entry.typeId) return false;
    return !types.some((t) => Number(t.id) === Number(entry.typeId));
  };

  const isCurrentCategoryMissing = (entry) => {
    if (!entry.categoryId) return false;
    const list = categoriesMap[entry.typeId] || [];
    return !list.some((cat) => Number(cat.id) === Number(entry.categoryId));
  };

  const isCurrentIncomeMissing = (entry) => {
    if (!entry.incomeId) return false;
    const list = incomesMap[entry.categoryId] || [];
    return !list.some((inc) => Number(inc.id) === Number(entry.incomeId));
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
            ? `ویرایش فروش (${entries.length} ردیف)`
            : "ثبت فروش جدید (چند ردیف)"}
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
          در حالت ویرایش فقط <strong>طول</strong>، <strong>قیمت واحد</strong>،{" "}
          <strong>مبلغ کل</strong> و <strong>DV</strong> قابل تغییر هستند. سایر
          فیلدها و همچنین افزودن/حذف ردیف غیرفعال است.
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

      {/* Global currency / read-only display */}
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
                <th className="p-2 border">انتخاب قطعه {isEdit ? "" : "*"}</th>
                <th className="p-2 border">عرض (متر)</th>
                <th className="p-2 border">طول (متر) {isEdit ? "" : "*"}</th>
                <th className="p-2 border">مساحت (محاسبه)</th>
                <th className="p-2 border">قیمت واحد {isEdit ? "" : "*"}</th>
                <th className="p-2 border">واحد</th>
                <th className="p-2 border">DV</th>
                <th className="p-2 border">مبلغ کل (قابل ویرایش)</th>
                <th className="p-2 border">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.sellId ?? `new-${idx}`} className="border-b">
                  <td className="p-2 text-center">{idx + 1}</td>

                  {/* Type */}
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
                      {isCurrentTypeMissing(entry) &&
                        editingData?.[idx]?.categoryDetail?.type && (
                          <option value={editingData[idx].categoryDetail.type.id}>
                            {editingData[idx].categoryDetail.type.name}
                          </option>
                        )}
                    </select>
                  </td>

                  {/* Category */}
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
                        editingData?.[idx]?.categoryDetail && (
                          <option value={editingData[idx].categoryDetail.id}>
                            {editingData[idx].categoryDetail.name}
                          </option>
                        )}
                    </select>
                  </td>

                  {/* Income */}
                  <td className="p-2">
                    <select
                      value={entry.incomeId}
                      onChange={(e) =>
                        handleEntryChange(idx, "incomeId", e.target.value)
                      }
                      className="w-40 border rounded px-1 py-1 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                      disabled={isEdit || !entry.categoryId}
                      required
                    >
                      <option value="">انتخاب درآمد</option>
                      {incomesMap[entry.categoryId]?.map((inc) => (
                        <option key={inc.id} value={inc.id}>
                          {inc.lotNumber} - {inc.width}x{inc.length} -{" "}
                          {inc.color}
                        </option>
                      ))}
                      {isCurrentIncomeMissing(entry) &&
                        editingData?.[idx]?.income && (
                          <option value={editingData[idx].income.id}>
                            {editingData[idx].income.lotNumber} -{" "}
                            {editingData[idx].income.width}x
                            {editingData[idx].income.length} -{" "}
                            {editingData[idx].income.color}
                            {parseFloat(editingData[idx].income.length) <= 0
                              ? " (تمام شده)"
                              : ""}
                          </option>
                        )}
                    </select>
                  </td>

                  {/* Income width */}
                  <td className="p-2 text-center text-gray-700">
                    {entry.incomeWidth || "—"}
                  </td>

                  {/* Length */}
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.length}
                      onChange={(e) =>
                        handleEntryChange(idx, "length", e.target.value)
                      }
                      className="w-20 border rounded px-1 py-1"
                      disabled={!entry.incomeId && !isEdit}
                      required
                    />
                  </td>

                  {/* Area */}
                  <td className="p-2 text-gray-700 font-medium">
                    {entry.area || "—"} m²
                  </td>

                  {/* Unit price */}
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.unit_price}
                      onChange={(e) =>
                        handleEntryChange(idx, "unit_price", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                      required
                    />
                  </td>

                  {/* Currency */}
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

                  {/* DV */}
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

                  {/* Total */}
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      value={entry.total}
                      onChange={(e) =>
                        handleEntryChange(idx, "total", e.target.value)
                      }
                      className="w-24 border rounded px-1 py-1"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {symbolFor(entry.isAfn)}
                    </div>
                  </td>

                  {/* Remove / lock */}
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
              className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50"
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

        {/* Financial summary */}
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

export default SellForm;