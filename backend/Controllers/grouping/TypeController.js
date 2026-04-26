import { Type, Category } from "../../Models/index.js";

// ========== CREATE ==========
export const createType = async (req, res) => {
  try {
    const { name, categories = [] } = req.body;
    const newType = await Type.create({ name, categories });
    res.status(201).json(newType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ (all) ==========
export const getAllTypes = async (req, res) => {
  try {
    const types = await Type.findAll({
      include: [{ model: Category, as: "categoryList" }], // optional: include related categories
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
    const { name, categories } = req.body;

    const type = await Type.findByPk(id);
    if (!type) {
      return res.status(404).json({ message: "Type not found" });
    }

    // Update only provided fields
    if (name !== undefined) type.name = name;
    if (categories !== undefined) type.categories = categories;

    await type.save();

    // Optionally fetch updated record with associations
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

    // Optional: check if any Category references this Type (part field)
    const linkedCategories = await Category.count({ where: { part: id } });
    if (linkedCategories > 0) {
      return res.status(400).json({
        message: `Cannot delete Type because it is referenced by ${linkedCategories} Category(ies). Remove associations first.`
      });
    }

    await type.destroy();
    res.status(200).json({ message: "Type deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};