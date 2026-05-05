import Customer from "../../Models/customer/Customers.js";
import { Income, Type, Category } from "../../Models/index.js";

// ======================= HELPERS =======================

// Calculate length from area and width
const calculateLength = (area, width) => {
  if (!area || !width || width === 0) return null;
  return area / width;
};

// Add income ID to Category.EIncome array (fixed version)
const addIncomeToCategoryEIncome = async (categoryId, incomeId) => {
  if (!categoryId || !incomeId) return;

  const sequelize = Category.sequelize;
  // Raw SQL to append incomeId to the JSON array, creating the array if it doesn't exist
  await sequelize.query(
    `UPDATE Categories 
     SET EIncome = JSON_ARRAY_APPEND(COALESCE(EIncome, JSON_ARRAY()), '$', :incomeId) 
     WHERE id = :categoryId`,
    {
      replacements: { categoryId, incomeId },
      type: sequelize.QueryTypes.UPDATE
    }
  );
  console.log(`✅ Raw SQL updated EIncome for category ${categoryId}, added income ${incomeId}`);
};

const removeIncomeFromCategoryEIncome = async (categoryId, incomeId) => {
  if (!categoryId || !incomeId) return;
  const category = await Category.findByPk(categoryId);
  if (!category) return;

  let eIncomeArray = category.EIncome;
  if (typeof eIncomeArray === "string") eIncomeArray = JSON.parse(eIncomeArray);
  if (!Array.isArray(eIncomeArray)) return;

  const newArray = eIncomeArray.filter(id => id !== incomeId);
  await category.update({ EIncome: newArray });
};

// ======================= CREATE =======================
export const createIncome = async (req, res) => {
  try {
    let { width, color, degree, lotNumber, area, customerId, newCustomer, typeId, categoryId } = req.body;

    // Validation same as before...
    if (!width || width <= 0) return res.status(400).json({ message: "Width must be a positive number" });
    if (!area || area <= 0) return res.status(400).json({ message: "Area must be a positive number" });
    if (!color) return res.status(400).json({ message: "Color is required" });
    if (!lotNumber) return res.status(400).json({ message: "Lot number is required" });
    if (!customerId && !newCustomer) return res.status(400).json({ message: "Either customerId or newCustomer is required" });
    if (!typeId) return res.status(400).json({ message: "Type ID is required" });
    if (!categoryId) return res.status(400).json({ message: "Category ID is required" });

    const existing = await Income.findOne({ where: { lotNumber } });
    if (existing) return res.status(400).json({ message: "Lot number already exists" });

    const typeExists = await Type.findByPk(typeId);
    if (!typeExists) return res.status(400).json({ message: "Invalid Type ID" });
    const categoryExists = await Category.findByPk(categoryId);
    if (!categoryExists) return res.status(400).json({ message: "Invalid Category ID" });

    const length = calculateLength(area, width);
    if (!length) return res.status(400).json({ message: "Could not calculate length from area and width" });

    let finalCustomerId = null;
    if (customerId) {
      const customer = await Customer.findByPk(customerId);
      if (!customer) return res.status(400).json({ message: "Provided customerId does not exist" });
      finalCustomerId = customer.id;
    } else if (newCustomer) {
      const newCust = await Customer.create({ fullname: newCustomer.trim(), isActive: false });
      finalCustomerId = newCust.id;
    }

    const newIncome = await Income.create({
      width,
      color,
      degree: degree || null,
      lotNumber,
      area,
      length,
      customerId: finalCustomerId,
      typeId,
      categoryId,
    });

    // ✅ Add income ID to Category.EIncome
    await addIncomeToCategoryEIncome(categoryId, newIncome.id);

    const freshCategory = await Category.findByPk(categoryId);
    console.log("After update, DB value of EIncome:", freshCategory.EIncome);
    res.status(201).json(newIncome);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= READ ALL (with pagination) =======================
export const getAllIncomes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Income.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      items: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= READ ONE =======================
export const getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await Income.findByPk(id);
    if (!income) return res.status(404).json({ message: "Income record not found" });
    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= UPDATE =======================
export const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { width, color, degree, lotNumber, area, categoryId } = req.body;

    const income = await Income.findByPk(id);
    if (!income) return res.status(404).json({ message: "Income record not found" });

    const oldCategoryId = income.categoryId;
    let newCategoryId = categoryId;

    // Update fields if provided
    if (width !== undefined) income.width = width;
    if (color !== undefined) income.color = color;
    if (degree !== undefined) income.degree = degree;
    if (lotNumber !== undefined) income.lotNumber = lotNumber;
    if (area !== undefined) income.area = area;
    if (newCategoryId !== undefined) income.categoryId = newCategoryId;

    // Recalculate length if width or area changed
    if ((width !== undefined && width > 0) || (area !== undefined && area > 0)) {
      const finalWidth = width !== undefined ? width : income.width;
      const finalArea = area !== undefined ? area : income.area;
      if (finalWidth > 0 && finalArea > 0) {
        income.length = finalArea / finalWidth;
      } else {
        return res.status(400).json({ message: "Width and area must be positive to recalculate length" });
      }
    }

    // Check lotNumber uniqueness if changed
    if (lotNumber !== undefined && lotNumber !== income.lotNumber) {
      const existing = await Income.findOne({ where: { lotNumber } });
      if (existing) return res.status(400).json({ message: "Lot number already exists" });
    }

    await income.save();

    // If category changed, update EIncome arrays
    if (newCategoryId !== undefined && newCategoryId !== oldCategoryId) {
      if (oldCategoryId) await removeIncomeFromCategoryEIncome(oldCategoryId, id);
      if (newCategoryId) await addIncomeToCategoryEIncome(newCategoryId, id);
    }

    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= DELETE =======================
export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await Income.findByPk(id);
    if (!income) return res.status(404).json({ message: "Income record not found" });

    const categoryId = income.categoryId;

    await income.destroy();

    // Remove income ID from Category.EIncome
    if (categoryId) {
      await removeIncomeFromCategoryEIncome(categoryId, id);
    }

    res.status(200).json({ message: "Income record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};