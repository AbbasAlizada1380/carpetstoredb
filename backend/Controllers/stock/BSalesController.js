// controllers/stock/BSalesController.js
import {
  BSales,
  Category,
  Type,
  Buyer,
  bExist,
  BuyerAccount,
  Receipt,
  Bill,
  sequelize,
} from "../../Models/index.js";

// ─── HELPERS ──────────────────────────────────────────────────────────────

// (Optional) Sync BSales IDs to Type for blanket sales – similar to SIncome
// If you add a BSales JSON column to Type, you can implement this.
// For now, we skip it to keep it simple, but it can be added later.

const generateBillNumber = async () => {
  const lastBill = await Bill.findOne({
    order: [["id", "DESC"]],
    attributes: ["billNumber"],
  });
  let nextNumber = 1;
  if (lastBill && lastBill.billNumber) {
    const match = lastBill.billNumber.match(/\d+$/);
    if (match) nextNumber = parseInt(match[0]) + 1;
  }
  return `BBILL-${nextNumber.toString().padStart(6, "0")}`; // "BBILL" for blanket bills
};

// ─── CREATE ──────────────────────────────────────────────────────────────

export const createBSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let { bsales, buyerId, newBuyer, discount_amount = 0 } = req.body;

    // --- Input validation ---
    if (!bsales) {
      if (req.body.bexistId) bsales = [req.body];
      else return res.status(400).json({ message: "No bsales array provided" });
    }
    if (!Array.isArray(bsales) || bsales.length === 0) {
      return res.status(400).json({ message: "bsales must be a non‑empty array" });
    }
    if (!buyerId && !newBuyer) {
      return res.status(400).json({ message: "Either buyerId or newBuyer is required" });
    }

    const discountVal = parseFloat(discount_amount) || 0;

    // --- 1. Get or create buyer (within transaction) ---
    const createBuyer = async (name, transaction) => {
      const trimmed = name?.trim() || "Unknown Buyer";
      let existing = await Buyer.findOne({ where: { fullname: trimmed }, transaction });
      if (existing) return existing;
      return await Buyer.create({ fullname: trimmed, isActive: false }, { transaction });
    };

    let buyer = null;
    if (buyerId) {
      buyer = await Buyer.findByPk(buyerId, { transaction: t });
      if (!buyer) {
        const name = newBuyer && newBuyer.trim() ? newBuyer.trim() : `Buyer-${buyerId}`;
        buyer = await createBuyer(name, t);
      }
    } else if (newBuyer && newBuyer.trim()) {
      buyer = await createBuyer(newBuyer, t);
    } else {
      buyer = await createBuyer("Unknown Buyer", t);
    }
    const finalBuyerId = buyer.id;

    // --- 2. Process each blanket sale ---
    const createdBSales = [];
    let totalAmountSum = 0;
    let totalReceiptSum = 0;

    for (const saleData of bsales) {
      let { bexistId, quantity, unit_price, amount, receipt, remaind } = saleData;

      // Validations
      if (!bexistId || !quantity || !unit_price) {
        await t.rollback();
        return res.status(400).json({ message: "Missing required fields (bexistId, quantity, unit_price)" });
      }

      const qtyNum = parseFloat(quantity);
      const unitPriceNum = parseFloat(unit_price);
      const amountNum = parseFloat(amount);
      if (isNaN(qtyNum) || qtyNum <= 0 || isNaN(unitPriceNum) || unitPriceNum <= 0 || isNaN(amountNum) || amountNum <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid numeric values" });
      }

      const expectedAmount = qtyNum * unitPriceNum;
      if (Math.abs(amountNum - expectedAmount) > 0.01) {
        await t.rollback();
        return res.status(400).json({ message: "Amount mismatch" });
      }

      // ── Fetch bExist (blanket stock) ──
      const stock = await bExist.findByPk(bexistId, {
        include: [{ model: Category, as: "category" }],
        transaction: t,
      });
      if (!stock) {
        await t.rollback();
        return res.status(400).json({ message: "bExist record not found" });
      }

      // Check available quantity
      const availableQty = parseFloat(stock.quantity);
      if (availableQty < qtyNum) {
        await t.rollback();
        return res.status(400).json({ message: "Insufficient stock quantity" });
      }

      // Reduce stock
      const newQty = availableQty - qtyNum;
      await stock.update({ quantity: newQty }, { transaction: t });

      // (Optional) If stock reaches zero, you might move it to a "sold" list, but we keep it at 0.

      // Get category and type for any tracking (if needed)
      const category = await Category.findByPk(stock.categoryId, {
        include: [{ model: Type, as: "type" }],
        transaction: t,
      });
      // You can store typeId for later sync if you add a BSales array to Type.

      const receiptAmount = parseFloat(receipt) || 0;
      const finalRemaind = remaind !== undefined ? parseFloat(remaind) : amountNum - receiptAmount;

      // ── Create BSales record ──
      const newSale = await BSales.create(
        {
          categoryId: stock.categoryId,
          bexistId: stock.id,
          unit_price: unitPriceNum,
          quantity: qtyNum,
          receipt: receiptAmount,
          remaind: finalRemaind,
          total: amountNum,
          buyerId: finalBuyerId,
        },
        { transaction: t }
      );

      createdBSales.push(newSale);
      totalAmountSum += amountNum;
      totalReceiptSum += receiptAmount;

      // (Optional) Update bExist's "sold" array or something similar – not needed.
    }

    // --- 3. Apply discount and validate receipt ---
    if (discountVal > totalAmountSum) {
      await t.rollback();
      return res.status(400).json({ message: "Discount amount cannot exceed total invoice amount" });
    }

    const discountedTotal = totalAmountSum - discountVal;
    if (totalReceiptSum > discountedTotal + 0.01) {
      await t.rollback();
      return res.status(400).json({ message: "Receipt amount exceeds total after discount" });
    }

    // --- 4. Create Bill ---
    const billNumber = await generateBillNumber();
    const remainingAmount = discountedTotal - totalReceiptSum;
    let status = "unpaid";
    if (remainingAmount === 0) status = "paid";
    else if (totalReceiptSum > 0) status = "partial";

    const saleIds = createdBSales.map((s) => s.id);
    const newBill = await Bill.create(
      {
        billNumber,
        buyerId: finalBuyerId,
        date: new Date(),
        totalAmount: totalAmountSum,
        paidAmount: totalReceiptSum,
        remainingAmount,
        status,
        notes: null,
        discount_percent: 0,
        discounted_amount: discountVal,
        sells: [],                     // no carpet sells
        bsales: saleIds,
      },
      { transaction: t }
    );

    // --- 5. Update BuyerAccount ---
    let account = await BuyerAccount.findOne({
      where: { buyerId: finalBuyerId },
      transaction: t,
      lock: true,
    });
    if (!account) {
      account = await BuyerAccount.create(
        {
          buyerId: finalBuyerId,
          sellIds: [],
          remaindIds: [],
          receiptSaleIds: [],
          receiptIds: [],
          has_remaindIds: false,
        },
        { transaction: t }
      );
    }

    let sellIdsArr = account.sellIds || [];
    if (!sellIdsArr.includes(newBill.id)) sellIdsArr.push(newBill.id);
    let receiptSaleIdsArr = account.receiptSaleIds || [];
    let remaindIdsArr = account.remaindIds || [];

    if (status === "paid") {
      if (!receiptSaleIdsArr.includes(newBill.id)) receiptSaleIdsArr.push(newBill.id);
      remaindIdsArr = remaindIdsArr.filter((id) => id !== newBill.id);
    } else {
      if (!remaindIdsArr.includes(newBill.id)) remaindIdsArr.push(newBill.id);
      receiptSaleIdsArr = receiptSaleIdsArr.filter((id) => id !== newBill.id);
    }

    await account.update(
      {
        sellIds: sellIdsArr,
        remaindIds: remaindIdsArr,
        receiptSaleIds: receiptSaleIdsArr,
        has_remaindIds: remaindIdsArr.length > 0,
      },
      { transaction: t }
    );

    // --- 6. Create receipt (if any payment) ---
    let createdReceipt = null;
    if (totalReceiptSum > 0) {
      const receipt = await Receipt.create(
        {
          buyerId: finalBuyerId,
          amountofmoney: totalReceiptSum,
          description: `پرداخت برای فاکتور ${billNumber} (جمع کل ${totalAmountSum}؋، تخفیف ${discountVal}؋)`,
        },
        { transaction: t }
      );

      let receiptIdsArr = account.receiptIds || [];
      if (!receiptIdsArr.includes(receipt.id)) {
        receiptIdsArr.push(receipt.id);
        await account.update({ receiptIds: receiptIdsArr }, { transaction: t });
      }
      createdReceipt = receipt;
    }

    // --- 7. Commit ---
    await t.commit();

    // --- 8. Fetch detailed response ---
    const createdWithDetails = await BSales.findAll({
      where: { id: saleIds },
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
    });

    res.status(201).json({
      bsales: createdWithDetails,
      bill: newBill,
      receipt: createdReceipt,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error creating BSale:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────

export const getAllBSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await BSales.findAndCountAll({
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      data: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET ONE ──────────────────────────────────────────────────────────────

export const getBSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await BSales.findByPk(id, {
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
    });
    if (!sale) return res.status(404).json({ message: "BSale not found" });
    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────

export const updateBSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, bexistId, unit_price, quantity, receipt, remaind, buyerId, newBuyer } = req.body;

    const sale = await BSales.findByPk(id);
    if (!sale) return res.status(404).json({ message: "BSale not found" });

    // Handle buyer change if needed
    if (buyerId !== undefined || newBuyer !== undefined) {
      let finalBuyerId = sale.buyerId;
      try {
        if (buyerId) {
          const buyer = await Buyer.findByPk(buyerId);
          if (!buyer) throw new Error("Selected buyer does not exist");
          finalBuyerId = buyer.id;
        } else if (newBuyer && newBuyer.trim()) {
          const trimmed = newBuyer.trim();
          let buyer = await Buyer.findOne({ where: { fullname: trimmed } });
          if (!buyer) {
            buyer = await Buyer.create({ fullname: trimmed, isActive: false });
          }
          finalBuyerId = buyer.id;
        }
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      sale.buyerId = finalBuyerId;
    }

    // If bexistId changes, we need to handle stock adjustments
    let oldStock = null;
    if (bexistId !== undefined && bexistId !== sale.bexistId) {
      oldStock = await bExist.findByPk(sale.bexistId);
      const newStock = await bExist.findByPk(bexistId);
      if (!newStock) return res.status(400).json({ message: "New bExist record not found" });
      // We need to adjust stock quantities:
      // Add back sold quantity to old stock, subtract from new stock.
      // But this is complex; for simplicity we'll restrict this update or handle carefully.
      // We'll return an error for now – require using a dedicated adjustment endpoint.
      return res.status(400).json({ message: "Changing bexistId is not allowed; create a new sale instead." });
    }

    if (categoryId !== undefined) sale.categoryId = categoryId;
    if (unit_price !== undefined) sale.unit_price = unit_price;
    if (quantity !== undefined) sale.quantity = quantity;
    if (receipt !== undefined) sale.receipt = receipt;
    if (remaind !== undefined) sale.remaind = remaind;
    // Recalculate total if unit_price or quantity changed
    if (unit_price !== undefined || quantity !== undefined) {
      sale.total = sale.unit_price * sale.quantity;
    }

    await sale.save();

    const updated = await BSales.findByPk(id, {
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────

export const deleteBSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await BSales.findByPk(id);
    if (!sale) return res.status(404).json({ message: "BSale not found" });

    // Before deleting, we should restore the stock quantity (add back)
    // This is optional – we can either let admin handle manually or implement.
    // We'll add the quantity back to the associated bExist.
    const stock = await bExist.findByPk(sale.bexistId);
    if (stock) {
      const newQty = parseFloat(stock.quantity) + parseFloat(sale.quantity);
      await stock.update({ quantity: newQty });
    }

    await sale.destroy();
    res.status(200).json({ message: "BSale deleted successfully and stock restored" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};