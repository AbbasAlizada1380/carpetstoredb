// Controllers/Finance/PayController.js (or wherever your payment controller is)
import { Op } from "sequelize";
import { sequelize } from "../../Models/index.js";
import { Customer } from "../../Models/index.js";
import CustomerAccount from "../../Models/customer/CustomerAccount.js";
import { Pay, IncomeBill } from "../../Models/index.js";

// Helper validation (assuming you have it)
const validatePayment = (amount) => {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Amount must be a positive number");
};

// CREATE a new payment with full CustomerAccount update
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
      order: [['createdAt', 'ASC']], // oldest first
    });

    const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.remainingAmount), 0);
    if (paymentAmount > totalUnpaid + 0.01) {
      return res.status(400).json({ message: "Payment amount exceeds total unpaid amount" });
    }

    // Start a transaction for consistency
    const transaction = await sequelize.transaction();

    try {
      // 1. Create the Pay record
      const payment = await Pay.create({
        customerId,
        amountofmoney: paymentAmount,
        description: description?.trim() || null,
      }, { transaction });

      let remainingPayment = paymentAmount;
      const fullyPaidBillIds = [];

      // 2. Apply payment sequentially to unpaid bills
      for (const bill of unpaidBills) {
        if (remainingPayment <= 0) break;

        const currentRemaining = parseFloat(bill.remainingAmount);
        const amountToPay = Math.min(remainingPayment, currentRemaining);
        const newPaidAmount = parseFloat(bill.paidAmount) + amountToPay;
        const newRemaining = currentRemaining - amountToPay;
        let newStatus = bill.status;
        if (newRemaining === 0) {
          newStatus = 'paid';
          fullyPaidBillIds.push(bill.id);
        } else if (newPaidAmount > 0 && newRemaining > 0) {
          newStatus = 'partial';
        }

        await bill.update({
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          status: newStatus,
        }, { transaction });

        remainingPayment -= amountToPay;
      }

      // 3. Get or create CustomerAccount
      let account = await CustomerAccount.findOne({ where: { customerId }, transaction });
      if (!account) {
        account = await CustomerAccount.create({
          customerId,
          paid: [],
          unpaid: [],
          total: [],
          returned: [],
          pay: [],
          receive: [],
        }, { transaction });
      }

      // 4. Add the new payment ID to the `pay` array using raw SQL (optional)
      const db = CustomerAccount.sequelize;
      await db.query(
        `UPDATE CustomerAccounts 
   SET pay = JSON_ARRAY_APPEND(COALESCE(pay, JSON_ARRAY()), '$', :payId)
   WHERE customerId = :customerId`,
        { replacements: { payId: payment.id, customerId }, type: db.QueryTypes.UPDATE, transaction }
      );

      // 5. Sync the `paid` and `unpaid` arrays based on current bill statuses
      const stillUnpaidBills = await IncomeBill.findAll({
        where: {
          customerId,
          remainingAmount: { [Op.gt]: 0 },
        },
        attributes: ['id'],
        transaction,
      });
      const stillUnpaidIds = stillUnpaidBills.map(b => b.id);

      const paidBills = await IncomeBill.findAll({
        where: {
          customerId,
          remainingAmount: 0,
        },
        attributes: ['id'],
        transaction,
      });
      const paidBillIds = paidBills.map(b => b.id);

      await account.update({
        unpaid: stillUnpaidIds,
        paid: paidBillIds,
      }, { transaction });

      await transaction.commit();

      // 6. Return success response
      res.status(201).json({
        message: "Payment created successfully",
        payment,
        updatedBills: {
          fullyPaid: fullyPaidBillIds,
          remainingUnpaidCount: stillUnpaidIds.length,
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
// GET all payments (optionally filtered by customerId) with pagination
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

// GET a single payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Pay.findByPk(id, {
      include: [{ model: Customer, as: "customer" }],
    });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching payment", error: error.message });
  }
};

// UPDATE a payment
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountofmoney, description } = req.body;

    const payment = await Pay.findByPk(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Validate amount if provided
    if (amountofmoney !== undefined) {
      try {
        validatePayment(amountofmoney);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    await payment.update({
      amountofmoney: amountofmoney !== undefined ? parseFloat(amountofmoney) : payment.amountofmoney,
      description: description?.trim() || null,
    });

    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating payment", error: error.message });
  }
};

// DELETE a payment
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Pay.findByPk(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    await payment.destroy();
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting payment", error: error.message });
  }
};
