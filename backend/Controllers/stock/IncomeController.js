import { Income } from "../../Models/index.js"; // adjust import path as needed

// Helper: Calculate length from area and width
const calculateLength = (area, width) => {
  if (!area || !width || width === 0) return null;
  return area / width;
};

// ========== CREATE ==========
export const createIncome = async (req, res) => {
  try {
    let { width, color, degree, lotNumber, area } = req.body;

    // Validation
    if (!width || width <= 0) {
      return res.status(400).json({ message: "Width must be a positive number" });
    }
    if (!area || area <= 0) {
      return res.status(400).json({ message: "Area must be a positive number" });
    }
    if (!color) return res.status(400).json({ message: "Color is required" });
    if (!lotNumber) return res.status(400).json({ message: "Lot number is required" });

    // Check unique lotNumber
    const existing = await Income.findOne({ where: { lotNumber } });
    if (existing) {
      return res.status(400).json({ message: "Lot number already exists" });
    }

    // Calculate length
    const length = calculateLength(area, width);
    if (!length) {
      return res.status(400).json({ message: "Could not calculate length from area and width" });
    }

    const newIncome = await Income.create({
      width,
      color,
      degree: degree || null,
      lotNumber,
      area,
      length,
    });

    res.status(201).json(newIncome);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ALL ==========
export const getAllIncomes = async (req, res) => {
  try {
    const incomes = await Income.findAll({
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(incomes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ONE ==========
export const getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await Income.findByPk(id);
    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }
    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== UPDATE ==========
export const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { width, color, degree, lotNumber, area } = req.body;

    const income = await Income.findByPk(id);
    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    // Update fields if provided
    if (width !== undefined) income.width = width;
    if (color !== undefined) income.color = color;
    if (degree !== undefined) income.degree = degree;
    if (lotNumber !== undefined) income.lotNumber = lotNumber;
    if (area !== undefined) income.area = area;

    // If width or area changed, recalculate length
    if ((width !== undefined && width > 0) || (area !== undefined && area > 0)) {
      const finalWidth = width !== undefined ? width : income.width;
      const finalArea = area !== undefined ? area : income.area;
      if (finalWidth > 0 && finalArea > 0) {
        income.length = finalArea / finalWidth;
      } else {
        return res.status(400).json({ message: "Width and area must be positive to recalculate length" });
      }
    }

    // If lotNumber changed, check uniqueness
    if (lotNumber !== undefined && lotNumber !== income.lotNumber) {
      const existing = await Income.findOne({ where: { lotNumber } });
      if (existing) {
        return res.status(400).json({ message: "Lot number already exists" });
      }
    }

    await income.save();

    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== DELETE ==========
export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await Income.findByPk(id);
    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    await income.destroy();
    res.status(200).json({ message: "Income record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};