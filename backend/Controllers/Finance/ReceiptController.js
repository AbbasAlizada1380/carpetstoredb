// Controllers/accounting/ReceiptController.js
import { Receipt, Buyer, BuyerAccount } from "../../Models/index.js";
import { addReceiptToAccount, removeReceiptFromAccount } from "../buyer/BuyerAccountController.js";

/* ===========================
   Create Receipt (auto updates buyer account)
=========================== */
export const createReceipt = async (req, res) => {
  try {
    const { buyerId, amountofmoney, description } = req.body;

    if (!buyerId) {
      return res.status(400).json({ message: "buyerId is required" });
    }
    if (!amountofmoney || amountofmoney <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    // 1. Get or create BuyerAccount
    let account = await BuyerAccount.findOne({ where: { buyerId } });
    if (!account) {
      account = await BuyerAccount.create({
        buyerId,
        sellIds: [],
        remaindIds: [],
        receiptSaleIds: [],
        receiptIds: [],
      });
    }

    // 2. Get unpaid sell IDs (remaindIds)
    let remaindIds = account.remaindIds || [];
    if (remaindIds.length === 0) {
      // No debt to clear – just create receipt and return
      const receipt = await Receipt.create({
        buyerId,
        amountofmoney,
        description: description || null,
      });
      let receiptIds = account.receiptIds || [];
      if (!receiptIds.includes(receipt.id)) {
        receiptIds.push(receipt.id);
        await account.update({ receiptIds });
      }
      return res.status(201).json({
        receipt,
        updatedSells: [],
        remaindIds: account.remaindIds,
        message: "No outstanding sells to apply payment.",
      });
    }

    // 3. Fetch unpaid sells in order (by id ascending)
    const unpaidSells = await Sells.findAll({
      where: { id: remaindIds },
      order: [['id', 'ASC']],
    });

    let remainingAmount = parseFloat(amountofmoney);
    let totalRemainingDebt = unpaidSells.reduce((sum, sell) => sum + parseFloat(sell.remaind), 0);

    if (remainingAmount > totalRemainingDebt) {
      return res.status(400).json({
        message: `Payment amount (${remainingAmount}) exceeds total outstanding debt (${totalRemainingDebt}).`,
      });
    }

    const updatedSells = [];
    const fullyPaidIds = [];

    // 4. Apply payment sequentially
    for (const sell of unpaidSells) {
      if (remainingAmount <= 0) break;

      let currentRemaind = parseFloat(sell.remaind);
      let currentReceipt = parseFloat(sell.receipt);
      let amountToPay = Math.min(remainingAmount, currentRemaind);

      // Update sell
      sell.receipt = currentReceipt + amountToPay;
      sell.remaind = currentRemaind - amountToPay;
      await sell.save();

      updatedSells.push(sell);
      remainingAmount -= amountToPay;

      // If fully paid, mark for moving
      if (sell.remaind === 0) {
        fullyPaidIds.push(sell.id);
      }
    }

    // 5. Update BuyerAccount arrays
    let newRemaindIds = remaindIds.filter(id => !fullyPaidIds.includes(id));
    let receiptSaleIds = account.receiptSaleIds || [];
    for (let id of fullyPaidIds) {
      if (!receiptSaleIds.includes(id)) {
        receiptSaleIds.push(id);
      }
    }

    // Also add the receipt ID itself
    const receipt = await Receipt.create({
      buyerId,
      amountofmoney,
      description: description || null,
    });
    let receiptIds = account.receiptIds || [];
    if (!receiptIds.includes(receipt.id)) {
      receiptIds.push(receipt.id);
    }

    await account.update({
      remaindIds: newRemaindIds,
      receiptSaleIds,
      receiptIds,
    });

    // 6. Return the updated data
    res.status(201).json({
      receipt,
      updatedSells,
      remaindIds: newRemaindIds,          // the updated remaindIds array
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating receipt", error: error.message });
  }
};

/* ===========================
   Get all receipts (with buyer info)
=========================== */
export const getAllReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.findAll({
      include: [{ model: Buyer, as: "buyer" }],
      order: [["createdAt", "DESC"]],
    });
    res.json(receipts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching receipts", error: error.message });
  }
};

/* ===========================
   Get receipts by buyerId
=========================== */
export const getReceiptsByBuyer = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const receipts = await Receipt.findAll({
      where: { buyerId },
      include: [{ model: Buyer, as: "buyer" }],
      order: [["createdAt", "DESC"]],
    });
    res.json(receipts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching buyer receipts", error: error.message });
  }
};

/* ===========================
   Update Receipt
=========================== */
export const updateReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountofmoney, description } = req.body;

    const receipt = await Receipt.findByPk(id);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    await receipt.update({ amountofmoney, description });
    res.json(receipt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating receipt", error: error.message });
  }
};

/* ===========================
   Delete Receipt (also removes from buyer account)
=========================== */
export const deleteReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const receipt = await Receipt.findByPk(id);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    const buyerId = receipt.buyerId;
    await receipt.destroy();

    // Remove receipt ID from buyer account
    const account = await BuyerAccount.findOne({ where: { buyerId } });
    if (account) {
      let currentReceipts = account.receiptIds;
      const index = currentReceipts.indexOf(parseInt(id));
      if (index !== -1) {
        currentReceipts.splice(index, 1);
        await account.update({ receiptIds: currentReceipts });
      }
    }

    res.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting receipt", error: error.message });
  }
};