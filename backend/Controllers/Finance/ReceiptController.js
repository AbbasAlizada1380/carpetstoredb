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

    const receipt = await Receipt.create({
      buyerId,
      amountofmoney,
      description: description || null,
    });

    // Update buyer account with this receipt ID
    // We'll call the helper that adds receiptId
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
    if (!currentReceipts.includes(receipt.id)) {
      currentReceipts.push(receipt.id);
      await account.update({ receiptIds: currentReceipts });
    }

    res.status(201).json(receipt);
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