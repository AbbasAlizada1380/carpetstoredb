import { Sells, Category, Type } from "../../Models/index.js";

const syncSIncomeForType = async (typeId) => {
  if (!typeId) return;
  const categories = await Category.findAll({
    where: { typeId },
    attributes: ['id'],
  });
  const categoryIds = categories.map(c => c.id);
  if (categoryIds.length === 0) {
    await Type.update({ SIncome: [] }, { where: { id: typeId } });
    return;
  }
  const sells = await Sells.findAll({
    where: { Category: categoryIds },
    attributes: ['id'],
    order: [['id', 'ASC']],
  });
  const sellIds = sells.map(s => s.id);
  await Type.update({ SIncome: sellIds }, { where: { id: typeId } });
};

// ========== CREATE ==========
export const createSell = async (req, res) => {
  try {
    let { Category: categoryId, unit_price, amount, receipt, remaind, customer } = req.body;

    if (!categoryId || !unit_price || !amount || !customer) {
      return res.status(400).json({ message: "Missing required fields: Category, unit_price, amount, customer name" });
    }

    const category = await Category.findByPk(categoryId, { include: [{ model: Type, as: "type" }] });
    if (!category) return res.status(400).json({ message: "Category not found" });
    const typeId = category.type?.id;
    if (!typeId) return res.status(400).json({ message: "Category has no associated Type" });

    const total = unit_price * amount;
    receipt = receipt || 0;
    remaind = remaind !== undefined ? remaind : total - receipt;

    const newSell = await Sells.create({
      Category: categoryId,
      unit_price,
      amount,
      total,
      receipt,
      remaind,
      customer: customer.trim(),   // store name directly
    });

    await syncSIncomeForType(typeId);

    const created = await Sells.findByPk(newSell.id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
      ],
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ALL ==========
export const getAllSells = async (req, res) => {
  try {
    const sells = await Sells.findAll({
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(sells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== READ ONE ==========
export const getSellById = async (req, res) => {
  try {
    const { id } = req.params;
    const sell = await Sells.findByPk(id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
      ],
    });
    if (!sell) return res.status(404).json({ message: "Sell not found" });
    res.status(200).json(sell);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== UPDATE ==========
export const updateSell = async (req, res) => {
  try {
    const { id } = req.params;
    const { Category: newCategoryId, unit_price, amount, receipt, remaind, customer } = req.body;

    const sell = await Sells.findByPk(id);
    if (!sell) return res.status(404).json({ message: "Sell not found" });

    const oldCategory = await Category.findByPk(sell.Category, { include: [{ model: Type, as: "type" }] });
    const oldTypeId = oldCategory?.type?.id;

    let newTypeId = null;
    if (newCategoryId !== undefined && newCategoryId !== sell.Category) {
      const newCategory = await Category.findByPk(newCategoryId, { include: [{ model: Type, as: "type" }] });
      if (!newCategory) return res.status(400).json({ message: "New Category not found" });
      newTypeId = newCategory.type?.id;
      if (!newTypeId) return res.status(400).json({ message: "New Category has no associated Type" });
    }

    if (customer !== undefined) sell.customer = customer.trim();
    if (unit_price !== undefined) sell.unit_price = unit_price;
    if (amount !== undefined) sell.amount = amount;
    if (receipt !== undefined) sell.receipt = receipt;
    if (remaind !== undefined) sell.remaind = remaind;
    if (newCategoryId !== undefined) sell.Category = newCategoryId;

    if (unit_price !== undefined || amount !== undefined) {
      sell.total = sell.unit_price * sell.amount;
    }

    await sell.save();

    if (newTypeId !== null && newTypeId !== oldTypeId) {
      if (oldTypeId) await syncSIncomeForType(oldTypeId);
      if (newTypeId) await syncSIncomeForType(newTypeId);
    }

    const updated = await Sells.findByPk(id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
      ],
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========== DELETE ==========
export const deleteSell = async (req, res) => {
  try {
    const { id } = req.params;
    const sell = await Sells.findByPk(id);
    if (!sell) return res.status(404).json({ message: "Sell not found" });

    const category = await Category.findByPk(sell.Category, { include: [{ model: Type, as: "type" }] });
    const typeId = category?.type?.id;

    await sell.destroy();

    if (typeId) {
      await syncSIncomeForType(typeId);
    }

    res.status(200).json({ message: "Sell deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};