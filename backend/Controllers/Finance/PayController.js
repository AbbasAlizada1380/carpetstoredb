// Controllers/finance/PayController.js
import { Pay, Customer } from "../../Models/index.js";

// ======================= HELPERS =======================
const validatePayment = (amount) => {
  if (!amount || parseFloat(amount) <= 0) {
    throw new Error("Amount must be a positive number");
  }
};

// ======================= CRUD OPERATIONS =======================

// GET all payments (optionally filtered by customerId)
export const getAllPayments = async (req, res) => {
  try {
    const { customerId } = req.query;
    const where = customerId ? { customerId } : {};
    const payments = await Pay.findAll({
      where,
      include: [{ model: Customer, as: "customer" }],
      order: [["createdAt", "DESC"]],
    });
    res.json(payments);
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

// CREATE a new payment
export const createPayment = async (req, res) => {
  try {
    const { customerId, amountofmoney, description } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }
    try {
      validatePayment(amountofmoney);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    // Check if customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const payment = await Pay.create({
      customerId,
      amountofmoney: parseFloat(amountofmoney),
      description: description?.trim() || null,
    });

    // Optionally, if you want to update CustomerAccount's 'pay' array, do it here
    // (but based on previous instructions, CustomerAccount stores bill IDs, not payment IDs)

    res.status(201).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating payment", error: error.message });
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
