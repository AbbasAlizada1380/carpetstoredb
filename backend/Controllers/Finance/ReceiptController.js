import { Op } from "sequelize";
import { sequelize } from "../../Models/index.js";
import { Buyer, BuyerAccount, Receipt, Bill } from "../../Models/index.js";

const validateAmount = (amount) => {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Amount must be a positive number");
};

// Helper: add receipt ID to BuyerAccount.receiptIds
const addReceiptToBuyerAccount = async (buyerId, receiptId, transaction) => {
  let account = await BuyerAccount.findOne({ where: { buyerId }, transaction });
  if (!account) {
    account = await BuyerAccount.create({
      buyerId,
      sellIds: [],
      remaindIds: [],
      receiptSaleIds: [],
      receiptIds: [],
      has_remaindIds: false,
    }, { transaction });
  }
  let receiptIds = Array.isArray(account.receiptIds) ? account.receiptIds : [];
  if (!receiptIds.includes(receiptId)) {
    receiptIds.push(receiptId);
    await account.update({ receiptIds }, { transaction });
  }
  return account;
};

// Helper: sync BuyerAccount remaindIds and receiptSaleIds based on current bill statuses
const syncBuyerAccountBills = async (buyerId, transaction) => {
  // Get all bills for this buyer
  const allBills = await Bill.findAll({
    where: { buyerId },
    attributes: ['id', 'remainingAmount'],
    transaction,
  });
  
  const remaindIds = [];
  const receiptSaleIds = [];
  for (const bill of allBills) {
    const remaining = parseFloat(bill.remainingAmount);
    if (remaining > 0) {
      remaindIds.push(bill.id);
    } else {
      receiptSaleIds.push(bill.id);
    }
  }
  
  const has_remaindIds = remaindIds.length > 0;
  
  await BuyerAccount.update(
    {
      remaindIds,
      receiptSaleIds,
      has_remaindIds,
    },
    { where: { buyerId }, transaction }
  );
};

// CREATE a new receipt (payment from buyer)
export const createReceipt = async (req, res) => {
  try {
    const { buyerId, amountofmoney, description } = req.body;

    if (!buyerId) return res.status(400).json({ message: "buyerId is required" });
    try { validateAmount(amountofmoney); } catch (err) { return res.status(400).json({ message: err.message }); }

    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) return res.status(404).json({ message: "Buyer not found" });

    const paymentAmount = parseFloat(amountofmoney);
    const unpaidBills = await Bill.findAll({
      where: { buyerId, remainingAmount: { [Op.gt]: 0 } },
      order: [["createdAt", "ASC"]],
    });

    const totalUnpaid = unpaidBills.reduce((sum, b) => sum + parseFloat(b.remainingAmount), 0);
    if (paymentAmount > totalUnpaid + 0.01) {
      return res.status(400).json({ message: "Payment exceeds total unpaid amount" });
    }

    const transaction = await sequelize.transaction();

    try {
      const receipt = await Receipt.create({
        buyerId,
        amountofmoney: paymentAmount,
        description: description?.trim() || null,
      }, { transaction });

      let remainingPayment = paymentAmount;
      const fullyPaidBillIds = [];

      for (const bill of unpaidBills) {
        if (remainingPayment <= 0) break;
        const currentRemaining = parseFloat(bill.remainingAmount);
        const amountToPay = Math.min(remainingPayment, currentRemaining);
        const newPaidAmount = parseFloat(bill.paidAmount) + amountToPay;
        const newRemaining = currentRemaining - amountToPay;
        let newStatus = bill.status;
        if (newRemaining === 0) {
          newStatus = "paid";
          fullyPaidBillIds.push(bill.id);
        } else if (newPaidAmount > 0 && newRemaining > 0) newStatus = "partial";

        await bill.update({
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          status: newStatus,
        }, { transaction });
        remainingPayment -= amountToPay;
      }

      // Add receipt ID to BuyerAccount.receiptIds
      await addReceiptToBuyerAccount(buyerId, receipt.id, transaction);
      
      // Sync remaindIds and receiptSaleIds based on updated bill statuses
      await syncBuyerAccountBills(buyerId, transaction);

      await transaction.commit();

      res.status(201).json({
        message: "Receipt created successfully",
        receipt,
        updatedBills: { fullyPaid: fullyPaidBillIds },
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating receipt", error: error.message });
  }
};
// GET all receipts (with pagination)
export const getAllReceipts = async (req, res) => {
  try {
    const { buyerId, page = 1, limit = 20 } = req.query;
    const where = buyerId ? { buyerId } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: receipts } = await Receipt.findAndCountAll({
      where,
      include: [{ model: Buyer, as: "buyer" }],
      order: [["createdAt", "DESC"]],
      offset,
      limit: parseInt(limit),
    });

    res.json({
      data: receipts,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching receipts", error: error.message });
  }
};



// UPDATE a receipt (e.g., amount, description)
export const updateReceipt = async (req, res) => {
  const { id } = req.params;
  const { amountofmoney, description } = req.body;

  try {
    const receipt = await Receipt.findByPk(id);
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });

    if (amountofmoney !== undefined) {
      try { validateAmount(amountofmoney); } catch (err) { return res.status(400).json({ message: err.message }); }
    }

    // Important: changing payment amount would require redistributing across bills.
    // For simplicity, we only allow updating description here.
    // If amount needs to change, delete and recreate.
    if (amountofmoney !== undefined && parseFloat(amountofmoney) !== parseFloat(receipt.amountofmoney)) {
      return res.status(400).json({ message: "Updating amount is not allowed. Delete and create new receipt instead." });
    }

    await receipt.update({ description: description?.trim() || null });
    res.json({ message: "Receipt updated", receipt });
  } catch (error) {
    res.status(500).json({ message: "Error updating receipt", error: error.message });
  }
};

// DELETE a receipt (reverse payment from bills)
export const deleteReceipt = async (req, res) => {
  const { id } = req.params;

  const transaction = await sequelize.transaction();
  try {
    const receipt = await Receipt.findByPk(id);
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });

    const { buyerId, amountofmoney } = receipt;
    const bills = await Bill.findAll({
      where: { buyerId },
      order: [["createdAt", "DESC"]], // reverse order: apply refund to latest paid bills first
      transaction,
    });

    let remainingRefund = parseFloat(amountofmoney);
    for (const bill of bills) {
      if (remainingRefund <= 0) break;
      const currentPaid = parseFloat(bill.paidAmount);
      if (currentPaid === 0) continue;
      const amountToRefund = Math.min(remainingRefund, currentPaid);
      const newPaidAmount = currentPaid - amountToRefund;
      const newRemaining = parseFloat(bill.remainingAmount) + amountToRefund;
      let newStatus = bill.status;
      if (newRemaining > 0 && newPaidAmount === 0) newStatus = "unpaid";
      else if (newPaidAmount > 0 && newRemaining > 0) newStatus = "partial";

      await bill.update({
        paidAmount: newPaidAmount,
        remainingAmount: newRemaining,
        status: newStatus,
      }, { transaction });
      remainingRefund -= amountToRefund;
    }

    await receipt.destroy({ transaction });
    await syncBuyerAccountBills(buyerId, transaction);
    await transaction.commit();

    res.json({ message: "Receipt deleted and payments reversed" });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Error deleting receipt", error: error.message });
  }
};

export const getReceiptsByBuyer = async (req, res) => {
  const { buyerId } = req.params;
  try {
    const receipts = await Receipt.findAll({
      where: { buyerId },
      include: [{ model: Buyer, as: "buyer" }],
      order: [["createdAt", "DESC"]],
    });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching buyer receipts", error: error.message });
  }
};
// GET receipts filtered by buyer and/or date range
// If buyerId + date range are provided → uses BuyerAccount.receiptIds array to fetch receipts,
// then filters by createdAt (date range). Otherwise, uses standard query.
export const getReceiptsFiltered = async (req, res) => {
  try {
    const { buyerId, startDate, endDate } = req.query;

    // Helper to parse date-only strings to UTC date objects (start/end of day)
    const parseDateStart = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    };
    const parseDateEnd = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      d.setUTCHours(23, 59, 59, 999);
      return d;
    };

    const start = parseDateStart(startDate);
    const end = parseDateEnd(endDate);

    // Case 1: Specific buyer + date range → use BuyerAccount.receiptIds for performance
    if (buyerId && (start || end)) {
      const account = await BuyerAccount.findOne({ where: { buyerId } });
      if (!account) return res.json([]);
      const receiptIds = account.receiptIds || [];
      if (receiptIds.length === 0) return res.json([]);

      const receiptWhere = { id: receiptIds };
      if (start || end) {
        receiptWhere.createdAt = {};
        if (start) receiptWhere.createdAt[Op.gte] = start;
        if (end) receiptWhere.createdAt[Op.lte] = end;
      }

      const receipts = await Receipt.findAll({
        where: receiptWhere,
        include: [{ model: Buyer, as: "buyer" }],
        order: [["createdAt", "DESC"]],
      });
      return res.json(receipts);
    }

    // Case 2: No buyerId, or only date range (or both missing)
    const where = {};
    if (buyerId) where.buyerId = buyerId;
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt[Op.gte] = start;
      if (end) where.createdAt[Op.lte] = end;
    }

    const receipts = await Receipt.findAll({
      where,
      include: [{ model: Buyer, as: "buyer" }],
      order: [["createdAt", "DESC"]],
    });
    res.json(receipts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching filtered receipts", error: error.message });
  }
};