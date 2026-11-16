import { Sells, Category, Type, Buyer, Income, BuyerAccount, Receipt, Bill, sequelize } from "../../Models/index.js";

// ======================= HELPERS =======================

const syncSIncomeForType = async (typeId, transaction = null) => {
  if (!typeId) return;
  const categories = await Category.findAll({
    where: { typeId },
    attributes: ["id"],
    transaction,
  });
  const categoryIds = categories.map((c) => c.id);
  if (categoryIds.length === 0) {
    await Type.update({ SIncome: [] }, { where: { id: typeId }, transaction });
    return;
  }
  const sells = await Sells.findAll({
    where: { categoryId: categoryIds },
    attributes: ["id"],
    order: [["id", "ASC"]],
    transaction,
  });
  const sellIds = sells.map((s) => s.id);
  await Type.update({ SIncome: sellIds }, { where: { id: typeId }, transaction });
};

// ─── Adjust the source Income when a Sell's length changes ────────────────
// delta = oldLength - newLength
//   positive  → sale got smaller → give length back to income
//   negative  → sale got bigger  → consume more length from income
// Throws if there is not enough available length to grow the sale.
const adjustIncomeForSellDelta = async (
  sell,
  oldLength,
  newLength,
  transaction
) => {
  if (!sell.incomeId) return;
  const delta = parseFloat(oldLength) - parseFloat(newLength);
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) return null;

  const income = await Income.findByPk(sell.incomeId, {
    include: [{ model: Category, as: "category", include: [{ model: Type, as: "type" }] }],
    transaction,
    lock: true,
  });
  if (!income) throw new Error(`Income ${sell.incomeId} not found`);

  const currentLength = parseFloat(income.length) || 0;
  const width = parseFloat(income.width) || 0;

  // If delta is negative (sale got bigger), we must have enough length
  if (delta < 0 && currentLength + delta < -1e-6) {
    throw new Error(
      `Insufficient length on income ${income.id}: available ${currentLength}, requested extra ${-delta}`
    );
  }

  const newIncomeLength = Math.max(currentLength + delta, 0);
  const newIncomeArea = Math.round(width * newIncomeLength * 100) / 100;

  await income.update(
    { length: newIncomeLength, area: newIncomeArea },
    { transaction }
  );

  // Keep the Income.Sells array in sync with depletion state
  const category = income.category;
  if (category) {
    let eIncome = Array.isArray(category.EIncome) ? [...category.EIncome] : [];
    let sIncome = Array.isArray(category.SIncome) ? [...category.SIncome] : [];
    const incomeIdNum = parseInt(income.id, 10);
    const depleted = newIncomeLength <= 1e-6;

    if (depleted) {
      // Move from EIncome → SIncome
      if (eIncome.includes(incomeIdNum)) {
        eIncome = eIncome.filter((id) => id !== incomeIdNum);
      }
      if (!sIncome.includes(incomeIdNum)) sIncome.push(incomeIdNum);
    } else {
      // Move back from SIncome → EIncome (income is no longer fully sold)
      if (sIncome.includes(incomeIdNum)) {
        sIncome = sIncome.filter((id) => id !== incomeIdNum);
      }
      if (!eIncome.includes(incomeIdNum)) eIncome.push(incomeIdNum);
    }

    await category.update(
      { EIncome: eIncome, SIncome: sIncome },
      { transaction }
    );

    const typeId = category.type?.id;
    if (typeId) await syncSIncomeForType(typeId, transaction);
  }

  return income;
};

// ─── Restore the source Income when a Sell is deleted ────────────────────
const restoreIncomeForDeletedSell = async (sell, transaction) => {
  if (!sell.incomeId) return null;

  const restoredLength = parseFloat(sell.length) || 0;
  if (restoredLength <= 0) return null;

  const income = await Income.findByPk(sell.incomeId, {
    include: [{ model: Category, as: "category", include: [{ model: Type, as: "type" }] }],
    transaction,
    lock: true,
  });
  if (!income) return null;

  const currentLength = parseFloat(income.length) || 0;
  const width = parseFloat(income.width) || 0;

  const newIncomeLength = Math.round((currentLength + restoredLength) * 100) / 100;
  const newIncomeArea = Math.round(width * newIncomeLength * 100) / 100;

  await income.update(
    { length: newIncomeLength, area: newIncomeArea },
    { transaction }
  );

  // Remove the sell id from Income.Sells
  const sellIds = Array.isArray(income.Sells) ? [...income.Sells] : [];
  const saleIdNum = parseInt(sell.id, 10);
  const filtered = sellIds.filter((sid) => parseInt(sid, 10) !== saleIdNum);
  if (filtered.length !== sellIds.length) {
    await income.update({ Sells: filtered }, { transaction });
  }

  // Since the income is now partially available again, ensure it sits in EIncome
  const category = income.category;
  if (category) {
    let eIncome = Array.isArray(category.EIncome) ? [...category.EIncome] : [];
    let sIncome = Array.isArray(category.SIncome) ? [...category.SIncome] : [];
    const incomeIdNum = parseInt(income.id, 10);

    if (sIncome.includes(incomeIdNum)) {
      sIncome = sIncome.filter((id) => id !== incomeIdNum);
    }
    if (!eIncome.includes(incomeIdNum)) eIncome.push(incomeIdNum);

    await category.update(
      { EIncome: eIncome, SIncome: sIncome },
      { transaction }
    );

    const typeId = category.type?.id;
    if (typeId) await syncSIncomeForType(typeId, transaction);
  }

  return income;
};
// ─── Sync a single Bill's monetary totals from its linked sells + bsales ──
// This is the source of truth for Bill.totalAmount / paidAmount / remainingAmount / status.
const syncBillTotals = async (billId, transaction = null) => {
  if (!billId) return null;

  const bill = await Bill.findByPk(billId, { transaction });
  if (!bill) return null;

  const sellIds = Array.isArray(bill.sells) ? bill.sells : [];
  const bsaleIds = Array.isArray(bill.bsales) ? bill.bsales : [];

  // Only include rows that still exist (edits shouldn't orphan, but guard anyway)
  const [sells, bsales] = await Promise.all([
    sellIds.length
      ? Sells.findAll({ where: { id: sellIds }, transaction })
      : Promise.resolve([]),
    bsaleIds.length
      ? (async () => {
        // Import BSales lazily to avoid circulars; if you already import it, use it directly
        const { BSales } = await import("../../Models/index.js");
        return BSales.findAll({ where: { id: bsaleIds }, transaction });
      })()
      : Promise.resolve([]),
  ]);

  const sum = (arr, key) =>
    arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);

  const totalAmount = Math.round((sum(sells, "total") + sum(bsales, "total")) * 100) / 100;
  const paidAmount =
    Math.round((sum(sells, "receipt") + sum(bsales, "receipt")) * 100) / 100;
  const remainingAmount = Math.max(
    Math.round((totalAmount - paidAmount) * 100) / 100,
    0
  );

  let status = "unpaid";
  if (remainingAmount <= 0.009) status = "paid";
  else if (paidAmount > 0) status = "partial";

  await bill.update(
    { totalAmount, paidAmount, remainingAmount, status },
    { transaction }
  );

  return bill;
};

// ─── Find the parent Bill(s) that reference a given sell/bsale id ────────
// Uses JSON_CONTAINS (MySQL) — both `sells` and `bsales` are JSON arrays of IDs.
const findBillsForSell = async (sellId, transaction = null) => {
  const [rows] = await sequelize.query(
    `SELECT id FROM Bill
     WHERE JSON_CONTAINS(COALESCE(sells, JSON_ARRAY()), CAST(:sellId AS JSON))
        OR JSON_CONTAINS(COALESCE(bsales, JSON_ARRAY()), CAST(:sellId AS JSON))`,
    { replacements: { sellId }, transaction }
  );
  return rows;
};
const generateBillNumber = async () => {
  const lastBill = await Bill.findOne({
    order: [["id", "DESC"]],
    attributes: ["billNumber"],
  });
  let nextNumber = 1;
  if (lastBill && lastBill.billNumber) {
    const match = lastBill.billNumber.match(/\d+$/);
    if (match) nextNumber = parseInt(match[0]) + 1;
  }
  return `BILL-${nextNumber.toString().padStart(6, "0")}`;
};

// ─── NEW: parse & validate per-sell currency ─────────────────────────────
const parseDvAndIsAfn = (entry, index) => {
  let dv = 0;
  if (entry.DV !== undefined && entry.DV !== null && entry.DV !== "") {
    const parsedDv = parseFloat(entry.DV);
    if (!Number.isFinite(parsedDv)) {
      throw new Error(`Sell ${index + 1}: DV must be a valid number`);
    }
    dv = parsedDv;
  }

  let isAfn = false;
  if (entry.isAfn !== undefined && entry.isAfn !== null && entry.isAfn !== "") {
    if (typeof entry.isAfn === "boolean") isAfn = entry.isAfn;
    else if (entry.isAfn === 1 || entry.isAfn === "1" || entry.isAfn === "true") isAfn = true;
    else if (entry.isAfn === 0 || entry.isAfn === "0" || entry.isAfn === "false") isAfn = false;
    else throw new Error(`Sell ${index + 1}: isAfn must be a boolean`);
  }
  return { dv, isAfn };
};

// ─── NEW: resolve bill-level currency (body override, else first row) ────
const resolveBillCurrency = (body, parsedEntries) => {
  const first = parsedEntries[0] || {};

  let isAfn;
  if (body.isAfn !== undefined && body.isAfn !== null && body.isAfn !== "") {
    if (typeof body.isAfn === "boolean") isAfn = body.isAfn;
    else if (body.isAfn === 1 || body.isAfn === "1" || body.isAfn === "true") isAfn = true;
    else if (body.isAfn === 0 || body.isAfn === "0" || body.isAfn === "false") isAfn = false;
    else throw new Error("Bill-level isAfn must be a boolean");
  } else {
    isAfn = !!first.isAfn;
  }

  let DV;
  if (body.DV !== undefined && body.DV !== null && body.DV !== "") {
    const parsed = parseFloat(body.DV);
    if (!Number.isFinite(parsed)) throw new Error("Bill-level DV must be a valid number");
    DV = parsed;
  } else {
    DV = first.DV !== undefined && first.DV !== null ? parseFloat(first.DV) || 0 : 0;
  }

  return { isAfn, DV };
};

// ======================= MAIN CONTROLLER =======================

export const createSell = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let { sells, buyerId, newBuyer, discount_amount = 0 } = req.body;

    if (!sells) {
      if (req.body.categoryId) sells = [req.body];
      else return res.status(400).json({ message: "No sells array provided" });
    }
    if (!Array.isArray(sells) || sells.length === 0) {
      return res.status(400).json({ message: "Sells must be a non‑empty array" });
    }
    if (!buyerId && !newBuyer) {
      return res.status(400).json({ message: "Either buyerId or newBuyer is required" });
    }

    const discountVal = parseFloat(discount_amount) || 0;

    // ── 1. Buyer ──
    const createBuyer = async (name, transaction) => {
      const trimmed = name?.trim() || "Unknown Buyer";
      let existing = await Buyer.findOne({ where: { fullname: trimmed }, transaction });
      if (existing) return existing;
      return await Buyer.create({ fullname: trimmed, isActive: false }, { transaction });
    };

    let buyer = null;
    if (buyerId) {
      buyer = await Buyer.findByPk(buyerId, { transaction: t });
      if (!buyer) {
        const name = newBuyer && newBuyer.trim() ? newBuyer.trim() : `Buyer-${buyerId}`;
        buyer = await createBuyer(name, t);
      }
    } else if (newBuyer && newBuyer.trim()) {
      buyer = await createBuyer(newBuyer, t);
    } else {
      buyer = await createBuyer("Unknown Buyer", t);
    }
    const finalBuyerId = buyer.id;

    // ── 2. Pre-parse all sells first (need currency for the bill) ──
    const parsedSells = sells.map((sellData, i) => {
      const { incomeId, length, area, amount, unit_price, receipt, remaind } = sellData;

      if (!incomeId || !length || !unit_price) {
        throw new Error(`Sell ${i + 1}: Missing required fields`);
      }

      const lengthNum = parseFloat(length);
      const unitPriceNum = parseFloat(unit_price);
      const amountNum = parseFloat(amount);
      const areaNum = parseFloat(area) || 0;

      if (
        isNaN(lengthNum) || lengthNum <= 0 ||
        isNaN(unitPriceNum) || unitPriceNum <= 0 ||
        isNaN(amountNum) || amountNum <= 0
      ) {
        throw new Error(`Sell ${i + 1}: Invalid numeric values`);
      }

      const expectedAmount = lengthNum * unitPriceNum;
      if (Math.abs(amountNum - expectedAmount) > 0.01) {
        throw new Error(`Sell ${i + 1}: Amount mismatch`);
      }

      // ── NEW: currency per sell ──
      const { dv, isAfn } = parseDvAndIsAfn(sellData, i);

      const receiptAmount = parseFloat(receipt) || 0;
      const finalRemaind =
        remaind !== undefined ? parseFloat(remaind) : amountNum - receiptAmount;

      return {
        incomeId,
        lengthNum,
        areaNum,
        unitPriceNum,
        amountNum,
        receiptAmount,
        finalRemaind,
        DV: dv,
        isAfn,
      };
    });

    // ── NEW: enforce single currency per bill ──
    const currencies = new Set(parsedSells.map((s) => s.isAfn));
    if (currencies.size > 1) {
      await t.rollback();
      return res.status(400).json({
        message:
          "All sells in a single bill must use the same currency (isAfn). Split mixed-currency rows into separate bills.",
      });
    }

    // ── NEW: bill-level currency (body override, else first row) ──
    const billCurrency = resolveBillCurrency(req.body, parsedSells);

    // ── 3. Process each sell ──
    const createdSells = [];
    let totalAmountSum = 0;
    let totalReceiptSum = 0;

    for (const ps of parsedSells) {
      // Fetch income + category
      const income = await Income.findByPk(ps.incomeId, {
        include: [{ model: Category, as: "category" }],
        transaction: t,
      });
      if (!income) throw new Error(`Income ${ps.incomeId} not found`);

      const actualCategoryId = income.categoryId;

      const category = await Category.findByPk(actualCategoryId, {
        include: [{ model: Type, as: "type" }],
        transaction: t,
      });
      if (!category || !category.type) {
        throw new Error(`Category or type not found for income ${ps.incomeId}`);
      }
      const typeId = category.type.id;

      const availableLength = parseFloat(income.length);
      if (availableLength < ps.lengthNum) {
        throw new Error(`Insufficient length for income ${ps.incomeId}`);
      }

      const newLength = availableLength - ps.lengthNum;
      const newArea = parseFloat(income.width) * newLength;
      await income.update({ length: newLength, area: newArea }, { transaction: t });

      if (newLength <= 1e-6) {
        let eIncome = Array.isArray(category.EIncome) ? [...category.EIncome] : [];
        let sIncome = Array.isArray(category.SIncome) ? [...category.SIncome] : [];
        const incomeIdNum = parseInt(ps.incomeId);
        if (eIncome.includes(incomeIdNum)) eIncome = eIncome.filter((id) => id !== incomeIdNum);
        if (!sIncome.includes(incomeIdNum)) sIncome.push(incomeIdNum);
        await category.update({ EIncome: eIncome, SIncome: sIncome }, { transaction: t });
      }

      // ── Create Sell (with DV / isAfn) ──
      const newSell = await Sells.create(
        {
          categoryId: actualCategoryId,
          incomeId: ps.incomeId,
          unit_price: ps.unitPriceNum,
          area: ps.areaNum,
          length: ps.lengthNum,
          receipt: ps.receiptAmount,
          remaind: ps.finalRemaind,
          total: ps.amountNum,
          buyerId: finalBuyerId,
          // NEW
          DV: ps.DV,
          isAfn: ps.isAfn,
        },
        { transaction: t }
      );

      createdSells.push(newSell);
      totalAmountSum += ps.amountNum;
      totalReceiptSum += ps.receiptAmount;

      let currentSells = income.Sells || [];
      if (!currentSells.includes(newSell.id)) {
        currentSells.push(newSell.id);
        await income.update({ Sells: currentSells }, { transaction: t });
      }

      await syncSIncomeForType(typeId, t);
    }

    // ── 4. Discount + receipt validation ──
    if (discountVal > totalAmountSum) {
      await t.rollback();
      return res.status(400).json({ message: "Discount amount cannot exceed total invoice amount" });
    }

    const discountedTotal = totalAmountSum - discountVal;
    if (totalReceiptSum > discountedTotal + 0.01) {
      await t.rollback();
      return res.status(400).json({ message: "Receipt amount exceeds total after discount" });
    }

    // ── 5. Create Bill (with DV / isAfn) ──
    const billNumber = await generateBillNumber();
    const remainingAmount = discountedTotal - totalReceiptSum;
    let status = "unpaid";
    if (remainingAmount === 0) status = "paid";
    else if (totalReceiptSum > 0) status = "partial";

    const sellIds = createdSells.map((s) => s.id);
    const newBill = await Bill.create(
      {
        billNumber,
        buyerId: finalBuyerId,
        date: new Date(),
        totalAmount: totalAmountSum,
        paidAmount: totalReceiptSum,
        remainingAmount,
        status,
        notes: null,
        discount_percent: 0,
        discounted_amount: discountVal,
        sells: sellIds,
        // NEW
        DV: billCurrency.DV,
        isAfn: billCurrency.isAfn,
      },
      { transaction: t }
    );

    // ── 6. BuyerAccount ──
    const buyerCheck = await Buyer.findByPk(finalBuyerId, { transaction: t });
    if (!buyerCheck) {
      await t.rollback();
      return res.status(404).json({ message: "Buyer disappeared unexpectedly" });
    }

    let account = await BuyerAccount.findOne({
      where: { buyerId: finalBuyerId },
      transaction: t,
      lock: true,
    });
    if (!account) {
      account = await BuyerAccount.create(
        {
          buyerId: finalBuyerId,
          sellIds: [],
          remaindIds: [],
          receiptSaleIds: [],
          receiptIds: [],
          has_remaindIds: false,
        },
        { transaction: t }
      );
    }

    let sellIdsArr = account.sellIds || [];
    if (!sellIdsArr.includes(newBill.id)) sellIdsArr.push(newBill.id);

    let receiptSaleIdsArr = account.receiptSaleIds || [];
    let remaindIdsArr = account.remaindIds || [];

    if (status === "paid") {
      if (!receiptSaleIdsArr.includes(newBill.id)) receiptSaleIdsArr.push(newBill.id);
      remaindIdsArr = remaindIdsArr.filter((id) => id !== newBill.id);
    } else {
      if (!remaindIdsArr.includes(newBill.id)) remaindIdsArr.push(newBill.id);
      receiptSaleIdsArr = receiptSaleIdsArr.filter((id) => id !== newBill.id);
    }

    await account.update(
      {
        sellIds: sellIdsArr,
        remaindIds: remaindIdsArr,
        receiptSaleIds: receiptSaleIdsArr,
        has_remaindIds: remaindIdsArr.length > 0,
      },
      { transaction: t }
    );

    // ── 7. Receipt ──
    let createdReceipt = null;
    if (totalReceiptSum > 0) {
      const receipt = await Receipt.create(
        {
          buyerId: finalBuyerId,
          amountofmoney: totalReceiptSum,
          description: `پرداخت برای فاکتور ${billNumber} (جمع کل ${totalAmountSum}؋، تخفیف ${discountVal}؋)`,
        },
        { transaction: t }
      );
      let receiptIdsArr = account.receiptIds || [];
      if (!receiptIdsArr.includes(receipt.id)) {
        receiptIdsArr.push(receipt.id);
        await account.update({ receiptIds: receiptIdsArr }, { transaction: t });
      }
      createdReceipt = receipt;
    }

    // ── 8. Commit + respond ──
    await t.commit();

    const createdWithDetails = await Sells.findAll({
      where: { id: sellIds },
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Income, as: "income" },
        { model: Buyer, as: "buyer" },
      ],
    });

    res.status(201).json({
      sells: createdWithDetails,
      bill: newBill,
      receipt: createdReceipt,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// ========== GET ALL ==========
export const getAllSells = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Sells.findAndCountAll({
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      data: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== GET ONE ==========
export const getSellById = async (req, res) => {
  try {
    const { id } = req.params;
    const sell = await Sells.findByPk(id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
        { model: Income, as: "income" },   // ✅ ADD THIS
      ],
    });
    if (!sell) return res.status(404).json({ message: "Sell not found" });
    res.status(200).json(sell);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== UPDATE ==========
export const updateSell = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      categoryId,
      length,
      area,
      total,
      unit_price,
      receipt,
      remaind,
      buyerId,
      newBuyer,
      DV,
      isAfn,
      incomeId,
    } = req.body;

    const sell = await Sells.findByPk(id, { transaction: t });
    if (!sell) {
      await t.rollback();
      return res.status(404).json({ message: "Sell not found" });
    }

    // ✅ CAPTURE ORIGINAL LENGTH BEFORE ANY MUTATION
    const originalLength = parseFloat(sell.length) || 0;

    // ── incomeId: reject changes ──
    if (incomeId !== undefined && parseInt(incomeId) !== parseInt(sell.incomeId)) {
      await t.rollback();
      return res.status(400).json({
        message: "Changing incomeId is not allowed. Delete this sale and create a new one instead.",
      });
    }

    // ── Buyer: only allowed if the sell is NOT yet on a bill ──
    const parentBills = await findBillsForSell(sell.id, t);
    const isOnBill = parentBills.length > 0;

    if ((buyerId !== undefined || newBuyer !== undefined) && isOnBill) {
      await t.rollback();
      return res.status(400).json({
        message:
          "Cannot change the buyer of a sale that is already attached to a bill. Delete the bill first.",
      });
    }

    if (buyerId !== undefined || newBuyer !== undefined) {
      try {
        if (buyerId) {
          const buyer = await Buyer.findByPk(buyerId, { transaction: t });
          if (!buyer) throw new Error("Selected buyer does not exist");
          sell.buyerId = buyer.id;
        } else if (newBuyer && newBuyer.trim()) {
          const trimmed = newBuyer.trim();
          let buyer = await Buyer.findOne({ where: { fullname: trimmed }, transaction: t });
          if (!buyer) {
            buyer = await Buyer.create(
              { fullname: trimmed, isActive: false },
              { transaction: t }
            );
          }
          sell.buyerId = buyer.id;
        }
      } catch (err) {
        await t.rollback();
        return res.status(400).json({ message: err.message });
      }
    }

    // ── Currency consistency ──
    if (isAfn !== undefined && isOnBill) {
      let nextIsAfn;
      if (typeof isAfn === "boolean") nextIsAfn = isAfn;
      else if (isAfn === 1 || isAfn === "1" || isAfn === "true") nextIsAfn = true;
      else if (isAfn === 0 || isAfn === "0" || isAfn === "false") nextIsAfn = false;
      else {
        await t.rollback();
        return res.status(400).json({ error: "isAfn must be a boolean" });
      }
      const billRow = await Bill.findByPk(parentBills[0].id, { transaction: t });
      if (billRow && !!billRow.isAfn !== nextIsAfn) {
        await t.rollback();
        return res.status(400).json({
          message:
            "Cannot change the currency of a sale attached to a bill with a different currency. " +
            "Delete the bill and recreate it with the new currency.",
        });
      }
    }

    // ── Category change (+ type resync) ──
    const oldCategory = await Category.findByPk(sell.categoryId, {
      include: [{ model: Type, as: "type" }],
      transaction: t,
    });
    const oldTypeId = oldCategory?.type?.id;

    let newTypeId = null;
    if (categoryId !== undefined && parseInt(categoryId) !== parseInt(sell.categoryId)) {
      const newCategory = await Category.findByPk(categoryId, {
        include: [{ model: Type, as: "type" }],
        transaction: t,
      });
      if (!newCategory) {
        await t.rollback();
        return res.status(400).json({ message: "New Category not found" });
      }
      newTypeId = newCategory.type?.id;
      if (!newTypeId) {
        await t.rollback();
        return res.status(400).json({ message: "New Category has no associated Type" });
      }
      sell.categoryId = categoryId;
    }

    // ── Numeric fields ──
    let touchedLength = false;
    let touchedUnitPrice = false;
    let touchedReceipt = false;
    let touchedTotal = false;

    if (length !== undefined) {
      const len = parseFloat(length);
      if (!Number.isFinite(len) || len <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "length must be a positive number" });
      }
      sell.length = len;
      touchedLength = true;
    }

    if (unit_price !== undefined) {
      const up = parseFloat(unit_price);
      if (!Number.isFinite(up) || up <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "unit_price must be a positive number" });
      }
      sell.unit_price = up;
      touchedUnitPrice = true;
    }

    if (receipt !== undefined) {
      const rc = parseFloat(receipt) || 0;
      if (rc < 0) {
        await t.rollback();
        return res.status(400).json({ message: "receipt cannot be negative" });
      }
      sell.receipt = rc;
      touchedReceipt = true;
    }

    if (total !== undefined) {
      const tVal = parseFloat(total);
      if (!Number.isFinite(tVal) || tVal <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "total must be a positive number" });
      }
      sell.total = tVal;
      touchedTotal = true;
    } else if (touchedLength || touchedUnitPrice) {
      sell.total = Math.round(sell.length * sell.unit_price * 100) / 100;
      touchedTotal = true;
    }

    if (area !== undefined) {
      const a = parseFloat(area) || 0;
      if (a < 0) {
        await t.rollback();
        return res.status(400).json({ message: "area cannot be negative" });
      }
      sell.area = a;
    } else if (touchedLength) {
      const incomeRow = await Income.findByPk(sell.incomeId, { transaction: t });
      const width = parseFloat(incomeRow?.width) || 0;
      if (width > 0) {
        sell.area = Math.round(sell.length * width * 100) / 100;
      }
    }

    if (remaind !== undefined) {
      const r = parseFloat(remaind) || 0;
      if (r < 0) {
        await t.rollback();
        return res.status(400).json({ message: "remaind cannot be negative" });
      }
      sell.remaind = r;
    } else if (touchedTotal || touchedReceipt) {
      sell.remaind = Math.max(
        Math.round((parseFloat(sell.total) - parseFloat(sell.receipt)) * 100) / 100,
        0
      );
    }

    // ── Currency ──
    if (DV !== undefined) {
      if (DV === null || DV === "") sell.DV = 0;
      else {
        const parsed = parseFloat(DV);
        if (!Number.isFinite(parsed)) {
          await t.rollback();
          return res.status(400).json({ error: "DV must be a valid number" });
        }
        sell.DV = parsed;
      }
    }
    if (isAfn !== undefined) {
      if (typeof isAfn === "boolean") sell.isAfn = isAfn;
      else if (isAfn === 1 || isAfn === "1" || isAfn === "true") sell.isAfn = true;
      else if (isAfn === 0 || isAfn === "0" || isAfn === "false") sell.isAfn = false;
      else {
        await t.rollback();
        return res.status(400).json({ error: "isAfn must be a boolean" });
      }
    }

    await sell.save({ transaction: t });

    // ✅ Adjust the source Income when length changed
    // Use `originalLength` captured BEFORE mutation — NOT sell._previousDataValues
    if (touchedLength) {
      const newLength = parseFloat(sell.length) || 0;
      await adjustIncomeForSellDelta(sell, originalLength, newLength, t);
    }

    // ── Type resync if category changed ──
    if (newTypeId !== null && newTypeId !== oldTypeId) {
      if (oldTypeId) await syncSIncomeForType(oldTypeId, t);
      if (newTypeId) await syncSIncomeForType(newTypeId, t);
    }

    // ✅ Resync every parent bill
    for (const { id: billId } of parentBills) {
      await syncBillTotals(billId, t);
    }

    await t.commit();

    const updated = await Sells.findByPk(id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
        { model: Income, as: "income" },
      ],
    });
    res.status(200).json(updated);
  } catch (error) {
    if (!t.finished) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

// ========== DELETE ==========
export const deleteSell = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const sell = await Sells.findByPk(id, { transaction: t });
    if (!sell) {
      await t.rollback();
      return res.status(404).json({ message: "Sell not found" });
    }

    const category = await Category.findByPk(sell.categoryId, {
      include: [{ model: Type, as: "type" }],
      transaction: t,
    });
    const typeId = category?.type?.id;

    const parentBills = await findBillsForSell(sell.id, t);

    // ✅ Restore the source Income before destroying the Sell
    await restoreIncomeForDeletedSell(sell, t);

    await sell.destroy({ transaction: t });

    if (typeId) await syncSIncomeForType(typeId, t);

    for (const { id: billId } of parentBills) {
      await syncBillTotals(billId, t);
    }

    await t.commit();
    res.status(200).json({ message: "Sell deleted successfully" });
  } catch (error) {
    if (!t.finished) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

// controllers/stock/sellsController.js

// ========== GET SELLS BY BILL ID ==========
// GET /sells/by-bill/:billId
// Returns all Sells rows referenced in Bill.sells (in the same order)
// with full includes. Returns 404 if the bill doesn't exist.
export const getSellsByBillId = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Bill.findByPk(billId, {
      attributes: ["id", "billNumber", "sells", "bsales"],
    });
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const sellIds = Array.isArray(bill.sells) ? bill.sells : [];
    if (sellIds.length === 0) {
      return res.status(200).json({
        billId: bill.id,
        billNumber: bill.billNumber,
        total: 0,
        data: [],
      });
    }

    const sells = await Sells.findAll({
      where: { id: sellIds },
      include: [
        {
          model: Category,
          as: "categoryDetail",
          include: [{ model: Type, as: "type" }],
        },
        { model: Income, as: "income" },
        { model: Buyer, as: "buyer" },
      ],
    });

    // Preserve the order in which the IDs appear in bill.sells
    const map = new Map(sells.map((s) => [s.id, s]));
    const ordered = sellIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((s) => s.toJSON());

    res.status(200).json({
      billId: bill.id,
      billNumber: bill.billNumber,
      total: ordered.length,
      data: ordered,
    });
  } catch (error) {
    console.error("Error in getSellsByBillId:", error);
    res.status(500).json({ error: error.message });
  }
};