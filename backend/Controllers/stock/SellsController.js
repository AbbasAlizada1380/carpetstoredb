import { Sells, Category, Type, Buyer, Income } from "../../Models/index.js";

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
    where: { categoryId: categoryIds },   // changed from Category to categoryId
    attributes: ['id'],
    order: [['id', 'ASC']],
  });
  const sellIds = sells.map(s => s.id);
  await Type.update({ SIncome: sellIds }, { where: { id: typeId } });
};

// Helper: Get or create buyer (no duplicates)
const getOrCreateBuyer = async (buyerId, newBuyerName) => {
  if (buyerId) {
    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) throw new Error("Selected buyer does not exist");
    return buyer.id;
  }
  if (newBuyerName && newBuyerName.trim()) {
    const trimmedName = newBuyerName.trim();
    // ✅ Try to find existing buyer first
    let buyer = await Buyer.findOne({ where: { fullname: trimmedName } });
    if (!buyer) {
      buyer = await Buyer.create({
        fullname: trimmedName,
        isActive: false,
      });
    }
    return buyer.id;
  }
  throw new Error("Either buyerId or newBuyer is required");
};

// ========== CREATE ==========
export const createSell = async (req, res) => {
  try {
    let { sells } = req.body; // Expect an array of sells

    // If the frontend sends a single object (not array), wrap it
    if (!Array.isArray(sells)) {
      sells = [req.body];
    }

    if (!sells.length) {
      return res.status(400).json({ message: "No sell records provided" });
    }

    // Extract common buyer info from the first sell (they should all be the same)
    const { buyerId, newBuyer } = sells[0];

    if (!buyerId && !newBuyer) {
      return res.status(400).json({ message: "Either buyerId or newBuyer is required" });
    }

    // Get or create buyer ONCE
    let finalBuyerId;
    try {
      finalBuyerId = await getOrCreateBuyer(buyerId, newBuyer);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const createdSells = [];

    for (const sellData of sells) {
      let { categoryId, incomeId, amount, unit_price, receipt, remaind } = sellData;

      if (!categoryId || !incomeId || !unit_price || !amount) {
        return res.status(400).json({ message: "Missing required fields in one of the sell entries" });
      }

      const category = await Category.findByPk(categoryId, { include: [{ model: Type, as: "type" }] });
      if (!category) return res.status(400).json({ message: `Category not found for ID ${categoryId}` });
      const typeId = category.type?.id;
      if (!typeId) return res.status(400).json({ message: `Category ${categoryId} has no associated Type` });

      const income = await Income.findByPk(incomeId);
      if (!income) return res.status(400).json({ message: `Income not found for ID ${incomeId}` });
      if (income.categoryId !== parseInt(categoryId)) {
        return res.status(400).json({ message: `Income ${incomeId} does not belong to category ${categoryId}` });
      }

      const total = unit_price * amount;
      receipt = receipt || 0;
      remaind = remaind !== undefined ? remaind : total - receipt;

      const newSell = await Sells.create({
        categoryId,
        incomeId,
        unit_price,
        amount,
        total,
        receipt,
        remaind,
        buyerId: finalBuyerId,
      });

      createdSells.push(newSell);

      // Update Type.SIncome after each sell (or after loop to reduce DB calls)
      await syncSIncomeForType(typeId);
    }

    // Optionally fetch all created sells with associations
    const createdWithDetails = await Sells.findAll({
      where: { id: createdSells.map(s => s.id) },
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Income, as: "income" },
        { model: Buyer, as: "buyer" },
      ],
    });

    res.status(201).json(createdWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// ... rest of your existing functions (getAllSells, getSellById, updateSell, deleteSell) 
// need similar adjustments to handle incomeId and ensure associations are correct.
// ========== READ ALL ==========
export const getAllSells = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch paginated sells
    const { count, rows } = await Sells.findAndCountAll({
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
      ],
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset,
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      data: rows,
      totalItems: count,
      totalPages: totalPages,
      currentPage: page,
    });
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
        { model: Buyer, as: "buyer" },
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
    const { Category: newCategoryId, unit_price, amount, receipt, remaind, buyerId, newBuyer } = req.body;

    const sell = await Sells.findByPk(id);
    if (!sell) return res.status(404).json({ message: "Sell not found" });

    // Handle buyer change
    let finalBuyerId = sell.buyerId;
    if (buyerId !== undefined || newBuyer !== undefined) {
      try {
        finalBuyerId = await getOrCreateBuyer(buyerId, newBuyer);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      sell.buyerId = finalBuyerId;
    }

    const oldCategory = await Category.findByPk(sell.Category, { include: [{ model: Type, as: "type" }] });
    const oldTypeId = oldCategory?.type?.id;

    let newTypeId = null;
    if (newCategoryId !== undefined && newCategoryId !== sell.Category) {
      const newCategory = await Category.findByPk(newCategoryId, { include: [{ model: Type, as: "type" }] });
      if (!newCategory) return res.status(400).json({ message: "New Category not found" });
      newTypeId = newCategory.type?.id;
      if (!newTypeId) return res.status(400).json({ message: "New Category has no associated Type" });
      sell.Category = newCategoryId;
    }

    // Update other fields
    if (unit_price !== undefined) sell.unit_price = unit_price;
    if (amount !== undefined) sell.amount = amount;
    if (receipt !== undefined) sell.receipt = receipt;
    if (remaind !== undefined) sell.remaind = remaind;

    // Recalculate total if price or amount changed
    if (unit_price !== undefined || amount !== undefined) {
      sell.total = sell.unit_price * sell.amount;
    }

    await sell.save();

    // Sync SIncome for affected types
    if (newTypeId !== null && newTypeId !== oldTypeId) {
      if (oldTypeId) await syncSIncomeForType(oldTypeId);
      if (newTypeId) await syncSIncomeForType(newTypeId);
    }

    const updated = await Sells.findByPk(id, {
      include: [
        { model: Category, as: "categoryDetail", include: [{ model: Type, as: "type" }] },
        { model: Buyer, as: "buyer" },
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