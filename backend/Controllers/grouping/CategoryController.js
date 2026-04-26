import { Category, Type } from "../../Models/index.js";

// Helper: Sync the categories array of a Type based on its related Category records
const syncTypeCategories = async (typeId) => {
  if (!typeId) return;
  const categories = await Category.findAll({
    where: { type: typeId },
    attributes: ['id'] // store IDs; change to 'name' if you prefer names
  });
  const categoryIds = categories.map(cat => cat.id);
  await Type.update(
    { categories: categoryIds },
    { where: { id: typeId } }
  );
};

// ========== CREATE ==========
export const createCategory = async (req, res) => {
  try {
    const { name, type } = req.body;

    // Check if the referenced Type exists
    if (type) {
      const typeExists = await Type.findByPk(type);
      if (!typeExists) {
        return res.status(400).json({ message: "Type with given 'type' id does not exist" });
      }
    }

    const newCategory = await Category.create({ name, type });

    // ✅ Sync the Type's categories array (add the new category)
    await syncTypeCategories(type);

    // Optionally return the category with its Type
    const categoryWithType = await Category.findByPk(newCategory.id, {
      include: [{ model: Type, as: "parentType" }]
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
      include: [{ model: Type, as: "parentType" }],
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
      include: [{ model: Type, as: "parentType" }]
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
    const { name, type } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const oldTypeId = category.type;

    // If type is being updated, verify the new Type exists
    if (type !== undefined && type !== oldTypeId) {
      const typeExists = await Type.findByPk(type);
      if (!typeExists) {
        return res.status(400).json({ message: "New 'type' Type does not exist" });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (type !== undefined) category.type = type;

    await category.save();

    // ✅ Sync the old Type's categories (removal)
    if (type !== undefined && type !== oldTypeId && oldTypeId) {
      await syncTypeCategories(oldTypeId);
    }
    // ✅ Sync the new Type's categories (addition)
    if (type !== undefined && type !== oldTypeId && type) {
      await syncTypeCategories(type);
    }

    // If only name changed and type stayed same, still need to sync? No, categories array unchanged.
    // But if we store names, we might; here we store IDs so no need.

    const updatedCategory = await Category.findByPk(id, {
      include: [{ model: Type, as: "parentType" }]
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

    const typeId = category.type;

    await category.destroy();

    // ✅ Sync the Type's categories array (remove this category)
    if (typeId) {
      await syncTypeCategories(typeId);
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};