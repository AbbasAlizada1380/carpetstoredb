import OtherIncome from "../../Models/Finance/OtherIncome.js";
import { Op } from "sequelize";

// Helper validation (optional)
const validateAmount = (amount) => {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Amount must be a positive number");
};

// CREATE a new other income record
export const createOtherIncome = async (req, res) => {
  try {
    const { amount, for: purpose, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }
    if (!purpose) {
      return res.status(400).json({ error: "Purpose/for field is required" });
    }

    const income = await OtherIncome.create({
      amount,
      for: purpose,
      description: description || null,
    });

    res.status(201).json({ success: true, data: income });
  } catch (error) {
    console.error("Error creating other income:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET all other incomes (with optional pagination & search)
export const getOtherIncomes = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { for: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);

    const { count, rows } = await OtherIncome.findAndCountAll({
      where,
      offset,
      limit: pageLimit,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / pageLimit);

    res.status(200).json({
      success: true,
      data: rows,
      meta: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: pageLimit,
      },
    });
  } catch (error) {
    console.error("Error fetching other incomes:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET a single other income by ID
export const getOtherIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await OtherIncome.findByPk(id);
    if (!income) {
      return res.status(404).json({ error: "Other income record not found" });
    }
    res.status(200).json({ success: true, data: income });
  } catch (error) {
    console.error("Error fetching other income:", error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE an other income record
export const updateOtherIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, for: purpose, description } = req.body;

    const income = await OtherIncome.findByPk(id);
    if (!income) {
      return res.status(404).json({ error: "Other income record not found" });
    }

    if (amount !== undefined) {
      try {
        validateAmount(amount);
        income.amount = parseFloat(amount);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    if (purpose !== undefined) income.for = purpose;
    if (description !== undefined) income.description = description;

    await income.save();

    res.status(200).json({ success: true, data: income });
  } catch (error) {
    console.error("Error updating other income:", error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE an other income record
export const deleteOtherIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await OtherIncome.findByPk(id);
    if (!income) {
      return res.status(404).json({ error: "Other income record not found" });
    }

    await income.destroy();
    res.status(200).json({ success: true, message: "Other income deleted successfully" });
  } catch (error) {
    console.error("Error deleting other income:", error);
    res.status(500).json({ error: error.message });
  }
};

// ========== REPORT CONTROLLER (date‑range & summary) ==========
export const getOtherIncomeReport = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const where = {};

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

    // Get paginated records
    const { count, rows } = await OtherIncome.findAndCountAll({
      where,
      offset,
      limit: pageLimit,
      order: [["createdAt", "DESC"]],
    });

    // Get totals (without pagination limits)
    const totalAmountResult = await OtherIncome.findAll({
      where,
      attributes: [[OtherIncome.sequelize.fn("SUM", OtherIncome.sequelize.col("amount")), "totalAmount"]],
      raw: true,
    });
    const totalAmount = parseFloat(totalAmountResult[0]?.totalAmount || 0);

    const totalPages = Math.ceil(count / pageLimit);

    res.status(200).json({
      success: true,
      data: rows,
      summary: {
        totalRecords: count,
        totalAmount,
      },
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: pageLimit,
      },
    });
  } catch (error) {
    console.error("Error generating other income report:", error);
    res.status(500).json({ error: error.message });
  }
};