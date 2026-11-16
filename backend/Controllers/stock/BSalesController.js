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
  Sells,
  sequelize,
} from "../../Models/index.js";

// ─── SHARED HELPERS ──────────────────────────────────────────────────────

const syncBillTotals = async (billId, transaction = null) => {
  if (!billId) return null;

  const bill = await Bill.findByPk(billId, { transaction });
  if (!bill) return null;

  const sellIds = Array.isArray(bill.sells) ? bill.sells : [];
  const bsaleIds = Array.isArray(bill.bsales) ? bill.bsales : [];

  const [sells, bsales] = await Promise.all([
    sellIds.length
      ? Sells.findAll({ where: { id: sellIds }, transaction })
      : Promise.resolve([]),
    bsaleIds.length
      ? BSales.findAll({ where: { id: bsaleIds }, transaction })
      : Promise.resolve([]),
  ]);

  const sum = (arr, key) =>
    arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);

  const totalAmount =
    Math.round((sum(sells, "total") + sum(bsales, "total")) * 100) / 100;
  const paidAmount =
    Math.round((sum(sells, "receipt") + sum(bsales, "receipt")) * 100) / 100;
  const remainingAmount = Math.max(
    Math.round((totalAmount - paidAmount) * 100) / 100,
    0
  );

  let status = "unpaid";
  if (remainingAmount <= 0.009) status = "paid";
  else if (paidAmount > 0) status = "partial";

  await bill.update(
    { totalAmount, paidAmount, remainingAmount, status },
    { transaction }
  );

  return bill;
};

const findBillsForSell = async (sellId, transaction = null) => {
  const [rows] = await sequelize.query(
    `SELECT id FROM Bill
     WHERE JSON_CONTAINS(COALESCE(sells, JSON_ARRAY()), CAST(:sellId AS JSON))
        OR JSON_CONTAINS(COALESCE(bsales, JSON_ARRAY()), CAST(:sellId AS JSON))`,
    { replacements: { sellId }, transaction }
  );
  return rows;
};

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

    // ── 3. Single currency per bill ──
    const currencies = new Set(parsedSales.map((s) => s.isAfn));
    if (currencies.size > 1) {
      await t.rollback();
      return res.status(400).json({
        message:
          "All bsales in a single bill must use the same currency (isAfn). Split mixed-currency rows into separate bills.",
      });
    }

    const billCurrency = resolveBillCurrency(req.body, parsedSales);

    // ── 4. Process sales ──
    const createdBSales = [];
    let totalAmountSum = 0;
    let totalReceiptSum = 0;

    for (const ps of parsedSales) {
      const stock = await bExist.findByPk(ps.bexistId, {
        include: [{ model: Category, as: "category" }],
        transaction: t,
        lock: true,
      });
      if (!stock) throw new Error(`bExist record ${ps.bexistId} not found`);

      const availableQty = parseFloat(stock.quantity);
      if (availableQty < ps.qtyNum) {
        throw new Error(`Insufficient stock quantity for bExist ${ps.bexistId}`);
      }

      const newQty = availableQty - ps.qtyNum;
      await stock.update({ quantity: newQty }, { transaction: t });

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
          DV: ps.DV,
          isAfn: ps.isAfn,
        },
        { transaction: t }
      );

      createdBSales.push(newSale);
      totalAmountSum += ps.amountNum;
      totalReceiptSum += ps.receiptAmount;
    }

    // ── 5. Discount + receipt validation ──
    if (discountVal > totalAmountSum) {
      await t.rollback();
      return res.status(400).json({ message: "Discount amount cannot exceed total invoice amount" });
    }

    const discountedTotal = totalAmountSum - discountVal;
    if (totalReceiptSum > discountedTotal + 0.01) {
      await t.rollback();
      return res.status(400).json({ message: "Receipt amount exceeds total after discount" });
    }

    // ── 6. Bill ──
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
        DV: billCurrency.DV,
        isAfn: billCurrency.isAfn,
      },
      { transaction: t }
    );

    // ── 7. BuyerAccount ──
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

    // ── 8. Receipt ──
    let createdReceipt = null;
    if (totalReceiptSum > 0) {
      const receipt = await Receipt.create(
        {
          buyerId: finalBuyerId,
          amountofmoney: totalReceiptSum,
          description: `پرداخت برای فاکتور ${billNumber} (جمع کل ${totalAmountSum}، تخفیف ${discountVal})`,
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
    if (!t.finished) await t.rollback();
    console.error("Error creating BSale:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────
// Optionally filter by ?billId=<id>
export const getAllBSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ✅ NEW: filter by billId if provided
    const where = {};
    const { billId } = req.query;

    if (billId) {
      const bill = await Bill.findByPk(billId, { attributes: ["bsales"] });
      if (!bill) return res.status(404).json({ error: "Bill not found" });
      const ids = Array.isArray(bill.bsales) ? bill.bsales : [];
      if (ids.length === 0) {
        return res.status(200).json({
          data: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
        });
      }
      where.id = ids;
    }

    const { count, rows } = await BSales.findAndCountAll({
      where,
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

// ─── GET ALL BSALES FOR A BILL ───────────────────────────────────────────
// GET /bsales/by-bill/:billId
// Returns every BSale referenced in Bill.bsales, in the same order,
// with all includes. 404 if the bill is missing; [] if it has none.
export const getBSalesByBillId = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Bill.findByPk(billId, {
      attributes: ["id", "billNumber", "sells", "bsales"],
    });
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const bsaleIds = Array.isArray(bill.bsales) ? bill.bsales : [];
    if (bsaleIds.length === 0) {
      return res.status(200).json({
        billId: bill.id,
        billNumber: bill.billNumber,
        total: 0,
        data: [],
      });
    }

    const bsales = await BSales.findAll({
      where: { id: bsaleIds },
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
    });

    // Preserve the order the IDs appear in bill.bsales
    const map = new Map(bsales.map((b) => [b.id, b]));
    const ordered = bsaleIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((b) => b.toJSON());

    res.status(200).json({
      billId: bill.id,
      billNumber: bill.billNumber,
      total: ordered.length,
      data: ordered,
    });
  } catch (error) {
    console.error("Error in getBSalesByBillId:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────
export const updateBSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      categoryId,
      bexistId,
      unit_price,
      quantity,
      receipt,
      remaind,
      total,
      buyerId,
      newBuyer,
      DV,
      isAfn,
    } = req.body;

    const sale = await BSales.findByPk(id, { transaction: t });
    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "BSale not found" });
    }

    // bexistId change: rejected
    if (bexistId !== undefined && parseInt(bexistId) !== parseInt(sale.bexistId)) {
      await t.rollback();
      return res.status(400).json({ message: "Changing bexistId is not allowed; create a new sale instead." });
    }

    const parentBills = await findBillsForSell(sale.id, t);
    const isOnBill = parentBills.length > 0;

    // Buyer change: only allowed if not attached to a bill
    if ((buyerId !== undefined || newBuyer !== undefined) && isOnBill) {
      await t.rollback();
      return res.status(400).json({
        message:
          "Cannot change the buyer of a blanket sale that is already attached to a bill. Delete the bill first.",
      });
    }

    if (buyerId !== undefined || newBuyer !== undefined) {
      try {
        if (buyerId) {
          const buyer = await Buyer.findByPk(buyerId, { transaction: t });
          if (!buyer) throw new Error("Selected buyer does not exist");
          sale.buyerId = buyer.id;
        } else if (newBuyer && newBuyer.trim()) {
          const trimmed = newBuyer.trim();
          let buyer = await Buyer.findOne({ where: { fullname: trimmed }, transaction: t });
          if (!buyer) {
            buyer = await Buyer.create(
              { fullname: trimmed, isActive: false },
              { transaction: t }
            );
          }
          sale.buyerId = buyer.id;
        }
      } catch (err) {
        await t.rollback();
        return res.status(400).json({ message: err.message });
      }
    }

    // ✅ Currency consistency — only fire if the currency is ACTUALLY changing
    if (isAfn !== undefined && isOnBill) {
      let nextIsAfn;
      if (typeof isAfn === "boolean") nextIsAfn = isAfn;
      else if (isAfn === 1 || isAfn === "1" || isAfn === "true") nextIsAfn = true;
      else if (isAfn === 0 || isAfn === "0" || isAfn === "false") nextIsAfn = false;
      else {
        await t.rollback();
        return res.status(400).json({ error: "isAfn must be a boolean" });
      }

      const currentIsAfn = !!sale.isAfn;
      if (nextIsAfn !== currentIsAfn) {
        const billRow = await Bill.findByPk(parentBills[0].id, { transaction: t });
        if (billRow && !!billRow.isAfn !== nextIsAfn) {
          await t.rollback();
          return res.status(400).json({
            message:
              "Cannot change the currency of a blanket sale attached to a bill with a different currency. " +
              "Delete the bill and recreate it with the new currency.",
          });
        }
      }
    }

    // Stock delta
    if (quantity !== undefined) {
      const newQty = parseFloat(quantity);
      if (!Number.isFinite(newQty) || newQty <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "quantity must be a positive number" });
      }
      const oldQty = parseFloat(sale.quantity) || 0;
      const delta = newQty - oldQty;

      if (Math.abs(delta) > 1e-9) {
        const stock = await bExist.findByPk(sale.bexistId, { transaction: t, lock: true });
        if (!stock) {
          await t.rollback();
          return res.status(400).json({ message: "bExist record not found" });
        }
        const available = parseFloat(stock.quantity) || 0;

        if (delta > 0 && available < delta) {
          await t.rollback();
          return res.status(400).json({
            message: `Insufficient stock: only ${available} units available, ${delta} requested.`,
          });
        }

        await stock.update(
          { quantity: Math.round((available - delta) * 100) / 100 },
          { transaction: t }
        );
      }

      sale.quantity = newQty;
    }

    if (categoryId !== undefined) sale.categoryId = categoryId;

    if (unit_price !== undefined) {
      const up = parseFloat(unit_price);
      if (!Number.isFinite(up) || up <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "unit_price must be a positive number" });
      }
      sale.unit_price = up;
    }

    if (receipt !== undefined) {
      const rc = parseFloat(receipt) || 0;
      if (rc < 0) {
        await t.rollback();
        return res.status(400).json({ message: "receipt cannot be negative" });
      }
      sale.receipt = rc;
    }

    if (total !== undefined) {
      const tVal = parseFloat(total);
      if (!Number.isFinite(tVal) || tVal <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "total must be a positive number" });
      }
      sale.total = tVal;
    } else if (quantity !== undefined || unit_price !== undefined) {
      sale.total = Math.round((sale.quantity * sale.unit_price) * 100) / 100;
    }

    // If all three are sent, validate consistency
    if (quantity !== undefined && unit_price !== undefined && total !== undefined) {
      const expected = Math.round(sale.quantity * sale.unit_price * 100) / 100;
      if (Math.abs(sale.total - expected) > 0.01) {
        await t.rollback();
        return res.status(400).json({
          message: `total (${sale.total}) must equal quantity × unit_price (${expected}).`,
        });
      }
    }

    if (remaind !== undefined) {
      const r = parseFloat(remaind) || 0;
      if (r < 0) {
        await t.rollback();
        return res.status(400).json({ message: "remaind cannot be negative" });
      }
      sale.remaind = r;
    } else if (total !== undefined || receipt !== undefined) {
      sale.remaind = Math.max(
        Math.round((parseFloat(sale.total) - parseFloat(sale.receipt)) * 100) / 100,
        0
      );
    }

    // Currency
    if (DV !== undefined) {
      if (DV === null || DV === "") sale.DV = 0;
      else {
        const parsed = parseFloat(DV);
        if (!Number.isFinite(parsed)) {
          await t.rollback();
          return res.status(400).json({ error: "DV must be a valid number" });
        }
        sale.DV = parsed;
      }
    }
    if (isAfn !== undefined) {
      if (typeof isAfn === "boolean") sale.isAfn = isAfn;
      else if (isAfn === 1 || isAfn === "1" || isAfn === "true") sale.isAfn = true;
      else if (isAfn === 0 || isAfn === "0" || isAfn === "false") sale.isAfn = false;
      else {
        await t.rollback();
        return res.status(400).json({ error: "isAfn must be a boolean" });
      }
    }

    await sale.save({ transaction: t });

    for (const { id: billId } of parentBills) {
      await syncBillTotals(billId, t);
    }

    await t.commit();

    const updated = await BSales.findByPk(id, {
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
    });
    res.status(200).json(updated);
  } catch (error) {
    if (!t.finished) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────
export const deleteBSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const sale = await BSales.findByPk(id, { transaction: t });
    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "BSale not found" });
    }

    const parentBills = await findBillsForSell(sale.id, t);

    const stock = await bExist.findByPk(sale.bexistId, { transaction: t, lock: true });
    if (stock) {
      const restored = (parseFloat(stock.quantity) || 0) + (parseFloat(sale.quantity) || 0);
      await stock.update(
        { quantity: Math.round(restored * 100) / 100 },
        { transaction: t }
      );
    } else {
      console.warn(
        `deleteBSale: bExist ${sale.bexistId} not found while deleting BSale ${sale.id}; stock restore skipped.`
      );
    }

    await sale.destroy({ transaction: t });

    for (const { id: billId } of parentBills) {
      await syncBillTotals(billId, t);
    }

    await t.commit();
    res.status(200).json({ message: "BSale deleted successfully and stock restored" });
  } catch (error) {
    if (!t.finished) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

// ========== BATCH UPDATE BSALES (single transaction) ==========
// PUT /bsales/batch
// Body: { items: [{ bsaleId, bexistId?, quantity?, unit_price?, total?, receipt?, remaind?, DV? }] }
// All rows must be updated atomically. Syncs parent bills once at the end.
export const updateBSaleBatch = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "items must be a non-empty array" });
    }

    const touchedBillIds = new Set();
    const updatedIds = [];

    for (const item of items) {
      const { bsaleId, bexistId, quantity, unit_price, total, receipt, remaind, DV, isAfn } = item;

      if (!bsaleId) {
        await t.rollback();
        return res.status(400).json({ message: "Each item must have bsaleId" });
      }

      const sale = await BSales.findByPk(bsaleId, { transaction: t, lock: true });
      if (!sale) {
        await t.rollback();
        return res.status(404).json({ message: `BSale ${bsaleId} not found` });
      }

      // bexistId change: reject
      if (bexistId !== undefined && parseInt(bexistId) !== parseInt(sale.bexistId)) {
        await t.rollback();
        return res.status(400).json({
          message: `Changing bexistId is not allowed (BSale ${bsaleId}).`,
        });
      }

      const parentBills = await findBillsForSell(sale.id, t);
      const isOnBill = parentBills.length > 0;

      // Currency guard: only fire on ACTUAL change
      if (isAfn !== undefined && isOnBill) {
        let nextIsAfn;
        if (typeof isAfn === "boolean") nextIsAfn = isAfn;
        else if (isAfn === 1 || isAfn === "1" || isAfn === "true") nextIsAfn = true;
        else if (isAfn === 0 || isAfn === "0" || isAfn === "false") nextIsAfn = false;
        else {
          await t.rollback();
          return res.status(400).json({ message: `Invalid isAfn for BSale ${bsaleId}` });
        }
        const currentIsAfn = !!sale.isAfn;
        if (nextIsAfn !== currentIsAfn) {
          const billRow = await Bill.findByPk(parentBills[0].id, { transaction: t });
          if (billRow && !!billRow.isAfn !== nextIsAfn) {
            await t.rollback();
            return res.status(400).json({
              message: `Cannot change the currency of BSale ${bsaleId} — it is attached to a bill with a different currency.`,
            });
          }
        }
      }

      // Stock delta
      if (quantity !== undefined) {
        const newQty = parseFloat(quantity);
        if (!Number.isFinite(newQty) || newQty <= 0) {
          await t.rollback();
          return res.status(400).json({ message: `quantity must be positive (BSale ${bsaleId})` });
        }
        const oldQty = parseFloat(sale.quantity) || 0;
        const delta = newQty - oldQty;

        if (Math.abs(delta) > 1e-9) {
          const stock = await bExist.findByPk(sale.bexistId, { transaction: t, lock: true });
          if (!stock) {
            await t.rollback();
            return res.status(400).json({ message: `bExist not found for BSale ${bsaleId}` });
          }
          const available = parseFloat(stock.quantity) || 0;

          if (delta > 0 && available < delta) {
            await t.rollback();
            return res.status(400).json({
              message: `Insufficient stock for BSale ${bsaleId}: only ${available} available, ${delta} requested.`,
            });
          }

          await stock.update(
            { quantity: Math.round((available - delta) * 100) / 100 },
            { transaction: t }
          );
        }
        sale.quantity = newQty;
      }

      if (unit_price !== undefined) {
        const up = parseFloat(unit_price);
        if (!Number.isFinite(up) || up <= 0) {
          await t.rollback();
          return res.status(400).json({ message: `unit_price must be positive (BSale ${bsaleId})` });
        }
        sale.unit_price = up;
      }

      if (receipt !== undefined) {
        const rc = parseFloat(receipt) || 0;
        if (rc < 0) {
          await t.rollback();
          return res.status(400).json({ message: `receipt cannot be negative (BSale ${bsaleId})` });
        }
        sale.receipt = rc;
      }

      if (total !== undefined) {
        const tVal = parseFloat(total);
        if (!Number.isFinite(tVal) || tVal <= 0) {
          await t.rollback();
          return res.status(400).json({ message: `total must be positive (BSale ${bsaleId})` });
        }
        sale.total = tVal;
      } else if (quantity !== undefined || unit_price !== undefined) {
        sale.total = Math.round((sale.quantity * sale.unit_price) * 100) / 100;
      }

      if (remaind !== undefined) {
        const r = parseFloat(remaind) || 0;
        if (r < 0) {
          await t.rollback();
          return res.status(400).json({ message: `remaind cannot be negative (BSale ${bsaleId})` });
        }
        sale.remaind = r;
      } else if (total !== undefined || receipt !== undefined) {
        sale.remaind = Math.max(
          Math.round((parseFloat(sale.total) - parseFloat(sale.receipt)) * 100) / 100,
          0
        );
      }

      if (DV !== undefined) {
        if (DV === null || DV === "") sale.DV = 0;
        else {
          const parsed = parseFloat(DV);
          if (!Number.isFinite(parsed)) {
            await t.rollback();
            return res.status(400).json({ message: `DV must be a valid number (BSale ${bsaleId})` });
          }
          sale.DV = parsed;
        }
      }

      await sale.save({ transaction: t });
      updatedIds.push(sale.id);

      // Collect bill ids to sync later (one sync per bill, at the end)
      parentBills.forEach((b) => touchedBillIds.add(b.id));
    }

    // ✅ Sync all touched bills ONCE, inside the same transaction
    for (const billId of touchedBillIds) {
      await syncBillTotals(billId, t);
    }

    await t.commit();

    const updated = await BSales.findAll({
      where: { id: updatedIds },
      include: [
        { model: Category, as: "category" },
        { model: bExist, as: "bExist" },
        { model: Buyer, as: "buyer" },
      ],
    });

    res.status(200).json({
      message: `${updated.length} BSale(s) updated`,
      bsales: updated,
      syncedBillIds: Array.from(touchedBillIds),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error in updateBSaleBatch:", error);
    res.status(500).json({ error: error.message });
  }
};