// controllers/stock/bExistController.js
import { bExist, Category } from "../../Models/index.js";
import sequelize from "../../dbconnection.js";

// ─── Helper: attach computed totalValue ──────────────────────────────────
const attachTotalValue = (instance) => {
  const qty = parseFloat(instance.quantity) || 0;
  const price = parseFloat(instance.unitPrice) || 0;
  instance.dataValues.totalValue = Math.round((qty * price) * 100) / 100;
  return instance;
};

// ─── CREATE ────────────────────────────────────────────────────────────────
export const createBExist = async (req, res) => {
  try {
    const { categoryId, quantity, unitPrice } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: "categoryId is required" });
    }

    // Check if category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check if stock record already exists for this category
    const existing = await bExist.findOne({ where: { categoryId } });
    if (existing) {
      return res.status(400).json({ message: "Stock record for this category already exists. Use PUT to update." });
    }

    const newStock = await bExist.create({
      categoryId,
      quantity: quantity || 0,
      unitPrice: unitPrice || 0,
    });

    const data = attachTotalValue(newStock).dataValues;
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Error creating bExist:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET ALL (with pagination & category filter) ──────────────────────────
export const getAllBExist = async (req, res) => {
  try {
    const { categoryId, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const effectiveLimit = Math.min(limitNumber, 100);
    const offset = (pageNumber - 1) * effectiveLimit;

    const whereClause = {};
    if (categoryId) whereClause.categoryId = categoryId;

    const { count, rows } = await bExist.findAndCountAll({
      where: whereClause,
      include: [{ model: Category, as: "category" }],
      order: [["createdAt", "DESC"]],
      limit: effectiveLimit,
      offset,
    });

    const dataWithTotal = rows.map((item) => attachTotalValue(item).dataValues);
    const totalPages = Math.ceil(count / effectiveLimit);

    res.status(200).json({
      success: true,
      data: dataWithTotal,
      pagination: {
        currentPage: pageNumber,
        limit: effectiveLimit,
        totalItems: count,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching bExist:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET BY ID ──────────────────────────────────────────────────────────────
export const getBExistById = async (req, res) => {
  try {
    const { id } = req.params;
    const stock = await bExist.findByPk(id, {
      include: [{ model: Category, as: "category" }],
    });

    if (!stock) {
      return res.status(404).json({ message: "Stock record not found" });
    }

    const data = attachTotalValue(stock).dataValues;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── UPDATE ─────────────────────────────────────────────────────────────────
export const updateBExist = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, unitPrice } = req.body;

    const stock = await bExist.findByPk(id);
    if (!stock) {
      return res.status(404).json({ message: "Stock record not found" });
    }

    if (quantity !== undefined) stock.quantity = parseFloat(quantity);
    if (unitPrice !== undefined) stock.unitPrice = parseFloat(unitPrice);

    await stock.save();

    const data = attachTotalValue(stock).dataValues;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── DELETE ─────────────────────────────────────────────────────────────────
export const deleteBExist = async (req, res) => {
  try {
    const { id } = req.params;
    const stock = await bExist.findByPk(id);
    if (!stock) {
      return res.status(404).json({ message: "Stock record not found" });
    }

    await stock.destroy();
    res.status(200).json({ success: true, message: "Stock record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET TOTAL VALUE PER CATEGORY (or overall) ────────────────────────────
export const getStockValue = async (req, res) => {
  try {
    const { categoryId } = req.query;

    // Build where clause
    const whereClause = {};
    if (categoryId) whereClause.categoryId = categoryId;

    // Fetch stock records with category
    const stocks = await bExist.findAll({
      where: whereClause,
      include: [{ model: Category, as: "category" }],
    });

    // Compute value for each and aggregate
    const result = stocks.map((stock) => {
      const qty = parseFloat(stock.quantity) || 0;
      const price = parseFloat(stock.unitPrice) || 0;
      const totalValue = qty * price;
      return {
        categoryId: stock.categoryId,
        categoryName: stock.category ? stock.category.name : null,
        quantity: qty,
        unitPrice: price,
        totalValue: Math.round(totalValue * 100) / 100,
      };
    });

    // If categoryId is provided, return single object or array with one element
    if (categoryId && result.length === 0) {
      return res.status(404).json({ message: "No stock found for this category" });
    }

    // Overall summary (sum of all values)
    const overallTotal = result.reduce((sum, item) => sum + item.totalValue, 0);

    res.status(200).json({
      success: true,
      data: result,
      summary: {
        totalCategories: result.length,
        overallValue: Math.round(overallTotal * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error computing stock value:", error);
    res.status(500).json({ error: error.message });
  }
};