import { Sells, Category, Type, Buyer, Income, BuyerAccount, Receipt, Bill, sequelize } from "../../Models/index.js";

// ======================= HELPERS =======================

// Updated to accept transaction
const syncSIncomeForType = async (typeId, transaction = null) => {
  if (!typeId) return;
  const categories = await Category.findAll({
    where: { typeId },
    attributes: ['id'],
    transaction,
  });
  const categoryIds = categories.map(c => c.id);
  if (categoryIds.length === 0) {
    await Type.update({ SIncome: [] }, { where: { id: typeId }, transaction });
    return;
  }
  const sells = await Sells.findAll({
    where: { categoryId: categoryIds },
    attributes: ['id'],
    order: [['id', 'ASC']],
    transaction,
  });
  const sellIds = sells.map(s => s.id);
  await Type.update({ SIncome: sellIds }, { where: { id: typeId }, transaction });
};

const generateBillNumber = async () => {
  const lastBill = await Bill.findOne({
    order: [['id', 'DESC']],
    attributes: ['billNumber'],
  });
  let nextNumber = 1;
  if (lastBill && lastBill.billNumber) {
    const match = lastBill.billNumber.match(/\d+$/);
    if (match) nextNumber = parseInt(match[0]) + 1;
  }
  return `BILL-${nextNumber.toString().padStart(6, '0')}`;
};

// ======================= MAIN CONTROLLER =======================

export const createSell = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let { sells, buyerId, newBuyer, discount_amount = 0 } = req.body;

    // --- Input validation ---
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

    // Parse discount as number, default 0
    const discountVal = parseFloat(discount_amount) || 0;

    // --- 1. Get or create buyer (within transaction) ---
    let buyer = null;

    const createBuyer = async (name, transaction) => {
      const trimmed = name?.trim() || 'Unknown Buyer';
      let existing = await Buyer.findOne({ where: { fullname: trimmed }, transaction });
      if (existing) return existing;
      return await Buyer.create(
        { fullname: trimmed, isActive: false },
        { transaction }
      );
    };

    if (buyerId) {
      buyer = await Buyer.findByPk(buyerId, { transaction: t });
      if (!buyer) {
        const name = newBuyer && newBuyer.trim() ? newBuyer.trim() : `Buyer-${buyerId}`;
        buyer = await createBuyer(name, t);
      }
    } else if (newBuyer && newBuyer.trim()) {
      buyer = await createBuyer(newBuyer, t);
    } else {
      buyer = await createBuyer('Unknown Buyer', t);
    }

    const finalBuyerId = buyer.id;
    // --- 2. Process each sell ---
    const createdSells = [];
    let totalAmountSum = 0;
    let totalReceiptSum = 0;

    for (const sellData of sells) {
      let { incomeId, length, area, amount, unit_price, receipt, remaind } = sellData;

      // Validations
      if (!incomeId || !length || !unit_price) {
        await t.rollback();
        return res.status(400).json({ message: "Missing required fields" });
      }

      const lengthNum = parseFloat(length);
      const unitPriceNum = parseFloat(unit_price);
      const amountNum = parseFloat(amount);
      const areaNum = parseFloat(area) || 0;

      if (isNaN(lengthNum) || lengthNum <= 0 || isNaN(unitPriceNum) || unitPriceNum <= 0 || isNaN(amountNum) || amountNum <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid numeric values" });
      }

      const expectedAmount = lengthNum * unitPriceNum;
      if (Math.abs(amountNum - expectedAmount) > 0.01) {
        await t.rollback();
        return res.status(400).json({ message: `Amount mismatch` });
      }

      // ── Fetch Income (and its category) ──
      const income = await Income.findByPk(incomeId, {
        include: [{ model: Category, as: "category" }],
        transaction: t,
      });

      if (!income) {
        await t.rollback();
        return res.status(400).json({ message: "Income not found" });
      }

      // Use income's categoryId – ignore the one from request
      const actualCategoryId = income.categoryId;

      // Get category and type for sync
      const category = await Category.findByPk(actualCategoryId, {
        include: [{ model: Type, as: "type" }],
        transaction: t,
      });
      if (!category || !category.type) {
        await t.rollback();
        return res.status(400).json({ message: "Category or type not found" });
      }
      const typeId = category.type.id;

      // Check available length
      const availableLength = parseFloat(income.length);
      if (availableLength < lengthNum) {
        await t.rollback();
        return res.status(400).json({ message: "Insufficient length" });
      }

      // Update income (reduce length)
      const newLength = availableLength - lengthNum;
      const newArea = parseFloat(income.width) * newLength;
      await income.update({ length: newLength, area: newArea }, { transaction: t });

      // Move income to SIncome if exhausted
      if (newLength <= 1e-6) {
        let eIncome = Array.isArray(category.EIncome) ? [...category.EIncome] : [];
        let sIncome = Array.isArray(category.SIncome) ? [...category.SIncome] : [];
        const incomeIdNum = parseInt(incomeId);
        if (eIncome.includes(incomeIdNum)) {
          eIncome = eIncome.filter(id => id !== incomeIdNum);
        }
        if (!sIncome.includes(incomeIdNum)) {
          sIncome.push(incomeIdNum);
        }
        await category.update({ EIncome: eIncome, SIncome: sIncome }, { transaction: t });
      }

      const receiptAmount = parseFloat(receipt) || 0;
      const finalRemaind = remaind !== undefined ? parseFloat(remaind) : amountNum - receiptAmount;

      // ── Create Sell record using income's categoryId ──
      const newSell = await Sells.create(
        {
          categoryId: actualCategoryId,      // ✅ use income's category
          incomeId,
          unit_price: unitPriceNum,
          area: areaNum,
          length: lengthNum,
          receipt: receiptAmount,
          remaind: finalRemaind,
          total: amountNum,
          buyerId: finalBuyerId,
        },
        { transaction: t }
      );

      createdSells.push(newSell);
      totalAmountSum += amountNum;
      totalReceiptSum += receiptAmount;

      // Update income's Sells array
      let currentSells = income.Sells || [];
      if (!currentSells.includes(newSell.id)) {
        currentSells.push(newSell.id);
        await income.update({ Sells: currentSells }, { transaction: t });
      }

      // Update type's SIncome (aggregate)
      await syncSIncomeForType(typeId, t);
    }

    // --- 3. Apply discount and validate receipt ---
    if (discountVal > totalAmountSum) {
      await t.rollback();
      return res.status(400).json({ message: "Discount amount cannot exceed total invoice amount" });
    }

    const discountedTotal = totalAmountSum - discountVal;
    if (totalReceiptSum > discountedTotal + 0.01) {
      await t.rollback();
      return res.status(400).json({ message: "Receipt amount exceeds total after discount" });
    }

    // --- 4. Create Bill ---
    const billNumber = await generateBillNumber();
    const remainingAmount = discountedTotal - totalReceiptSum;
    let status = "unpaid";
    if (remainingAmount === 0) status = "paid";
    else if (totalReceiptSum > 0) status = "partial";

    const sellIds = createdSells.map(s => s.id);
    const newBill = await Bill.create(
      {
        billNumber,
        buyerId: finalBuyerId,
        date: new Date(),
        totalAmount: totalAmountSum,               // original total before discount
        paidAmount: totalReceiptSum,
        remainingAmount: remainingAmount,
        status,
        notes: null,
        discount_percent: 0,                       // we only handle fixed amount for now
        discounted_amount: discountVal,            // store the discount
        sells: sellIds,
      },
      { transaction: t }
    );

    // --- 5. Update BuyerAccount (same as before) ---
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

    if (status === 'paid') {
      if (!receiptSaleIdsArr.includes(newBill.id)) receiptSaleIdsArr.push(newBill.id);
      remaindIdsArr = remaindIdsArr.filter(id => id !== newBill.id);
    } else {
      if (!remaindIdsArr.includes(newBill.id)) remaindIdsArr.push(newBill.id);
      receiptSaleIdsArr = receiptSaleIdsArr.filter(id => id !== newBill.id);
    }

    const hasRemaind = remaindIdsArr.length > 0;
    await account.update(
      {
        sellIds: sellIdsArr,
        remaindIds: remaindIdsArr,
        receiptSaleIds: receiptSaleIdsArr,
        has_remaindIds: hasRemaind,
      },
      { transaction: t }
    );

    // --- 6. Create receipt (if any payment) ---
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

    // --- 7. Commit ---
    await t.commit();

    // --- 8. Fetch detailed response ---
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
    const { Category: newCategoryId, unit_price, amount, receipt, remaind, buyerId, newBuyer } = req.body;

    const sell = await Sells.findByPk(id);
    if (!sell) return res.status(404).json({ message: "Sell not found" });

    let finalBuyerId = sell.buyerId;
    if (buyerId !== undefined || newBuyer !== undefined) {
      try {
        // Reuse the same logic (but without transaction for simplicity)
        if (buyerId) {
          const buyer = await Buyer.findByPk(buyerId);
          if (!buyer) throw new Error("Selected buyer does not exist");
          finalBuyerId = buyer.id;
        } else if (newBuyer && newBuyer.trim()) {
          const trimmed = newBuyer.trim();
          let buyer = await Buyer.findOne({ where: { fullname: trimmed } });
          if (!buyer) {
            buyer = await Buyer.create({ fullname: trimmed, isActive: false });
          }
          finalBuyerId = buyer.id;
        }
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      sell.buyerId = finalBuyerId;
    }

    const oldCategory = await Category.findByPk(sell.Category, { include: [{ model: Type, as: "type" }] });
    const oldTypeId = oldCategory?.type?.id;

    let newTypeId = null;
    if (newCategoryId !== undefined && newCategoryId !== sell.Category) {
      const newCategory = await Category.findByPk(newCategoryId, { include: [{ model: Type, as: "type" }] });
      if (!newCategory) return res.status(400).json({ message: "New Category not found" });
      newTypeId = newCategory.type?.id;
      if (!newTypeId) return res.status(400).json({ message: "New Category has no associated Type" });
      sell.Category = newCategoryId;
    }

    if (unit_price !== undefined) sell.unit_price = unit_price;
    if (amount !== undefined) sell.amount = amount;
    if (receipt !== undefined) sell.receipt = receipt;
    if (remaind !== undefined) sell.remaind = remaind;
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

    const category = await Category.findByPk(sell.Category, { include: [{ model: Type, as: "type" }] });
    const typeId = category?.type?.id;

    await sell.destroy();
    if (typeId) await syncSIncomeForType(typeId);

    res.status(200).json({ message: "Sell deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};