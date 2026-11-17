import { Category, Type, Income } from "../../Models/index.js";
import { Op } from "sequelize";

// Helper: Sync the categories JSON array of a Type based on its related Category records
const syncTypeCategories = async (typeId) => {
  if (!typeId) return;
  const id = parseInt(typeId, 10);
  const categories = await Category.findAll({
    where: { typeId: id },   // correct field name
    attributes: ['id']
  });
  const categoryIds = categories.map(cat => cat.id);
  await Type.update(
    { categories: categoryIds },
    { where: { id: id } }
  );
};

// ========== CREATE ==========
export const createCategory = async (req, res) => {
  try {
    let { name, type } = req.body;

    let typeId = null;
    if (type) {
      typeId = parseInt(type, 10);
      const typeExists = await Type.findByPk(typeId);
      if (!typeExists) {
        return res.status(400).json({ message: "Type with given 'type' id does not exist" });
      }
    }

    const newCategory = await Category.create({ name, typeId });

    if (typeId) {
      await syncTypeCategories(typeId);
    }

    const categoryWithType = await Category.findByPk(newCategory.id, {
      include: [{ model: Type, as: "type" }]   // alias from association
    });
    res.status(201).json(categoryWithType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ALL ==========
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [{ model: Type, as: "type" }],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ONE ==========
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id, {
      include: [{ model: Type, as: "type" }]
    });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== UPDATE ==========
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, type } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const oldTypeId = category.typeId;

    let newTypeId = null;
    if (type !== undefined) {
      if (type === null || type === "") {
        newTypeId = null;
      } else {
        newTypeId = parseInt(type, 10);
        const typeExists = await Type.findByPk(newTypeId);
        if (!typeExists) {
          return res.status(400).json({ message: "New 'type' Type does not exist" });
        }
      }
    }

    if (name !== undefined) category.name = name;
    if (type !== undefined) category.typeId = newTypeId;

    await category.save();

    if (oldTypeId !== newTypeId) {
      if (oldTypeId) await syncTypeCategories(oldTypeId);
      if (newTypeId) await syncTypeCategories(newTypeId);
    }

    const updatedCategory = await Category.findByPk(id, {
      include: [{ model: Type, as: "type" }]
    });
    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== DELETE ==========
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const typeId = category.typeId;

    await category.destroy();

    if (typeId) {
      await syncTypeCategories(typeId);
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== HELPER: Remove zero-area income IDs from category EIncome ==========
export const removeZeroAreaIncomesFromCategory = async (incomes, categoryId = null) => {
  // Filter incomes that have area === 0 (handle number and string)
  const zeroAreaIncomes = (incomes || []).filter(
    (inc) => Number(inc.area) === 0
  );

  if (zeroAreaIncomes.length === 0) return { removed: 0, categories: [] };

  const zeroAreaIds = zeroAreaIncomes.map((inc) => inc.id);

  // Group zero-area income ids by the category they belong to.
  // Use the passed categoryId if provided, otherwise infer from income.categoryId (if exists).
  const categoryIds = categoryId
    ? [categoryId]
    : [...new Set(zeroAreaIncomes.map((inc) => inc.categoryId).filter(Boolean))];

  const updatedCategories = [];

  for (const catId of categoryIds) {
    const category = await Category.findByPk(catId);
    if (!category) continue;

    let incomeIds = category.EIncome;
    if (typeof incomeIds === "string") incomeIds = JSON.parse(incomeIds);
    if (!Array.isArray(incomeIds)) continue;

    const filteredIds = incomeIds.filter(
      (id) => !zeroAreaIds.includes(id)
    );

    if (filteredIds.length !== incomeIds.length) {
      category.EIncome = filteredIds;
      await category.save();
      updatedCategories.push(catId);
    }
  }

  return { removed: zeroAreaIds.length, categories: updatedCategories };
};
// ========== GET INCOMES BY CATEGORY ID ==========
// ========== GET INCOMES BY CATEGORY ID ==========
export const getIncomesByCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Parse EIncome array (it's stored as JSON in DB)
    let incomeIds = category.EIncome;
    if (typeof incomeIds === "string") incomeIds = JSON.parse(incomeIds);
    if (!Array.isArray(incomeIds) || incomeIds.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch Income records
    let incomes = await Income.findAll({
      where: { id: incomeIds },
      order: [["createdAt", "DESC"]],
    });

    // Remove incomes with area === 0 from this category's EIncome
    const { removed } = await removeZeroAreaIncomesFromCategory(incomes, id);

    if (removed > 0) {
      // Re-fetch the category to get the updated EIncome
      const updatedCategory = await Category.findByPk(id);
      let updatedIds = updatedCategory.EIncome;
      if (typeof updatedIds === "string") updatedIds = JSON.parse(updatedIds);
      if (!Array.isArray(updatedIds)) updatedIds = [];

      incomes = updatedIds.length
        ? await Income.findAll({
          where: { id: updatedIds },
          order: [["createdAt", "DESC"]],
        })
        : [];
    }

    res.status(200).json(incomes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



export const getCategoryReports = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [
        {
          model: Type,
          as: "type",
          attributes: ["id", "name"],
        },
      ],
      order: [["id", "ASC"]],
    });

    if (!categories.length) {
      return res.status(200).json({
        categories: [],
        totalStockValue: 0,
        totals: { afn: 0, usd: 0, afnEquivalent: 0 },
      });
    }

    const reports = await Promise.all(
      categories
        .filter((category) => {
          const eIncome = Array.isArray(category.EIncome)
            ? category.EIncome
            : [];
          return eIncome.length > 0;
        })
        .map(async (category) => {
          const existingIds = Array.isArray(category.EIncome)
            ? category.EIncome.map((id) => Number(id))
            : [];

          let existingIncomes = [];
          if (existingIds.length) {
            existingIncomes = await Income.findAll({
              where: { id: { [Op.in]: existingIds } },
              order: [["id", "ASC"]],
            });
          }

          // ─── Sum stock value per currency + AFN-equivalent ─────────
          let afnStockValue = 0;
          let usdStockValue = 0;
          let afnEquiv = 0;

          for (const income of existingIncomes) {
            const price = parseFloat(income.unit_price) || 0;
            const area = parseFloat(income.area) || 0;
            const rowValue = price * area;

            const isAfn = !!income.isAfn;
            const dv = parseFloat(income.DV) > 0 ? parseFloat(income.DV) : 65;

            if (isAfn) {
              afnStockValue += rowValue;
              afnEquiv += rowValue; // already in AFN
            } else {
              usdStockValue += rowValue;
              afnEquiv += rowValue * dv; // USD → AFN using this row's DV
            }
          }

          const categoryAfn = Math.round(afnStockValue * 100) / 100;
          const categoryUsd = Math.round(usdStockValue * 100) / 100;
          const categoryAfnEquiv = Math.round(afnEquiv * 100) / 100;

          return {
            id: category.id,
            name: category.name,
            type: category.type || null,
            existingIncomes: existingIncomes.map((i) => i.toJSON()),
            summary: {
              totalExistingIncomes: existingIncomes.length,
              stockValueAfn: categoryAfn,
              stockValueUsd: categoryUsd,
              stockValueAfnEquivalent: categoryAfnEquiv,
              // Legacy field — now = AFN-equivalent
              totalStockValue: categoryAfnEquiv,
            },
          };
        })
    );

    let grandAfn = 0;
    let grandUsd = 0;
    let grandAfnEquiv = 0;

    for (const r of reports) {
      grandAfn += r.summary.stockValueAfn || 0;
      grandUsd += r.summary.stockValueUsd || 0;
      grandAfnEquiv += r.summary.stockValueAfnEquivalent || 0;
    }

    res.status(200).json({
      categories: reports,
      totalStockValue: Math.round(grandAfnEquiv * 100) / 100,
      totals: {
        afn: Math.round(grandAfn * 100) / 100,
        usd: Math.round(grandUsd * 100) / 100,
        afnEquivalent: Math.round(grandAfnEquiv * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error in getCategoryReports:", error);
    res.status(500).json({ error: error.message });
  }
};