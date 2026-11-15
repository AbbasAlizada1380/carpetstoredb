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
  return `BBILL-${nextNumber.toString().padStart(6, "0")}`;
};

// ─── NEW: per-sale currency parse ────────────────────────────────────────
const parseDvAndIsAfn = (entry, index) => {
  let dv = 0;
  if (entry.DV !== undefined && entry.DV !== null && entry.DV !== "") {
    const parsedDv = parseFloat(entry.DV);
    if (!Number.isFinite(parsedDv)) {
      throw new Error(`BSale ${index + 1}: DV must be a valid number`);
    }
    dv = parsedDv;
  }

  let isAfn = false;
  if (entry.isAfn !== undefined && entry.isAfn !== null && entry.isAfn !== "") {
    if (typeof entry.isAfn === "boolean") isAfn = entry.isAfn;
    else if (entry.isAfn === 1 || entry.isAfn === "1" || entry.isAfn === "true") isAfn = true;
    else if (entry.isAfn === 0 || entry.isAfn === "0" || entry.isAfn === "false") isAfn = false;
    else throw new Error(`BSale ${index + 1}: isAfn must be a boolean`);
  }
  return { dv, isAfn };
};

// ─── NEW: bill-level currency resolution ─────────────────────────────────
const resolveBillCurrency = (body, parsedEntries) => {
  const first = parsedEntries[0] || {};

  let isAfn;
  if (body.isAfn !== undefined && body.isAfn !== null && body.isAfn !== "") {
    if (typeof body.isAfn === "boolean") isAfn = body.isAfn;
    else if (body.isAfn === 1 || body.isAfn === "1" || body.isAfn === "true") isAfn = true;
    else if (body.isAfn === 0 || body.isAfn === "0" || body.isAfn === "false") isAfn = false;
    else throw new Error("Bill-level isAfn must be a boolean");
  } else {
    isAfn = !!first.isAfn;
  }

  let DV;
  if (body.DV !== undefined && body.DV !== null && body.DV !== "") {
    const parsed = parseFloat(body.DV);
    if (!Number.isFinite(parsed)) throw new Error("Bill-level DV must be a valid number");
    DV = parsed;
  } else {
    DV = first.DV !== undefined && first.DV !== null ? parseFloat(first.DV) || 0 : 0;
  }

  return { isAfn, DV };
};

// ─── CREATE ──────────────────────────────────────────────────────────────

export const createBSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let { bsales, buyerId, newBuyer, discount_amount = 0 } = req.body;

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

    // ── 1. Buyer ──
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

    // ── 2. Pre-parse bsales ──
    const parsedSales = bsales.map((saleData, i) => {
      const { bexistId, quantity, unit_price, amount, receipt, remaind } = saleData;

      if (!bexistId || !quantity || !unit_price) {
        throw new Error(`BSale ${i + 1}: Missing required fields (bexistId, quantity, unit_price)`);
      }

      const qtyNum = parseFloat(quantity);
      const unitPriceNum = parseFloat(unit_price);
      const amountNum = parseFloat(amount);
      if (
        isNaN(qtyNum) || qtyNum <= 0 ||
        isNaN(unitPriceNum) || unitPriceNum <= 0 ||
        isNaN(amountNum) || amountNum <= 0
      ) {
        throw new Error(`BSale ${i + 1}: Invalid numeric values`);
      }

      const expectedAmount = qtyNum * unitPriceNum;
      if (Math.abs(amountNum - expectedAmount) > 0.01) {
        throw new Error(`BSale ${i + 1}: Amount mismatch`);
      }

      // ── NEW ──
      const { dv, isAfn } = parseDvAndIsAfn(saleData, i);

      const receiptAmount = parseFloat(receipt) || 0;
      const finalRemaind =
        remaind !== undefined ? parseFloat(remaind) : amountNum - receiptAmount;

      return {
        bexistId,
        qtyNum,
        unitPriceNum,
        amountNum,
        receiptAmount,
        finalRemaind,
        DV: dv,
        isAfn,
      };
    });

    // ── NEW: single currency per bill ──
    const currencies = new Set(parsedSales.map((s) => s.isAfn));
    if (currencies.size > 1) {
      await t.rollback();
      return res.status(400).json({
        message:
          "All bsales in a single bill must use the same currency (isAfn). Split mixed-currency rows into separate bills.",
      });
    }

    const billCurrency = resolveBillCurrency(req.body, parsedSales);

    // ── 3. Process sales ──
    const createdBSales = [];
    let totalAmountSum = 0;
    let totalReceiptSum = 0;

    for (const ps of parsedSales) {
      const stock = await bExist.findByPk(ps.bexistId, {
        include: [{ model: Category, as: "category" }],
        transaction: t,
      });
      if (!stock) throw new Error(`bExist record ${ps.bexistId} not found`);

      const availableQty = parseFloat(stock.quantity);
      if (availableQty < ps.qtyNum) {
        throw new Error(`Insufficient stock quantity for bExist ${ps.bexistId}`);
      }

      const newQty = availableQty - ps.qtyNum;
      await stock.update({ quantity: newQty }, { transaction: t });

      // Create BSale (with DV / isAfn)
      const newSale = await BSales.create(
        {
          categoryId: stock.categoryId,
          bexistId: stock.id,
          unit_price: ps.unitPriceNum,
          quantity: ps.qtyNum,
          receipt: ps.receiptAmount,
          remaind: ps.finalRemaind,
          total: ps.amountNum,
          buyerId: finalBuyerId,
          // NEW
          DV: ps.DV,
          isAfn: ps.isAfn,
        },
        { transaction: t }
      );

      createdBSales.push(newSale);
      totalAmountSum += ps.amountNum;
      totalReceiptSum += ps.receiptAmount;
    }

    // ── 4. Discount + receipt validation ──
    if (discountVal > totalAmountSum) {
      await t.rollback();
      return res.status(400).json({ message: "Discount amount cannot exceed total invoice amount" });
    }

    const discountedTotal = totalAmountSum - discountVal;
    if (totalReceiptSum > discountedTotal + 0.01) {
      await t.rollback();
      return res.status(400).json({ message: "Receipt amount exceeds total after discount" });
    }

    // ── 5. Bill (with DV / isAfn) ──
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
        sells: [],
        bsales: saleIds,
        // NEW
        DV: billCurrency.DV,
        isAfn: billCurrency.isAfn,
      },
      { transaction: t }
    );

    // ── 6. BuyerAccount ──
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

    // ── 7. Receipt ──
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

    await t.commit();

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
    const { categoryId, bexistId, unit_price, quantity, receipt, remaind, buyerId, newBuyer, DV, isAfn } = req.body;

    const sale = await BSales.findByPk(id);
    if (!sale) return res.status(404).json({ message: "BSale not found" });

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
          if (!buyer) buyer = await Buyer.create({ fullname: trimmed, isActive: false });
          finalBuyerId = buyer.id;
        }
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      sale.buyerId = finalBuyerId;
    }

    if (bexistId !== undefined && bexistId !== sale.bexistId) {
      return res.status(400).json({ message: "Changing bexistId is not allowed; create a new sale instead." });
    }

    if (categoryId !== undefined) sale.categoryId = categoryId;
    if (unit_price !== undefined) sale.unit_price = unit_price;
    if (quantity !== undefined) sale.quantity = quantity;
    if (receipt !== undefined) sale.receipt = receipt;
    if (remaind !== undefined) sale.remaind = remaind;

    // ── NEW: currency fields ──
    if (DV !== undefined) {
      if (DV === null || DV === "") sale.DV = 0;
      else {
        const parsed = parseFloat(DV);
        if (!Number.isFinite(parsed)) return res.status(400).json({ error: "DV must be a valid number" });
        sale.DV = parsed;
      }
    }
    if (isAfn !== undefined) {
      if (typeof isAfn === "boolean") sale.isAfn = isAfn;
      else if (isAfn === 1 || isAfn === "1" || isAfn === "true") sale.isAfn = true;
      else if (isAfn === 0 || isAfn === "0" || isAfn === "false") sale.isAfn = false;
      else return res.status(400).json({ error: "isAfn must be a boolean" });
    }

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