import { Category, Type,Income } from "../../Models/index.js";

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

// Add to your category controller file

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
    if (typeof incomeIds === 'string') incomeIds = JSON.parse(incomeIds);
    if (!Array.isArray(incomeIds) || incomeIds.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch Income records
    const incomes = await Income.findAll({
      where: { id: incomeIds },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(incomes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};