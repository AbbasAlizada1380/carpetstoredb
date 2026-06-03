import { Sells, Category, Type, Buyer, Income, BuyerAccount, Receipt, Bill } from "../../Models/index.js";

// ======================= HELPERS =======================

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

// UPDATED: Add bill ID to BuyerAccount and manage has_remaindIds
const addBillToBuyerAccount = async (buyerId, billId, isFullyPaid) => {
  let account = await BuyerAccount.findOne({ where: { buyerId } });
  if (!account) {
    account = await BuyerAccount.create({
      buyerId,
      sellIds: [],          // now stores bill IDs
      remaindIds: [],       // stores unpaid/partial bill IDs
      receiptSaleIds: [],   // stores fully paid bill IDs
      receiptIds: [],       // stores receipt IDs (unchanged)
      has_remaindIds: false,
    });
  }

  let sellIds = account.sellIds || [];
  if (!sellIds.includes(billId)) sellIds.push(billId);

  let receiptSaleIds = account.receiptSaleIds || [];
  let remaindIds = account.remaindIds || [];

  if (isFullyPaid) {
    if (!receiptSaleIds.includes(billId)) receiptSaleIds.push(billId);
    remaindIds = remaindIds.filter(id => id !== billId);
  } else {
    if (!remaindIds.includes(billId)) remaindIds.push(billId);
    receiptSaleIds = receiptSaleIds.filter(id => id !== billId);
  }

  // Set has_remaindIds based on the new remaindIds array
  const hasRemaind = remaindIds.length > 0;

  await account.update({
    sellIds,
    remaindIds,
    receiptSaleIds,
    has_remaindIds: hasRemaind,
  });
  return account;
};

const createReceiptAndLink = async (buyerId, amount, description = "") => {
  if (!amount || amount <= 0) return null;
  const receipt = await Receipt.create({
    buyerId,
    amountofmoney: amount,
    description: description || `رسید برای فروش`,
  });
  let account = await BuyerAccount.findOne({ where: { buyerId } });
  if (!account) {
    account = await BuyerAccount.create({
      buyerId,
      sellIds: [],
      remaindIds: [],
      receiptSaleIds: [],
      receiptIds: [],
      has_remaindIds: false,
    });
  }
  let receiptIds = account.receiptIds || [];
  if (!receiptIds.includes(receipt.id)) {
    receiptIds.push(receipt.id);
    await account.update({ receiptIds });
  }
  return receipt;
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
  try {
    let { sells, buyerId, newBuyer } = req.body;

    if (!sells) {
      if (req.body.categoryId) {
        sells = [req.body];
      } else {
        return res.status(400).json({ message: "No sells array provided" });
      }
    }

    if (!Array.isArray(sells) || sells.length === 0) {
      return res.status(400).json({ message: "Sells must be a non-empty array" });
    }

    if (!buyerId && !newBuyer) {
      return res.status(400).json({ message: "Either buyerId or newBuyer is required at root level" });
    }

    let finalBuyerId;
    try {
      finalBuyerId = await getOrCreateBuyer(buyerId, newBuyer);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const createdSells = [];
    let totalAmountSum = 0;
    let totalReceiptSum = 0;

    for (const sellData of sells) {
      let { categoryId, incomeId, length, area, amount, unit_price, receipt, remaind } = sellData;

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

      const newLength = availableLength - lengthNum;
      const newArea = parseFloat(income.width) * newLength;
      await income.update({ length: newLength, area: newArea });

      const EPSILON = 1e-6;
      if (newLength <= EPSILON) {
        let eIncome = Array.isArray(category.EIncome) ? [...category.EIncome] : [];
        let sIncome = Array.isArray(category.SIncome) ? [...category.SIncome] : [];
        const incomeIdNum = parseInt(incomeId);
        if (eIncome.includes(incomeIdNum)) {
          eIncome = eIncome.filter(id => id !== incomeIdNum);
        }
        if (!sIncome.includes(incomeIdNum)) {
          sIncome.push(incomeIdNum);
        }
        await category.update({ EIncome: eIncome, SIncome: sIncome });
      }

      const receiptAmount = parseFloat(receipt) || 0;
      const finalRemaind = remaind !== undefined ? parseFloat(remaind) : amountNum - receiptAmount;

      const newSell = await Sells.create({
        categoryId,
        incomeId,
        unit_price: unitPriceNum,
        area: areaNum,
        length: lengthNum,
        receipt: receiptAmount,
        remaind: finalRemaind,
        total: amountNum,
        buyerId: finalBuyerId,
      });

      createdSells.push(newSell);
      totalAmountSum += amountNum;
      totalReceiptSum += receiptAmount;

      // Update income's Sells array (still per-sell, not changed)
      let currentSells = income.Sells || [];
      if (!currentSells.includes(newSell.id)) {
        currentSells.push(newSell.id);
        await income.update({ Sells: currentSells });
      }

      await syncSIncomeForType(typeId);
    }

    // Create the Bill
    const billNumber = await generateBillNumber();
    const remainingAmount = totalAmountSum - totalReceiptSum;
    let status = "unpaid";
    if (remainingAmount === 0) status = "paid";
    else if (totalReceiptSum > 0 && remainingAmount > 0) status = "partial";

    const sellIds = createdSells.map(s => s.id);
    const newBill = await Bill.create({
      billNumber,
      buyerId: finalBuyerId,
      date: new Date(),
      totalAmount: totalAmountSum,
      paidAmount: totalReceiptSum,
      remainingAmount,
      status,
      notes: null,
      discount_percent: 0,
      discounted_amount: 0,
      sells: sellIds,
    });

    // Add the BILL to BuyerAccount (instead of individual sells)
    await addBillToBuyerAccount(finalBuyerId, newBill.id, status === 'paid');

    // Create ONE receipt for the total paid amount and capture it
    let createdReceipt = null;
    if (totalReceiptSum > 0) {
      const receiptDescription = `پرداخت برای فاکتور ${billNumber} (جمع کل ${totalAmountSum}؋)`;
      createdReceipt = await createReceiptAndLink(finalBuyerId, totalReceiptSum, receiptDescription);
    }

    // Fetch detailed sells for response
    const createdWithDetails = await Sells.findAll({
      where: { id: sellIds },
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Income, as: "income" },
        { model: Buyer, as: "buyer" },
      ],
    });

    // Return response including the receipt
    res.status(201).json({
      sells: createdWithDetails,
      bill: newBill,
      receipt: createdReceipt,
    });
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