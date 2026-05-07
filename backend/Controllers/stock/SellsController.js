import { Sells, Category, Type, Buyer, Income, BuyerAccount, Receipt } from "../../Models/index.js";

// Helper: sync SIncome for Type (unchanged)
const syncSIncomeForType = async (typeId) => {
  if (!typeId) return;
  const categories = await Category.findAll({
    where: { typeId },
    attributes: ['id'],
  });
  const categoryIds = categories.map(c => c.id);
  if (categoryIds.length === 0) {
    await Type.update({ SIncome: [] }, { where: { id: typeId } });
    return;
  }
  const sells = await Sells.findAll({
    where: { categoryId: categoryIds },
    attributes: ['id'],
    order: [['id', 'ASC']],
  });
  const sellIds = sells.map(s => s.id);
  await Type.update({ SIncome: sellIds }, { where: { id: typeId } });
};

// Helper: Get or create buyer (unchanged)
const getOrCreateBuyer = async (buyerId, newBuyerName) => {
  if (buyerId) {
    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) throw new Error("Selected buyer does not exist");
    return buyer.id;
  }
  if (newBuyerName && newBuyerName.trim()) {
    const trimmedName = newBuyerName.trim();
    let buyer = await Buyer.findOne({ where: { fullname: trimmedName } });
    if (!buyer) {
      buyer = await Buyer.create({
        fullname: trimmedName,
        isActive: false,
      });
    }
    return buyer.id;
  }
  throw new Error("Either buyerId or newBuyer is required");
};

// ========== NEW HELPER: Add sell to BuyerAccount ==========
const addSellToBuyerAccount = async (buyerId, sellId, receiptAmount = 0) => {
  let account = await BuyerAccount.findOne({ where: { buyerId } });
  if (!account) {
    account = await BuyerAccount.create({
      buyerId,
      sellIds: [],
      remaindIds: [],
      receiptIds: [],
    });
  }
  // Add sell ID if not already present
  if (!account.sellIds.includes(sellId)) {
    const updatedSellIds = [...account.sellIds, sellId];
    await account.update({ sellIds: updatedSellIds });
  }
  return account;
};

// ========== NEW HELPER: Create Receipt and link to BuyerAccount ==========
const createReceiptAndLink = async (buyerId, amount, description = "") => {
  if (!amount || amount <= 0) return null;
  const receipt = await Receipt.create({
    buyerId,
    amountofmoney: amount,
    description: description || `پرداخت برای فروش`,
  });
  // Add receipt ID to buyer account
  let account = await BuyerAccount.findOne({ where: { buyerId } });
  if (!account) {
    account = await BuyerAccount.create({
      buyerId,
      sellIds: [],
      remaindIds: [],
      receiptIds: [],
    });
  }
  if (!account.receiptIds.includes(receipt.id)) {
    const updatedReceiptIds = [...account.receiptIds, receipt.id];
    await account.update({ receiptIds: updatedReceiptIds });
  }
  return receipt;
};


export const createSell = async (req, res) => {
  try {
    let { sells } = req.body;

    if (!Array.isArray(sells)) {
      sells = [req.body];
    }

    if (!sells.length) {
      return res.status(400).json({ message: "No sell records provided" });
    }

    const { buyerId, newBuyer } = sells[0];

    if (!buyerId && !newBuyer) {
      return res.status(400).json({ message: "Either buyerId or newBuyer is required" });
    }

    let finalBuyerId;
    try {
      finalBuyerId = await getOrCreateBuyer(buyerId, newBuyer);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const createdSells = [];

    for (const sellData of sells) {
      let { categoryId, incomeId, length, area, amount, unit_price, receipt, remaind } = sellData;

      // Validation
      if (!categoryId || !incomeId || !length || !unit_price) {
        return res.status(400).json({ message: "Missing required fields: categoryId, incomeId, length, unit_price" });
      }

      const lengthNum = parseFloat(length);
      const unitPriceNum = parseFloat(unit_price);
      const amountNum = parseFloat(amount);
      const areaNum = parseFloat(area) || 0;

      if (isNaN(lengthNum) || lengthNum <= 0) {
        return res.status(400).json({ message: "Length must be a positive number" });
      }
      if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
        return res.status(400).json({ message: "Unit price must be a positive number" });
      }
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Amount (total money) must be a positive number" });
      }

      const expectedAmount = lengthNum * unitPriceNum;
      if (Math.abs(amountNum - expectedAmount) > 0.01) {
        return res.status(400).json({
          message: `Amount mismatch: computed ${expectedAmount}, received ${amountNum}`
        });
      }

      const category = await Category.findByPk(categoryId, { include: [{ model: Type, as: "type" }] });
      if (!category) return res.status(400).json({ message: `Category not found for ID ${categoryId}` });
      const typeId = category.type?.id;
      if (!typeId) return res.status(400).json({ message: `Category ${categoryId} has no associated Type` });

      const income = await Income.findByPk(incomeId);
      if (!income) return res.status(400).json({ message: `Income not found for ID ${incomeId}` });
      if (income.categoryId !== parseInt(categoryId)) {
        return res.status(400).json({ message: `Income ${incomeId} does not belong to category ${categoryId}` });
      }

      const availableLength = parseFloat(income.length);
      if (availableLength < lengthNum) {
        return res.status(400).json({
          message: `Insufficient length! Available: ${availableLength}, Requested: ${lengthNum.toFixed(2)}`
        });
      }

      // Update income: reduce length and recompute area
      const newLength = availableLength - lengthNum;
      const newArea = parseFloat(income.width) * newLength;
      await income.update({ length: newLength, area: newArea });

      receipt = receipt || 0;
      const finalRemaind = remaind !== undefined ? parseFloat(remaind) : amountNum - receipt;

      // Create Sells record
      const newSell = await Sells.create({
        categoryId,
        incomeId,
        unit_price: unitPriceNum,
        area: areaNum,
        length: lengthNum,
        receipt,
        remaind: finalRemaind,
        total: amountNum,
        buyerId: finalBuyerId,
      });

      createdSells.push(newSell);

      // === NEW: Update BuyerAccount and Receipt for this sell ===
      // 1. Add sell ID to BuyerAccount
      await addSellToBuyerAccount(finalBuyerId, newSell.id, receipt);

      // 2. If receipt > 0, create a Receipt record
      if (receipt > 0) {
        const receiptDescription = `پرداخت برای فروش #${newSell.id} (${lengthNum}m × ${unitPriceNum} = ${amountNum}؋)`;
        await createReceiptAndLink(finalBuyerId, receipt, receiptDescription);
      }

      // 3. (Optional) Store remaind ID if you have a Remaind model – here we push to remaindIds array
      //    For simplicity, we'll just record the remaind amount in a separate array (e.g., remaindIds stores remaind record IDs)
      //    Since no Remaind model exists, we can store the remaind value as a JSON object or ignore.
      //    You can extend later.

      await syncSIncomeForType(typeId);
    }

    const createdWithDetails = await Sells.findAll({
      where: { id: createdSells.map(s => s.id) },
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Income, as: "income" },
        { model: Buyer, as: "buyer" },
      ],
    });

    res.status(201).json(createdWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllSells = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch paginated sells
    const { count, rows } = await Sells.findAndCountAll({
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
      ],
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset,
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      data: rows,
      totalItems: count,
      totalPages: totalPages,
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ONE ==========
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

    // Handle buyer change
    let finalBuyerId = sell.buyerId;
    if (buyerId !== undefined || newBuyer !== undefined) {
      try {
        finalBuyerId = await getOrCreateBuyer(buyerId, newBuyer);
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

    // Update other fields
    if (unit_price !== undefined) sell.unit_price = unit_price;
    if (amount !== undefined) sell.amount = amount;
    if (receipt !== undefined) sell.receipt = receipt;
    if (remaind !== undefined) sell.remaind = remaind;

    // Recalculate total if price or amount changed
    if (unit_price !== undefined || amount !== undefined) {
      sell.total = sell.unit_price * sell.amount;
    }

    await sell.save();

    // Sync SIncome for affected types
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

    if (typeId) {
      await syncSIncomeForType(typeId);
    }

    res.status(200).json({ message: "Sell deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};