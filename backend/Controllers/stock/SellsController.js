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
  try {
    const { id } = req.params;
    // 🔧 was reading `Category` (wrong key) — use categoryId
    const { categoryId, unit_price, amount, receipt, remaind, buyerId, newBuyer, DV, isAfn } = req.body;

    const sell = await Sells.findByPk(id);
    if (!sell) return res.status(404).json({ message: "Sell not found" });

    let finalBuyerId = sell.buyerId;
    if (buyerId !== undefined || newBuyer !== undefined) {
      try {
        if (buyerId) {
          const buyer = await Buyer.findByPk(buyerId);
          if (!buyer) throw new Error("Selected buyer does not exist");
          finalBuyerId = buyer.id;
        } else if (newBuyer && newBuyer.trim()) {
          const trimmed = newBuyer.trim();
          let buyer = await Buyer.findOne({ where: { fullname: trimmed } });
          if (!buyer) buyer = await Buyer.create({ fullname: trimmed, isActive: false });
          finalBuyerId = buyer.id;
        }
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      sell.buyerId = finalBuyerId;
    }

    const oldCategory = await Category.findByPk(sell.categoryId, { include: [{ model: Type, as: "type" }] });
    const oldTypeId = oldCategory?.type?.id;

    let newTypeId = null;
    if (categoryId !== undefined && categoryId !== sell.categoryId) {
      const newCategory = await Category.findByPk(categoryId, { include: [{ model: Type, as: "type" }] });
      if (!newCategory) return res.status(400).json({ message: "New Category not found" });
      newTypeId = newCategory.type?.id;
      if (!newTypeId) return res.status(400).json({ message: "New Category has no associated Type" });
      sell.categoryId = categoryId;
    }

    if (unit_price !== undefined) sell.unit_price = unit_price;
    if (amount !== undefined) sell.amount = amount;
    if (receipt !== undefined) sell.receipt = receipt;
    if (remaind !== undefined) sell.remaind = remaind;

    // ── NEW: currency fields ──
    if (DV !== undefined) {
      if (DV === null || DV === "") sell.DV = 0;
      else {
        const parsed = parseFloat(DV);
        if (!Number.isFinite(parsed)) return res.status(400).json({ error: "DV must be a valid number" });
        sell.DV = parsed;
      }
    }
    if (isAfn !== undefined) {
      if (typeof isAfn === "boolean") sell.isAfn = isAfn;
      else if (isAfn === 1 || isAfn === "1" || isAfn === "true") sell.isAfn = true;
      else if (isAfn === 0 || isAfn === "0" || isAfn === "false") sell.isAfn = false;
      else return res.status(400).json({ error: "isAfn must be a boolean" });
    }

    if (unit_price !== undefined || amount !== undefined) {
      sell.total = sell.unit_price * sell.amount;
    }

    await sell.save();

    if (newTypeId !== null && newTypeId !== oldTypeId) {
      if (oldTypeId) await syncSIncomeForType(oldTypeId);
      if (newTypeId) await syncSIncomeForType(newTypeId);
    }

    const updated = await Sells.findByPk(id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
      ],
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== DELETE ==========
export const deleteSell = async (req, res) => {
  try {
    const { id } = req.params;
    const sell = await Sells.findByPk(id);
    if (!sell) return res.status(404).json({ message: "Sell not found" });

    // 🔧 was using sell.Category — use sell.categoryId
    const category = await Category.findByPk(sell.categoryId, { include: [{ model: Type, as: "type" }] });
    const typeId = category?.type?.id;

    await sell.destroy();
    if (typeId) await syncSIncomeForType(typeId);

    res.status(200).json({ message: "Sell deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};