// Controllers/Finance/PayController.js
import { Op } from "sequelize";
import { sequelize } from "../../Models/index.js";
import { Customer } from "../../Models/index.js";
import CustomerAccount from "../../Models/customer/CustomerAccount.js";
import { Pay, IncomeBill } from "../../Models/index.js";

const validatePayment = (amount) => {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Amount must be a positive number");
};

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

/* =========================================================
   ✅ NEW: Convert an amount between AFN and USD
   - Same currency → identity
   - USD → AFN  → multiply by DV
   - AFN → USD  → divide by DV
   ========================================================= */
const convertAmount = (amount, fromIsAfn, toIsAfn, DV) => {
  if (fromIsAfn === toIsAfn) return amount;
  const rate = Number(DV);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Cannot convert currency: invalid DV");
  }
  return fromIsAfn && !toIsAfn ? amount / rate : amount * rate;
};

const round2 = (n) => Math.round(n * 100) / 100;

/* ======================= CREATE PAYMENT ======================= */
export const createPayment = async (req, res) => {
  try {
    const { customerId, amountofmoney, description } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }
    try {
      validatePayment(amountofmoney);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    let currency;
    try {
      currency = resolveCurrencyFields(req.body, { isAfn: false, DV: 65 });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const paymentAmount = parseFloat(amountofmoney);
    if (paymentAmount <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    // Fetch all unpaid bills for this customer (remainingAmount > 0)
    const unpaidBills = await IncomeBill.findAll({
      where: {
        customerId,
        remainingAmount: { [Op.gt]: 0 },
      },
      order: [["createdAt", "ASC"]],
    });

    if (unpaidBills.length === 0) {
      return res.status(400).json({ message: "Customer has no unpaid bills" });
    }

    // ✅ NEW: same-currency bills first, then other-currency (by age within each group)
    const sameCurrencyBills = unpaidBills.filter(
      (b) => !!b.isAfn === currency.isAfn
    );
    const otherCurrencyBills = unpaidBills.filter(
      (b) => !!b.isAfn !== currency.isAfn
    );
    const orderedBills = [...sameCurrencyBills, ...otherCurrencyBills];

    // ✅ NEW: compute total unpaid in the PAYMENT's currency (needed for the
    // "amount exceeds total" check). For opposite-currency bills we convert
    // using each bill's own DV (falls back to payment DV).
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
      // 1. Create the Pay record
      const payment = await Pay.create(
        {
          customerId,
          amountofmoney: paymentAmount,
          description: description?.trim() || null,
          isAfn: currency.isAfn,
          DV: currency.DV,
          appliedTo: [], // populated below
        },
        { transaction }
      );

      let remainingPayment = paymentAmount; // always in PAYMENT currency
      const fullyPaidBillIds = [];
      const appliedTo = [];

      // 2. Apply payment across bills (same-currency first, then converted)
      for (const bill of orderedBills) {
        if (remainingPayment <= 0.009) break; // allow tiny rounding residue

        const billIsAfn = !!bill.isAfn;
        const sameCurrency = billIsAfn === currency.isAfn;
        const rate =
          parseFloat(bill.DV) > 0 ? parseFloat(bill.DV) : currency.DV;

        const currentRemaining = parseFloat(bill.remainingAmount) || 0;
        if (currentRemaining <= 0) continue;

        // Convert the available payment into the bill's currency
        const availableInBillCurrency = convertAmount(
          remainingPayment,
          currency.isAfn,
          billIsAfn,
          rate
        );

        // Amount applied to THIS bill, in the bill's currency
        const amountToPayInBillCurrency = round2(
          Math.min(availableInBillCurrency, currentRemaining)
        );
        if (amountToPayInBillCurrency <= 0) continue;

        // Amount consumed from the payment, in the payment's currency
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

        // ✅ Audit trail per bill
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

      // ✅ NEW: surface any leftover residue so it's visible in the audit
      if (remainingPayment > 0.009) {
        appliedTo.push({
          type: "unapplied_residue",
          paymentCurrency: currency.isAfn ? "AFN" : "USD",
          amount: remainingPayment,
          reason: "Rounding residue — could not be applied to any bill",
        });
      }

      // 3. Persist the audit trail
      await payment.update({ appliedTo }, { transaction });

      // 4. Get or create CustomerAccount
      let account = await CustomerAccount.findOne({
        where: { customerId },
        transaction,
      });
      if (!account) {
        account = await CustomerAccount.create(
          {
            customerId,
            paid: [],
            unpaid: [],
            total: [],
            returned: [],
            pay: [],
            receive: [],
          },
          { transaction }
        );
      }

      // 5. Add the new payment ID to the `pay` array
      const db = CustomerAccount.sequelize;
      await db.query(
        `UPDATE CustomerAccounts 
         SET pay = JSON_ARRAY_APPEND(COALESCE(pay, JSON_ARRAY()), '$', :payId)
         WHERE customerId = :customerId`,
        {
          replacements: { payId: payment.id, customerId },
          type: db.QueryTypes.UPDATE,
          transaction,
        }
      );

      // 6. Sync the `paid` and `unpaid` arrays
      const stillUnpaidBills = await IncomeBill.findAll({
        where: { customerId, remainingAmount: { [Op.gt]: 0 } },
        attributes: ["id"],
        transaction,
      });
      const stillUnpaidIds = stillUnpaidBills.map((b) => b.id);

      const paidBills = await IncomeBill.findAll({
        where: { customerId, remainingAmount: 0 },
        attributes: ["id"],
        transaction,
      });
      const paidBillIds = paidBills.map((b) => b.id);

      await account.update(
        { unpaid: stillUnpaidIds, paid: paidBillIds },
        { transaction }
      );

      await transaction.commit();

      res.status(201).json({
        message: "Payment created successfully",
        payment,
        updatedBills: {
          fullyPaid: fullyPaidBillIds,
          remainingUnpaidCount: stillUnpaidIds.length,
          appliedTo,
        },
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating payment", error: error.message });
  }
};

/* ======================= READ ======================= */
export const getAllPayments = async (req, res) => {
  try {
    const { customerId, page = 1, limit = 20 } = req.query;
    const where = customerId ? { customerId } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);

    const { count, rows: payments } = await Pay.findAndCountAll({
      where,
      include: [{ model: Customer, as: "customer" }],
      order: [["createdAt", "DESC"]],
      offset,
      limit: pageLimit,
    });

    const totalPages = Math.ceil(count / pageLimit);

    res.json({
      data: payments,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: pageLimit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching payments", error: error.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Pay.findByPk(id, {
      include: [{ model: Customer, as: "customer" }],
    });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching payment", error: error.message });
  }
};

/* ======================= UPDATE ======================= */
/* ⚠️ Note: changing amount or currency after bills were applied
   would invalidate the audit trail. We only allow:
   - amount edits that keep the same currency (safe for description/notes)
   - description edits
   - DV edits (a rate correction — does NOT retroactively change bills)
   Changing isAfn on a payment that has already been applied is rejected.
*/
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountofmoney, description } = req.body;

    const payment = await Pay.findByPk(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    if (amountofmoney !== undefined) {
      try {
        validatePayment(amountofmoney);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    let updatedCurrency = null;
    if (req.body.isAfn !== undefined || req.body.DV !== undefined) {
      try {
        updatedCurrency = resolveCurrencyFields(req.body, {
          isAfn: payment.isAfn,
          DV: payment.DV,
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
      // ✅ Block currency changes on already-applied payments
      const hasApplied =
        Array.isArray(payment.appliedTo) &&
        payment.appliedTo.some((a) => !a.type);
      if (hasApplied && updatedCurrency.isAfn !== !!payment.isAfn) {
        return res.status(400).json({
          message:
            "Cannot change currency of a payment that has already been applied to bills. " +
            "Delete this payment and create a new one instead.",
        });
      }
    }

    const updateData = {
      amountofmoney:
        amountofmoney !== undefined
          ? parseFloat(amountofmoney)
          : payment.amountofmoney,
      description: description?.trim() || null,
    };
    if (updatedCurrency) {
      updateData.isAfn = updatedCurrency.isAfn;
      updateData.DV = updatedCurrency.DV;
    }

    await payment.update(updateData);

    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating payment", error: error.message });
  }
};

/* ======================= DELETE ======================= */
/* ⚠️ Deleting a payment does NOT reverse the bill updates it made.
   Add an "undo" endpoint if you need that. */
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Pay.findByPk(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    await payment.destroy();
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting payment", error: error.message });
  }
};

/* ======================= FILTERED ======================= */
export const getPaymentsFiltered = async (req, res) => {
  try {
    const { customerId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const where = {};

    if (customerId) where.customerId = customerId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        where.createdAt[Op.gte] = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);

    const { count, rows: payments } = await Pay.findAndCountAll({
      where,
      include: [{ model: Customer, as: "customer" }],
      order: [["createdAt", "DESC"]],
      offset,
      limit: pageLimit,
    });

    const totalPages = Math.ceil(count / pageLimit);

    res.json({
      data: payments,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: pageLimit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching filtered payments", error: error.message });
  }
};