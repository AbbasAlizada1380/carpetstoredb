import { Type, Category } from "../../Models/index.js";

// ========== CREATE ==========
export const createType = async (req, res) => {
  try {
    const { name, categoryIds = [] } = req.body; // now expects categoryIds array

    // Create the type
    const newType = await Type.create({ name });

    // If category IDs are provided, associate them by setting typeId on Category
    if (categoryIds.length > 0) {
      await Category.update(
        { typeId: newType.id },
        { where: { id: categoryIds } }
      );
    }

    // Fetch the created type with its associated categories
    const createdType = await Type.findByPk(newType.id, {
      include: [{ model: Category, as: "categoryList" }],
    });

    res.status(201).json(createdType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ (all) ==========
export const getAllTypes = async (req, res) => {
  try {
    const types = await Type.findAll({
      include: [{ model: Category, as: "categoryList" }],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ (single by id) ==========
export const getTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await Type.findByPk(id, {
      include: [{ model: Category, as: "categoryList" }],
    });
    if (!type) {
      return res.status(404).json({ message: "Type not found" });
    }
    res.status(200).json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== UPDATE ==========
export const updateType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryIds } = req.body;

    const type = await Type.findByPk(id);
    if (!type) {
      return res.status(404).json({ message: "Type not found" });
    }

    // Update name if provided
    if (name !== undefined) type.name = name;
    await type.save();

    // Update category associations if provided
    if (categoryIds !== undefined) {
      // First, remove current associations (set typeId to NULL for categories that belong to this type)
      await Category.update(
        { typeId: null },
        { where: { typeId: type.id } }
      );
      // Then assign new associations
      if (categoryIds.length > 0) {
        await Category.update(
          { typeId: type.id },
          { where: { id: categoryIds } }
        );
      }
    }

    // Fetch updated type with categories
    const updatedType = await Type.findByPk(id, {
      include: [{ model: Category, as: "categoryList" }],
    });

    res.status(200).json(updatedType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== DELETE ==========
export const deleteType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await Type.findByPk(id);
    if (!type) {
      return res.status(404).json({ message: "Type not found" });
    }

    // Optionally, instead of deleting, you might want to set typeId = NULL or use ON DELETE SET NULL
    // But if you want to delete, first unlink all categories:
    await Category.update(
      { typeId: null },
      { where: { typeId: type.id } }
    );

    await type.destroy();
    res.status(200).json({ message: "Type deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== GET CATEGORIES BY TYPE ID ==========
// Simplified using the association
export const getTypeCategories = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await Type.findByPk(id, {
      include: [{ model: Category, as: "categoryList" }],
    });
    if (!type) {
      return res.status(404).json({ message: "Type not found" });
    }

    // The associated categories are available in type.categoryList
    res.status(200).json(type.categoryList || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};