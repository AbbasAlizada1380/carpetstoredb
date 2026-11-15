// Controllers/Finance/ReceiptController.js
import { Op } from "sequelize";
import { sequelize } from "../../Models/index.js";
import { Buyer, BuyerAccount, Receipt, Bill } from "../../Models/index.js";

const validateAmount = (amount) => {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Amount must be a positive number");
};

// ─── NEW: currency helpers (mirrors PayController) ───────────────────────
const resolveCurrencyFields = (source, fallback = {}) => {
  let isAfn;
  if (source?.isAfn !== undefined) {
    const v = source.isAfn;
    if (typeof v === "boolean") isAfn = v;
    else if (v === 1 || v === "1" || v === "true") isAfn = true;
    else if (v === 0 || v === "0" || v === "false") isAfn = false;
    else throw new Error(`Invalid isAfn value: ${v}`);
  } else {
    isAfn = fallback.isAfn ?? false;
  }

  let DV;
  if (source?.DV !== undefined && source.DV !== null && source.DV !== "") {
    DV = parseFloat(source.DV);
    if (!Number.isFinite(DV) || DV <= 0) {
      throw new Error(`Invalid DV value: ${source.DV} (must be a positive number)`);
    }
  } else {
    DV = fallback.DV ?? 65;
  }

  return { isAfn, DV };
};

// Convert an amount between AFN and USD (identity if same currency)
const convertAmount = (amount, fromIsAfn, toIsAfn, DV) => {
  if (fromIsAfn === toIsAfn) return amount;
  const rate = Number(DV);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Cannot convert currency: invalid DV");
  }
  return fromIsAfn && !toIsAfn ? amount / rate : amount * rate;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Helper: add receipt ID to BuyerAccount.receiptIds
const addReceiptToBuyerAccount = async (buyerId, receiptId, transaction) => {
  let account = await BuyerAccount.findOne({ where: { buyerId }, transaction });
  if (!account) {
    account = await BuyerAccount.create(
      {
        buyerId,
        sellIds: [],
        remaindIds: [],
        receiptSaleIds: [],
        receiptIds: [],
        has_remaindIds: false,
      },
      { transaction }
    );
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
  const allBills = await Bill.findAll({
    where: { buyerId },
    attributes: ["id", "remainingAmount"],
    transaction,
  });

  const remaindIds = [];
  const receiptSaleIds = [];
  for (const bill of allBills) {
    const remaining = parseFloat(bill.remainingAmount);
    if (remaining > 0) remaindIds.push(bill.id);
    else receiptSaleIds.push(bill.id);
  }

  await BuyerAccount.update(
    {
      remaindIds,
      receiptSaleIds,
      has_remaindIds: remaindIds.length > 0,
    },
    { where: { buyerId }, transaction }
  );
};

// ───────────────────────── CREATE ─────────────────────────

export const createReceipt = async (req, res) => {
  try {
    const { buyerId, amountofmoney, description } = req.body;

    if (!buyerId) return res.status(400).json({ message: "buyerId is required" });
    try {
      validateAmount(amountofmoney);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    // ✅ NEW: currency for this receipt
    let currency;
    try {
      currency = resolveCurrencyFields(req.body, { isAfn: false, DV: 65 });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) return res.status(404).json({ message: "Buyer not found" });

    const paymentAmount = parseFloat(amountofmoney);

    const unpaidBills = await Bill.findAll({
      where: { buyerId, remainingAmount: { [Op.gt]: 0 } },
      order: [["createdAt", "ASC"]],
    });

    if (unpaidBills.length === 0) {
      return res.status(400).json({ message: "Buyer has no unpaid bills" });
    }

    // ✅ NEW: same-currency first, then other-currency (age within each group)
    const sameCurrencyBills = unpaidBills.filter((b) => !!b.isAfn === currency.isAfn);
    const otherCurrencyBills = unpaidBills.filter((b) => !!b.isAfn !== currency.isAfn);
    const orderedBills = [...sameCurrencyBills, ...otherCurrencyBills];

    // ✅ NEW: total unpaid converted into the receipt's currency
    const totalUnpaidConverted = orderedBills.reduce((sum, bill) => {
      const remaining = parseFloat(bill.remainingAmount) || 0;
      const billIsAfn = !!bill.isAfn;
      const rate = parseFloat(bill.DV) > 0 ? parseFloat(bill.DV) : currency.DV;
      return sum + convertAmount(remaining, billIsAfn, currency.isAfn, rate);
    }, 0);

    if (paymentAmount > totalUnpaidConverted + 0.01) {
      return res.status(400).json({
        message:
          `Payment amount (${paymentAmount} ${currency.isAfn ? "AFN" : "USD"}) ` +
          `exceeds total unpaid converted to ${currency.isAfn ? "AFN" : "USD"} ` +
          `(${round2(totalUnpaidConverted).toFixed(2)}).`,
      });
    }

    const transaction = await sequelize.transaction();

    try {
      // 1. Create the Receipt (with currency)
      const receipt = await Receipt.create(
        {
          buyerId,
          amountofmoney: paymentAmount,
          description: description?.trim() || null,
          isAfn: currency.isAfn,
          DV: currency.DV,
          appliedTo: [], // audit trail — populated below (only if column exists)
        },
        { transaction }
      );

      let remainingPayment = paymentAmount; // always in RECEIPT currency
      const fullyPaidBillIds = [];
      const appliedTo = [];

      // 2. Apply payment across bills
      for (const bill of orderedBills) {
        if (remainingPayment <= 0.009) break;

        const billIsAfn = !!bill.isAfn;
        const sameCurrency = billIsAfn === currency.isAfn;
        const rate = parseFloat(bill.DV) > 0 ? parseFloat(bill.DV) : currency.DV;

        const currentRemaining = parseFloat(bill.remainingAmount) || 0;
        if (currentRemaining <= 0) continue;

        // Available payment in the bill's currency
        const availableInBillCurrency = convertAmount(
          remainingPayment,
          currency.isAfn,
          billIsAfn,
          rate
        );

        const amountToPayInBillCurrency = round2(
          Math.min(availableInBillCurrency, currentRemaining)
        );
        if (amountToPayInBillCurrency <= 0) continue;

        // Amount consumed from the payment, in the receipt's currency
        const consumedInPaymentCurrency = round2(
          convertAmount(amountToPayInBillCurrency, billIsAfn, currency.isAfn, rate)
        );

        const newPaidAmount = round2(
          parseFloat(bill.paidAmount) + amountToPayInBillCurrency
        );
        const newRemaining = round2(currentRemaining - amountToPayInBillCurrency);
        let newStatus = bill.status;
        if (newRemaining <= 0) {
          newStatus = "paid";
          fullyPaidBillIds.push(bill.id);
        } else if (newPaidAmount > 0 && newRemaining > 0) {
          newStatus = "partial";
        }

        await bill.update(
          {
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(newRemaining, 0),
            status: newStatus,
          },
          { transaction }
        );

        appliedTo.push({
          billId: bill.id,
          billCurrency: billIsAfn ? "AFN" : "USD",
          paymentCurrency: currency.isAfn ? "AFN" : "USD",
          appliedInBillCurrency: amountToPayInBillCurrency,
          consumedInPaymentCurrency,
          rate: sameCurrency ? 1 : rate,
          converted: !sameCurrency,
        });

        remainingPayment = round2(remainingPayment - consumedInPaymentCurrency);
      }

      // Surface rounding residue for the audit
      if (remainingPayment > 0.009) {
        appliedTo.push({
          type: "unapplied_residue",
          paymentCurrency: currency.isAfn ? "AFN" : "USD",
          amount: remainingPayment,
          reason: "Rounding residue — could not be applied to any bill",
        });
      }

      // 3. Persist audit trail (requires Receipt.appliedTo JSON column — remove if absent)
      await receipt.update({ appliedTo }, { transaction });

      // 4. BuyerAccount updates
      await addReceiptToBuyerAccount(buyerId, receipt.id, transaction);
      await syncBuyerAccountBills(buyerId, transaction);

      await transaction.commit();

      res.status(201).json({
        message: "Receipt created successfully",
        receipt,
        updatedBills: { fullyPaid: fullyPaidBillIds, appliedTo },
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

// ───────────────────────── READ ─────────────────────────

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

export const getReceiptsFiltered = async (req, res) => {
  try {
    const { buyerId, startDate, endDate } = req.query;

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

// ───────────────────────── UPDATE ─────────────────────────

export const updateReceipt = async (req, res) => {
  const { id } = req.params;
  const { amountofmoney, description, buyerId } = req.body;

  try {
    const receipt = await Receipt.findByPk(id);
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });

    if (amountofmoney !== undefined) {
      try {
        validateAmount(amountofmoney);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    if (buyerId !== undefined) {
      const buyer = await Buyer.findByPk(buyerId);
      if (!buyer) {
        return res.status(400).json({ message: "Buyer not found" });
      }
    }

    // ✅ NEW: resolve currency (fallback to existing receipt's values)
    let updatedCurrency = null;
    if (req.body.isAfn !== undefined || req.body.DV !== undefined) {
      try {
        updatedCurrency = resolveCurrencyFields(req.body, {
          isAfn: receipt.isAfn,
          DV: receipt.DV,
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }

      // Block currency changes on already-applied receipts
      const hasApplied =
        Array.isArray(receipt.appliedTo) &&
        receipt.appliedTo.some((a) => !a.type);
      if (hasApplied && updatedCurrency.isAfn !== !!receipt.isAfn) {
        return res.status(400).json({
          message:
            "Cannot change currency of a receipt that has already been applied to bills. " +
            "Delete this receipt and create a new one instead.",
        });
      }
    }

    const updateData = {};
    if (amountofmoney !== undefined) updateData.amountofmoney = parseFloat(amountofmoney);
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (buyerId !== undefined) updateData.buyerId = buyerId;
    if (updatedCurrency) {
      updateData.isAfn = updatedCurrency.isAfn;
      updateData.DV = updatedCurrency.DV;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    await receipt.update(updateData);

    res.json({ message: "Receipt updated successfully", receipt });
  } catch (error) {
    res.status(500).json({ message: "Error updating receipt", error: error.message });
  }
};

// ───────────────────────── DELETE ─────────────────────────

export const deleteReceipt = async (req, res) => {
  const { id } = req.params;

  const transaction = await sequelize.transaction();
  try {
    const receipt = await Receipt.findByPk(id, { transaction });
    if (!receipt) {
      await transaction.rollback();
      return res.status(404).json({ message: "Receipt not found" });
    }

    const { buyerId, amountofmoney } = receipt;
    const receiptIsAfn = !!receipt.isAfn;
    const receiptDV = parseFloat(receipt.DV) > 0 ? parseFloat(receipt.DV) : 65;

    const bills = await Bill.findAll({
      where: { buyerId },
      order: [["createdAt", "DESC"]], // reverse order: refund latest paid bills first
      transaction,
    });

    // ✅ NEW: refund is in RECEIPT currency; convert per bill to its currency
    let remainingRefund = parseFloat(amountofmoney);
    for (const bill of bills) {
      if (remainingRefund <= 0.009) break;

      const billIsAfn = !!bill.isAfn;
      const sameCurrency = billIsAfn === receiptIsAfn;
      const rate = parseFloat(bill.DV) > 0 ? parseFloat(bill.DV) : receiptDV;

      const currentPaid = parseFloat(bill.paidAmount) || 0;
      if (currentPaid <= 0) continue;

      // Convert the refund available into the bill's currency
      const availableInBillCurrency = convertAmount(
        remainingRefund,
        receiptIsAfn,
        billIsAfn,
        rate
      );

      // Refund applied to this bill, in the bill's currency
      const amountToRefundInBillCurrency = round2(
        Math.min(availableInBillCurrency, currentPaid)
      );
      if (amountToRefundInBillCurrency <= 0) continue;

      // Amount consumed from the refund, in the receipt's currency
      const consumedInReceiptCurrency = round2(
        convertAmount(amountToRefundInBillCurrency, billIsAfn, receiptIsAfn, rate)
      );

      const newPaidAmount = round2(currentPaid - amountToRefundInBillCurrency);
      const newRemaining = round2(
        parseFloat(bill.remainingAmount) + amountToRefundInBillCurrency
      );

      let newStatus = bill.status;
      if (newRemaining > 0 && newPaidAmount <= 0) newStatus = "unpaid";
      else if (newPaidAmount > 0 && newRemaining > 0) newStatus = "partial";
      else if (newRemaining <= 0) newStatus = "paid";

      await bill.update(
        {
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          status: newStatus,
        },
        { transaction }
      );

      remainingRefund = round2(remainingRefund - consumedInReceiptCurrency);

      // silence unused variable lint if sameCurrency was only informational
      void sameCurrency;
    }

    await receipt.destroy({ transaction });
    await syncBuyerAccountBills(buyerId, transaction);
    await transaction.commit();

    res.json({ message: "Receipt deleted and payments reversed" });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ message: "Error deleting receipt", error: error.message });
  }
};