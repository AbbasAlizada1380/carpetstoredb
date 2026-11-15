// Controllers/accounting/BuyerAccountController.js
import { BuyerAccount, Buyer, Bill } from "../../Models/index.js";
import { Op } from "sequelize";
import sequelize from "../../dbconnection.js";

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
        receiptSaleIds: [],
        receiptIds: [],
        has_remaindIds: false,
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
        receiptSaleIds: [],
        receiptIds: [],
        has_remaindIds: false,
      });
    }

    const currentSells = Array.isArray(account.sellIds) ? [...account.sellIds] : [];
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
        receiptSaleIds: [],
        receiptIds: [],
        has_remaindIds: false,
      });
    }

    const currentReceipts = Array.isArray(account.receiptIds) ? [...account.receiptIds] : [];
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

    const currentSells = Array.isArray(account.sellIds) ? [...account.sellIds] : [];
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

    const currentReceipts = Array.isArray(account.receiptIds) ? [...account.receiptIds] : [];
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

/* ===========================
   Get all buyers with unpaid bills (has_remaindIds = true)
   ✅ NEW: grouped per currency (AFN / USD), mirroring getCustomersWithUnpaid
=========================== */
export const getBuyersWithUnpaid = async (req, res) => {
  try {
    const accounts = await BuyerAccount.findAll({
      where: { has_remaindIds: true },
      include: [{ model: Buyer, as: "buyer" }],
    });

    if (!accounts.length) {
      return res.status(200).json({
        success: true,
        data: [],
        total: { afn: 0, usd: 0 },
      });
    }

    // Collect all unpaid bill IDs across buyers
    const allBillIds = [];
    for (const account of accounts) {
      const remaindIds = Array.isArray(account.remaindIds) ? account.remaindIds : [];
      allBillIds.push(...remaindIds);
    }

    if (allBillIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        total: { afn: 0, usd: 0 },
      });
    }

    // ✅ Include isAfn + DV to group per currency
    const unpaidBills = await Bill.findAll({
      where: {
        id: allBillIds,
        remainingAmount: { [Op.gt]: 0 },
      },
      attributes: [
        "id",
        "buyerId",
        "remainingAmount",
        "totalAmount",
        "paidAmount",
        "isAfn",
        "DV",
      ],
    });

    // Structure: Map<buyerId, { afn: { total_due, bills[], DV }, usd: {...} }>
    const buyerMap = new Map();

    for (const bill of unpaidBills) {
      const buyerId = bill.buyerId;
      const amount = parseFloat(bill.remainingAmount) || 0;
      const isAfn = !!bill.isAfn;
      const bucketKey = isAfn ? "afn" : "usd";

      if (!buyerMap.has(buyerId)) {
        buyerMap.set(buyerId, {
          afn: { total_due: 0, bills: [], DV: null },
          usd: { total_due: 0, bills: [], DV: null },
        });
      }

      const entry = buyerMap.get(buyerId)[bucketKey];
      entry.total_due += amount;
      entry.bills.push({
        billId: bill.id,
        remaining: amount,
        DV: bill.DV != null ? parseFloat(bill.DV) : null,
      });

      // Track DV for this currency bucket; mark "mixed" if bills disagree
      const billDV = bill.DV != null ? parseFloat(bill.DV) : null;
      if (billDV != null) {
        if (entry.DV === null) entry.DV = billDV;
        else if (entry.DV !== billDV) entry.DV = "mixed";
      }
    }

    // Fetch buyer names in one query
    const buyerIds = Array.from(buyerMap.keys());
    const buyers = await Buyer.findAll({
      where: { id: buyerIds },
      attributes: ["id", "fullname"],
    });

    const buyerById = new Map(buyers.map((b) => [b.id, b]));

    // ✅ Build response: one row per (buyer, currency) with debt
    const responseData = [];
    const grandTotal = { afn: 0, usd: 0 };

    for (const buyerId of buyerIds) {
      const buyer = buyerById.get(buyerId);
      if (!buyer) continue;

      const buckets = buyerMap.get(buyerId);
      for (const currency of ["usd", "afn"]) {
        const bucket = buckets[currency];
        if (bucket.total_due <= 0) continue;

        responseData.push({
          customer: {
            // keep "customer" key so frontend expects the same shape as /customer-account
            id: buyer.id,
            fullname: buyer.fullname,
          },
          total_due: Number(bucket.total_due.toFixed(2)),
          isAfn: currency === "afn",
          DV: bucket.DV, // number, null, or "mixed"
          details: bucket.bills,
        });

        grandTotal[currency] += bucket.total_due;
      }
    }

    return res.status(200).json({
      success: true,
      data: responseData,
      total: {
        afn: Number(grandTotal.afn.toFixed(2)),
        usd: Number(grandTotal.usd.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error fetching buyers with unpaid:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching buyers with unpaid",
      error: error.message,
    });
  }
};