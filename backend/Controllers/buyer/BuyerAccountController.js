// Controllers/accounting/BuyerAccountController.js
import { BuyerAccount, Buyer } from "../../Models/index.js";
import { Op } from "sequelize";
import sequelize from "../../dbconnection.js";
import { Bill } from "../../Models/index.js"; // ensure Bill is imported

/* ===========================
   Get or create buyer account
=========================== */
export const getOrCreateBuyerAccount = async (req, res) => {
  try {
    const { buyerId } = req.params;

    if (!buyerId) {
      return res.status(400).json({ message: "buyerId is required" });
    }

    let account = await BuyerAccount.findOne({
      where: { buyerId },
      include: [{ model: Buyer, as: "buyer" }],
    });

    if (!account) {
      account = await BuyerAccount.create({
        buyerId,
        sellIds: [],
        remaindIds: [],
        receiptIds: [],
      });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching buyer account", error: error.message });
  }
};

/* ===========================
   Get all buyer accounts (optional)
=========================== */
export const getAllBuyerAccounts = async (req, res) => {
  try {
    const accounts = await BuyerAccount.findAll({
      include: [{ model: Buyer, as: "buyer" }],
      order: [["createdAt", "DESC"]],
    });
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching accounts", error: error.message });
  }
};

/* ===========================
   Add sell ID to buyer account
=========================== */
export const addSellToAccount = async (req, res) => {
  try {
    const { buyerId, sellId } = req.body;

    if (!buyerId || !sellId) {
      return res.status(400).json({ message: "buyerId and sellId are required" });
    }

    let account = await BuyerAccount.findOne({ where: { buyerId } });
    if (!account) {
      account = await BuyerAccount.create({
        buyerId,
        sellIds: [],
        remaindIds: [],
        receiptIds: [],
      });
    }

    const currentSells = account.sellIds;
    if (!currentSells.includes(sellId)) {
      currentSells.push(sellId);
      await account.update({ sellIds: currentSells });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding sell to account", error: error.message });
  }
};

/* ===========================
   Add receipt ID to buyer account
=========================== */
export const addReceiptToAccount = async (req, res) => {
  try {
    const { buyerId, receiptId } = req.body;

    if (!buyerId || !receiptId) {
      return res.status(400).json({ message: "buyerId and receiptId are required" });
    }

    let account = await BuyerAccount.findOne({ where: { buyerId } });
    if (!account) {
      account = await BuyerAccount.create({
        buyerId,
        sellIds: [],
        remaindIds: [],
        receiptIds: [],
      });
    }

    const currentReceipts = account.receiptIds;
    if (!currentReceipts.includes(receiptId)) {
      currentReceipts.push(receiptId);
      await account.update({ receiptIds: currentReceipts });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding receipt to account", error: error.message });
  }
};

/* ===========================
   Remove sell ID from buyer account (for rollback)
=========================== */
export const removeSellFromAccount = async (req, res) => {
  try {
    const { buyerId, sellId } = req.body;

    if (!buyerId || !sellId) {
      return res.status(400).json({ message: "buyerId and sellId are required" });
    }

    const account = await BuyerAccount.findOne({ where: { buyerId } });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    let currentSells = account.sellIds;
    const index = currentSells.indexOf(sellId);
    if (index !== -1) {
      currentSells.splice(index, 1);
      await account.update({ sellIds: currentSells });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing sell", error: error.message });
  }
};

/* ===========================
   Remove receipt ID from buyer account
=========================== */
export const removeReceiptFromAccount = async (req, res) => {
  try {
    const { buyerId, receiptId } = req.body;

    if (!buyerId || !receiptId) {
      return res.status(400).json({ message: "buyerId and receiptId are required" });
    }

    const account = await BuyerAccount.findOne({ where: { buyerId } });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    let currentReceipts = account.receiptIds;
    const index = currentReceipts.indexOf(receiptId);
    if (index !== -1) {
      currentReceipts.splice(index, 1);
      await account.update({ receiptIds: currentReceipts });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing receipt", error: error.message });
  }
};

// Controllers/accounting/BuyerAccountController.js (add at the end)


/* ===========================
   Get all buyers with unpaid bills (has_remaindIds = true)
   Returns format: { success: true, data: [...], total: overallDue }
=========================== */
export const getBuyersWithUnpaid = async (req, res) => {
  try {
    // Find all BuyerAccounts where has_remaindIds is true
    const accounts = await BuyerAccount.findAll({
      where: { has_remaindIds: true },
      include: [{ model: Buyer, as: "buyer" }],
    });

    const result = [];
    let totalOverallDue = 0;

    for (const account of accounts) {
      const remaindIds = account.remaindIds || [];
      if (remaindIds.length === 0) continue; // safety

      // Fetch all bills whose IDs are in remaindIds
      const bills = await Bill.findAll({
        where: { id: remaindIds },
        attributes: ['id', 'remainingAmount'],
      });

      let totalDue = 0;
      const details = [];
      for (const bill of bills) {
        const remaining = parseFloat(bill.remainingAmount) || 0;
        totalDue += remaining;
        details.push({ billId: bill.id, remaining });
      }

      totalOverallDue += totalDue;

      result.push({
        customer: {   // naming matches frontend expectation (customer)
          id: account.buyer.id,
          fullname: account.buyer.fullname,
        },
        total_due: totalDue,
        details,
      });
    }

    res.json({
      success: true,
      data: result,
      total: totalOverallDue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching buyers with unpaid", error: error.message });
  }
};