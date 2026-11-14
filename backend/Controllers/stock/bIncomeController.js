// controllers/stock/bincomeController.js
import { IncomeBill, Pay, CustomerAccount, Customer, Category } from "../../Models/index.js";
import Bincome from "../../Models/Stock/bincome.js";
import bExist from "../../Models/Stock/bExist.js";
import sequelize from "../../dbconnection.js";
import { Op } from "sequelize";


// ─── HELPER: Update CustomerAccount with bill ID ──────────────────────────
const updateCustomerAccountWithBill = async (customerId, billId, isFullyPaid) => {
  const db = CustomerAccount.sequelize;

  let account = await CustomerAccount.findOne({ where: { customerId } });
  if (!account) {
    await CustomerAccount.create({
      customerId,
      paid: [],
      unpaid: [],
      total: [],
      returned: [],
      pay: [],
      receive: [],
    });
  }

  await db.query(
    `UPDATE CustomerAccounts 
     SET total = JSON_ARRAY_APPEND(COALESCE(total, JSON_ARRAY()), '$', :billId)
     WHERE customerId = :customerId`,
    { replacements: { billId, customerId }, type: db.QueryTypes.UPDATE }
  );

  if (isFullyPaid) {
    await db.query(
      `UPDATE CustomerAccounts 
       SET paid = JSON_ARRAY_APPEND(COALESCE(paid, JSON_ARRAY()), '$', :billId),
           unpaid = IF(
               JSON_SEARCH(COALESCE(unpaid, JSON_ARRAY()), 'one', :billId) IS NOT NULL,
               JSON_REMOVE(COALESCE(unpaid, JSON_ARRAY()), JSON_UNQUOTE(JSON_SEARCH(COALESCE(unpaid, JSON_ARRAY()), 'one', :billId))),
               COALESCE(unpaid, JSON_ARRAY())
           )
       WHERE customerId = :customerId`,
      { replacements: { billId, customerId }, type: db.QueryTypes.UPDATE }
    );
  } else {
    await db.query(
      `UPDATE CustomerAccounts 
       SET unpaid = JSON_ARRAY_APPEND(COALESCE(unpaid, JSON_ARRAY()), '$', :billId),
           paid = IF(
               JSON_SEARCH(COALESCE(paid, JSON_ARRAY()), 'one', :billId) IS NOT NULL,
               JSON_REMOVE(COALESCE(paid, JSON_ARRAY()), JSON_UNQUOTE(JSON_SEARCH(COALESCE(paid, JSON_ARRAY()), 'one', :billId))),
               COALESCE(paid, JSON_ARRAY())
           )
       WHERE customerId = :customerId`,
      { replacements: { billId, customerId }, type: db.QueryTypes.UPDATE }
    );
  }
};

// ─── HELPER: Add Pay ID to CustomerAccount.pay ────────────────────────────
const addPayToCustomerAccount = async (customerId, payId) => {
  const db = CustomerAccount.sequelize;

  let account = await CustomerAccount.findOne({ where: { customerId } });
  if (!account) {
    await CustomerAccount.create({
      customerId,
      paid: [],
      unpaid: [],
      total: [],
      returned: [],
      pay: [],
      receive: [],
    });
  }

  await db.query(
    `UPDATE CustomerAccounts 
     SET pay = JSON_ARRAY_APPEND(COALESCE(pay, JSON_ARRAY()), '$', :payId)
     WHERE customerId = :customerId`,
    { replacements: { payId, customerId }, type: db.QueryTypes.UPDATE }
  );
};

// ─── HELPER: Add Bincome ID to Category.BIncome ───────────────────────────
const addBincomeToCategoryBIncome = async (categoryId, bincomeId) => {
  if (!categoryId || !bincomeId) return;
  const db = Category.sequelize;
  await db.query(
    `UPDATE Categories 
     SET BIncome = JSON_ARRAY_APPEND(COALESCE(BIncome, JSON_ARRAY()), '$', :bincomeId) 
     WHERE id = :categoryId`,
    { replacements: { bincomeId, categoryId }, type: db.QueryTypes.UPDATE }
  );
};

// ─── HELPER: Remove Bincome ID from Category.BIncome ──────────────────────
const removeBincomeFromCategoryBIncome = async (categoryId, bincomeId) => {
  if (!categoryId || !bincomeId) return;
  const db = Category.sequelize;
  await db.query(
    `UPDATE Categories 
     SET BIncome = IF(
         JSON_SEARCH(COALESCE(BIncome, JSON_ARRAY()), 'one', :bincomeId) IS NOT NULL,
         JSON_REMOVE(COALESCE(BIncome, JSON_ARRAY()), JSON_UNQUOTE(JSON_SEARCH(COALESCE(BIncome, JSON_ARRAY()), 'one', :bincomeId))),
         COALESCE(BIncome, JSON_ARRAY())
     )
     WHERE id = :categoryId`,
    { replacements: { bincomeId, categoryId }, type: db.QueryTypes.UPDATE }
  );
};

// ─── HELPER: Generate unique bill number for blanket incomes ──────────────
const generateBincomeBillNumber = async () => {
  const lastBill = await IncomeBill.findOne({ order: [['id', 'DESC']], attributes: ['billNumber'] });
  let nextNumber = 1;
  if (lastBill && lastBill.billNumber) {
    const match = lastBill.billNumber.match(/\d+$/);
    if (match) nextNumber = parseInt(match[0]) + 1;
  }
  return `BINV-${nextNumber.toString().padStart(6, '0')}`;
};

// ─── HELPER: Update bExist stock ──────────────────────────────────────────
const updateBExistStock = async (categoryId, newQuantity, newUnitPrice, transaction) => {
  const [stock, created] = await bExist.findOrCreate({
    where: { categoryId },
    defaults: { quantity: 0, unitPrice: 0 },
    transaction,
  });

  const existingQty = parseFloat(stock.quantity) || 0;
  const existingPrice = parseFloat(stock.unitPrice) || 0;
  const addedQty = parseFloat(newQuantity) || 0;
  const addedPrice = parseFloat(newUnitPrice) || 0;

  const newTotalQty = existingQty + addedQty;
  let avgPrice = 0;
  if (newTotalQty > 0) {
    avgPrice = (existingQty * existingPrice + addedQty * addedPrice) / newTotalQty;
  }

  await stock.update(
    {
      quantity: newTotalQty,
      unitPrice: avgPrice,
    },
    { transaction }
  );
};

// ─── HELPER: Parse & validate DV / isAfn from an entry ────────────────────
const parseDvAndIsAfn = (entry, index) => {
  // DV: default 0, must be a finite number if provided
  let dv = 0;
  if (entry.DV !== undefined && entry.DV !== null && entry.DV !== "") {
    const parsedDv = parseFloat(entry.DV);
    if (!Number.isFinite(parsedDv)) {
      throw new Error(`Entry ${index + 1}: DV must be a valid number`);
    }
    dv = parsedDv;
  }

  // isAfn: default false, coerce common truthy/falsy shapes
  let isAfn = false;
  if (entry.isAfn !== undefined && entry.isAfn !== null && entry.isAfn !== "") {
    if (typeof entry.isAfn === "boolean") {
      isAfn = entry.isAfn;
    } else if (entry.isAfn === 1 || entry.isAfn === "1" || entry.isAfn === "true") {
      isAfn = true;
    } else if (entry.isAfn === 0 || entry.isAfn === "0" || entry.isAfn === "false") {
      isAfn = false;
    } else {
      throw new Error(`Entry ${index + 1}: isAfn must be a boolean`);
    }
  }

  return { dv, isAfn };
};

// ─── HELPER: Resolve bill-level currency from body / entries ──────────────
// The bill has a single currency. If the client sent top-level `isAfn` / `DV`,
// we honor those. Otherwise we fall back to the first entry's values so the
// bill reflects what was actually stored on the Bincome rows.
const resolveBillCurrency = (body, parsedEntries) => {
  const firstEntry = parsedEntries[0] || {};

  // isAfn
  let billIsAfn;
  if (body.isAfn !== undefined && body.isAfn !== null && body.isAfn !== "") {
    if (typeof body.isAfn === "boolean") {
      billIsAfn = body.isAfn;
    } else if (body.isAfn === 1 || body.isAfn === "1" || body.isAfn === "true") {
      billIsAfn = true;
    } else if (body.isAfn === 0 || body.isAfn === "0" || body.isAfn === "false") {
      billIsAfn = false;
    } else {
      throw new Error("Bill-level isAfn must be a boolean");
    }
  } else {
    billIsAfn = !!firstEntry.isAfn;
  }

  // DV
  let billDv;
  if (body.DV !== undefined && body.DV !== null && body.DV !== "") {
    const parsed = parseFloat(body.DV);
    if (!Number.isFinite(parsed)) {
      throw new Error("Bill-level DV must be a valid number");
    }
    billDv = parsed;
  } else if (firstEntry.DV !== undefined && firstEntry.DV !== null) {
    billDv = parseFloat(firstEntry.DV) || 0;
  } else {
    billDv = 0;
  }

  return { isAfn: billIsAfn, DV: billDv };
};

// ─── CREATE ──────────────────────────────────────────────────────────────────
export const createBincome = async (req, res) => {
  let transaction;

  try {
    let { entries, customerId, newCustomer, totalReceipt } = req.body;

    if (!entries && req.body.categoryId) entries = [req.body];
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "Entries array is required and must not be empty" });
    }

    transaction = await sequelize.transaction();

    // ── Customer handling ──
    let finalCustomerId = null;
    if (customerId) {
      const customer = await Customer.findByPk(customerId, { transaction });
      if (!customer) throw new Error("Provided customerId does not exist");
      finalCustomerId = customer.id;
    } else if (newCustomer && newCustomer.trim()) {
      const trimmedName = newCustomer.trim().toLowerCase();
      let existingCustomer = await Customer.findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('fullname')), trimmedName),
        transaction,
      });
      if (existingCustomer) finalCustomerId = existingCustomer.id;
      else {
        const newCust = await Customer.create({ fullname: newCustomer.trim(), isActive: false }, { transaction });
        finalCustomerId = newCust.id;
      }
    } else {
      throw new Error("Either customerId or newCustomer is required");
    }

    // ── Parse + validate entries first (need currency info for the bill) ──
    const parsedEntries = entries.map((entry, i) => {
      const { categoryId, amount, weight, unitPrice } = entry;

      if (!categoryId) throw new Error(`Entry ${i + 1}: Category ID is required`);
      if (!amount || parseFloat(amount) <= 0) throw new Error(`Entry ${i + 1}: Amount must be a positive number`);
      if (weight !== undefined && weight !== null && weight !== "") {
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum <= 0) {
          throw new Error(`Entry ${i + 1}: Weight must be a positive number if provided`);
        }
      }
      if (!unitPrice || parseFloat(unitPrice) <= 0) throw new Error(`Entry ${i + 1}: Unit price must be a positive number`);

      const { dv, isAfn } = parseDvAndIsAfn(entry, i);

      const parsedAmount = parseFloat(amount);
      const parsedUnitPrice = parseFloat(unitPrice);
      const parsedWeight =
        weight !== undefined && weight !== null && weight !== ""
          ? parseFloat(weight)
          : null;

      return {
        categoryId,
        amount: parsedAmount,
        unitPrice: parsedUnitPrice,
        weight: parsedWeight,
        totalPrice: parsedAmount * parsedUnitPrice,
        DV: dv,
        isAfn,
      };
    });

    // ── Enforce single-currency-per-bill (the bill row holds one isAfn) ──
    const currencies = new Set(parsedEntries.map((e) => e.isAfn));
    if (currencies.size > 1) {
      throw new Error(
        "All entries in a single bill must use the same currency (isAfn). Split mixed-currency entries into separate bills."
      );
    }

    // ── Resolve bill-level currency (body overrides, else first entry) ──
    const billCurrency = resolveBillCurrency(req.body, parsedEntries);

    // ── Create Bincome records & update stock ──
    const createdBincomes = [];

    for (const pe of parsedEntries) {
      const categoryExists = await Category.findByPk(pe.categoryId, { transaction });
      if (!categoryExists) throw new Error(`Invalid Category ID ${pe.categoryId}`);

      const initialAmount = computeInitialAmount(pe.totalPrice, pe.unitPrice);

      const newBincome = await Bincome.create({
        categoryId: pe.categoryId,
        amount: pe.amount,
        initialAmount,
        weight: pe.weight,
        unitPrice: pe.unitPrice,
        customerId: finalCustomerId,
        paidAmount: 0,
        remaind: pe.totalPrice,
        DV: pe.DV,
        isAfn: pe.isAfn,
      }, { transaction });

      createdBincomes.push(newBincome);

      await updateBExistStock(pe.categoryId, pe.amount, pe.unitPrice, transaction);
    }

    await transaction.commit();
    transaction = null;

    // ── Payment allocation ──
    let remainingReceipt = parseFloat(totalReceipt) || 0;
    const totalInvoiceAmount = createdBincomes.reduce((sum, b) => sum + parseFloat(b.remaind), 0);

    if (remainingReceipt > totalInvoiceAmount + 0.01) {
      return res.status(400).json({ message: "Payment amount exceeds total invoice amount" });
    }

    const sortedBincomes = [...createdBincomes].sort((a, b) => a.id - b.id);
    for (const bincome of sortedBincomes) {
      if (remainingReceipt <= 0) break;
      const currentRemaind = parseFloat(bincome.remaind);
      const amountToPay = Math.min(remainingReceipt, currentRemaind);
      const newPaidAmount = parseFloat(bincome.paidAmount) + amountToPay;
      const newRemaind = currentRemaind - amountToPay;
      await bincome.update({ paidAmount: newPaidAmount, remaind: newRemaind });
      remainingReceipt -= amountToPay;
    }

    // ── Update Category.BIncome ──
    for (const bincome of createdBincomes) {
      await addBincomeToCategoryBIncome(bincome.categoryId, bincome.id);
    }

    // ── Create IncomeBill (with currency) ──
    const billNumber = await generateBincomeBillNumber();
    const totalPaid = parseFloat(totalReceipt) || 0;
    const remainingAmount = totalInvoiceAmount - totalPaid;
    let billStatus = "unpaid";
    if (remainingAmount === 0) billStatus = "paid";
    else if (totalPaid > 0 && remainingAmount > 0) billStatus = "partial";

    const newBill = await IncomeBill.create({
      billNumber,
      customerId: finalCustomerId,
      date: new Date(),
      totalAmount: totalInvoiceAmount,
      paidAmount: totalPaid,
      remainingAmount,
      status: billStatus,
      notes: null,
      discount_percent: 0,
      discounted_amount: 0,
      Incomes: [],
      bIncome: createdBincomes.map(b => b.id),
      // ✅ currency on the bill
      isAfn: billCurrency.isAfn,
      DV: billCurrency.DV,
    });

    // ── Create Pay record if payment received ──
    // NOTE: Pay.is_Afs stays independent; if you want it to mirror the bill
    // currency, replace `is_Afs: true` with `is_Afs: billCurrency.isAfn`.
    let newPay = null;
    if (totalPaid > 0) {
      newPay = await Pay.create({
        customerId: finalCustomerId,
        amountofmoney: totalPaid,
        description: `پرداخت بابت فاکتور بلنکت ${billNumber}`,
        is_Afs: true,
      });
      await addPayToCustomerAccount(finalCustomerId, newPay.id);
    }

    // ── Update CustomerAccount with bill ID ──
    const isBillFullyPaid = (billStatus === 'paid');
    await updateCustomerAccountWithBill(finalCustomerId, newBill.id, isBillFullyPaid);

    // ── Fetch created Bincome with category details ──
    const bincomeWithDetails = await Bincome.findAll({
      where: { id: createdBincomes.map(b => b.id) },
      include: [{ model: Category, as: "category" }],
    });

    res.status(201).json({
      message: `${createdBincomes.length} blanket income(s) created successfully`,
      bincomes: bincomeWithDetails,
      bill: newBill,
      pay: newPay,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error in createBincome:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET ALL (with pagination & category filter) ──────────────────────────
export const getAllBincome = async (req, res) => {
  try {
    const { categoryId, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const effectiveLimit = Math.min(limitNumber, 100);
    const offset = (pageNumber - 1) * effectiveLimit;

    const whereClause = {};
    if (categoryId) whereClause.categoryId = categoryId;

    const { count, rows } = await Bincome.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: effectiveLimit,
      offset,
    });

    const dataWithTotal = rows.map((item) => {
      const amount = parseFloat(item.amount) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const totalPrice = Math.round((amount * unitPrice) * 100) / 100;
      item.dataValues.totalPrice = totalPrice;
      if (item.initialAmount === undefined || item.initialAmount === null) {
        item.dataValues.initialAmount = computeInitialAmount(totalPrice, unitPrice);
      }
      item.dataValues.DV = item.DV !== undefined && item.DV !== null ? parseFloat(item.DV) : 0;
      item.dataValues.isAfn = Boolean(item.isAfn);
      return item.dataValues;
    });

    const totalPages = Math.ceil(count / effectiveLimit);

    return res.status(200).json({
      success: true,
      data: dataWithTotal,
      pagination: {
        currentPage: pageNumber,
        limit: effectiveLimit,
        totalItems: count,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching Bincome entries:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET BY ID ──────────────────────────────────────────────────────────────
export const getBincomeById = async (req, res) => {
  try {
    const { id } = req.params;
    const bincome = await Bincome.findByPk(id);
    if (!bincome) return res.status(404).json({ message: "Bincome record not found" });

    const amount = parseFloat(bincome.amount) || 0;
    const unitPrice = parseFloat(bincome.unitPrice) || 0;
    const totalPrice = Math.round((amount * unitPrice) * 100) / 100;
    bincome.dataValues.totalPrice = totalPrice;
    if (bincome.initialAmount === undefined || bincome.initialAmount === null) {
      bincome.dataValues.initialAmount = computeInitialAmount(totalPrice, unitPrice);
    }
    bincome.dataValues.DV = bincome.DV !== undefined && bincome.DV !== null ? parseFloat(bincome.DV) : 0;
    bincome.dataValues.isAfn = Boolean(bincome.isAfn);

    res.status(200).json({ success: true, data: bincome.dataValues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export const updateBincome = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, amount, weight, unitPrice, DV, isAfn } = req.body;

    const bincome = await Bincome.findByPk(id);
    if (!bincome) return res.status(404).json({ message: "Bincome record not found" });

    const oldCategoryId = bincome.categoryId;

    if (categoryId !== undefined) bincome.categoryId = categoryId;
    if (amount !== undefined) bincome.amount = parseFloat(amount);
    if (weight !== undefined) bincome.weight = parseFloat(weight);
    if (unitPrice !== undefined) bincome.unitPrice = parseFloat(unitPrice);

    // New fields
    if (DV !== undefined) {
      if (DV === null || DV === "") {
        bincome.DV = 0;
      } else {
        const parsedDv = parseFloat(DV);
        if (!Number.isFinite(parsedDv)) {
          return res.status(400).json({ error: "DV must be a valid number" });
        }
        bincome.DV = parsedDv;
      }
    }

    if (isAfn !== undefined) {
      if (typeof isAfn === "boolean") {
        bincome.isAfn = isAfn;
      } else if (isAfn === 1 || isAfn === "1" || isAfn === "true") {
        bincome.isAfn = true;
      } else if (isAfn === 0 || isAfn === "0" || isAfn === "false") {
        bincome.isAfn = false;
      } else {
        return res.status(400).json({ error: "isAfn must be a boolean" });
      }
    }

    // Recalculate remaind and initialAmount
    if (amount !== undefined || unitPrice !== undefined) {
      bincome.remaind = bincome.amount * bincome.unitPrice;
      bincome.initialAmount = computeInitialAmount(bincome.remaind, bincome.unitPrice);
    }

    await bincome.save();

    // If category changed, update BIncome arrays
    if (categoryId !== undefined && categoryId !== oldCategoryId) {
      if (oldCategoryId) await removeBincomeFromCategoryBIncome(oldCategoryId, id);
      if (categoryId) await addBincomeToCategoryBIncome(categoryId, id);
    }

    const amountVal = parseFloat(bincome.amount) || 0;
    const unitPriceVal = parseFloat(bincome.unitPrice) || 0;
    bincome.dataValues.totalPrice = Math.round((amountVal * unitPriceVal) * 100) / 100;
    bincome.dataValues.DV = bincome.DV !== undefined && bincome.DV !== null ? parseFloat(bincome.DV) : 0;
    bincome.dataValues.isAfn = Boolean(bincome.isAfn);

    res.status(200).json({ success: true, data: bincome.dataValues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────
export const deleteBincome = async (req, res) => {
  try {
    const { id } = req.params;
    const bincome = await Bincome.findByPk(id);
    if (!bincome) return res.status(404).json({ message: "Bincome record not found" });

    const categoryId = bincome.categoryId;

    await bincome.destroy();

    if (categoryId) {
      await removeBincomeFromCategoryBIncome(categoryId, id);
    }

    res.status(200).json({ message: "Bincome record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── HELPER: Compute initialAmount from totalPrice / unitPrice ────────────
const computeInitialAmount = (totalPrice, unitPrice) => {
  const tp = parseFloat(totalPrice) || 0;
  const up = parseFloat(unitPrice) || 0;
  if (up <= 0) return null; // can't derive
  return Math.round((tp / up) * 100) / 100;
};

export const runBackfillBincomeInitialAmount = async () => {
  let t;
  try {
    t = await sequelize.transaction();

    const rows = await Bincome.findAll({
      where: {
        [Op.or]: [
          { initialAmount: { [Op.is]: null } },
          { initialAmount: { [Op.lte]: 0 } },
        ],
      },
      attributes: [
        "id",
        "amount",
        "unitPrice",
        "initialAmount",
      ],
      transaction: t,
    });

    let updated = 0;
    let skipped = 0;
    const skippedDetails = [];

    for (const row of rows) {
      const amount = parseFloat(row.amount) || 0;
      const unitPrice = parseFloat(row.unitPrice) || 0;
      const totalPrice = amount * unitPrice;

      const initialAmount = computeInitialAmount(totalPrice, unitPrice);

      if (initialAmount === null) {
        skipped++;
        skippedDetails.push({
          id: row.id,
          reason: "Invalid amount / unitPrice (unitPrice <= 0)",
          amount: row.amount,
          unitPrice: row.unitPrice,
        });
        continue;
      }

      await row.update({ initialAmount }, { transaction: t });
      updated++;
    }

    await t.commit();
    t = null;

    return { totalChecked: rows.length, updated, skipped, skippedDetails };
  } catch (err) {
    if (t && !t.finished) {
      await t.rollback().catch(() => {});
    }
    throw err;
  }
};