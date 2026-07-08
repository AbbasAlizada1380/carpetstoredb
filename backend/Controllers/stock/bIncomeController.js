// controllers/stock/bincomeController.js
import { IncomeBill, Pay, CustomerAccount, Customer, Category } from "../../Models/index.js";
import Bincome from "../../Models/Stock/bincome.js";
import bExist from "../../Models/Stock/bExist.js";
import sequelize from "../../dbconnection.js";

// ─── HELPER: Update CustomerAccount with bill ID ──────────────────────────
const updateCustomerAccountWithBill = async (customerId, billId, isFullyPaid) => {
  const db = CustomerAccount.sequelize;

  // Ensure account exists
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

  // Always add billId to total array
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

    // ── Create Bincome records & update stock ──
    const createdBincomes = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const { categoryId, amount, weight, unitPrice } = entry;

      // Validation
      if (!categoryId) throw new Error(`Entry ${i + 1}: Category ID is required`);
      if (!amount || parseFloat(amount) <= 0) throw new Error(`Entry ${i + 1}: Amount must be a positive number`);
      // Weight is optional – only validate if it is provided
      if (weight !== undefined && weight !== null && weight !== "") {
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum <= 0) {
          throw new Error(`Entry ${i + 1}: Weight must be a positive number if provided`);
        }
      } if (!unitPrice || parseFloat(unitPrice) <= 0) throw new Error(`Entry ${i + 1}: Unit price must be a positive number`);

      const categoryExists = await Category.findByPk(categoryId, { transaction });
      if (!categoryExists) throw new Error(`Entry ${i + 1}: Invalid Category ID ${categoryId}`);

      const newBincome = await Bincome.create({
        categoryId,
        amount: parseFloat(amount),
        weight: parseFloat(weight),
        unitPrice: parseFloat(unitPrice),
        customerId: finalCustomerId,
        paidAmount: 0,
        remaind: parseFloat(amount) * parseFloat(unitPrice),
      }, { transaction });

      createdBincomes.push(newBincome);

      // Update stock
      await updateBExistStock(categoryId, amount, unitPrice, transaction);
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

    // ── Create IncomeBill ──
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
    });

    // ── Create Pay record if payment received ──
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

    // Attach totalPrice (if needed for response)
    const dataWithTotal = rows.map((item) => {
      const amount = parseFloat(item.amount) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      item.dataValues.totalPrice = Math.round((amount * unitPrice) * 100) / 100;
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
    bincome.dataValues.totalPrice = Math.round((amount * unitPrice) * 100) / 100;

    res.status(200).json({ success: true, data: bincome.dataValues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export const updateBincome = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, amount, weight, unitPrice } = req.body;

    const bincome = await Bincome.findByPk(id);
    if (!bincome) return res.status(404).json({ message: "Bincome record not found" });

    const oldCategoryId = bincome.categoryId;

    if (categoryId !== undefined) bincome.categoryId = categoryId;
    if (amount !== undefined) bincome.amount = parseFloat(amount);
    if (weight !== undefined) bincome.weight = parseFloat(weight);
    if (unitPrice !== undefined) bincome.unitPrice = parseFloat(unitPrice);

    // Recalculate remaind (total)
    if (amount !== undefined || unitPrice !== undefined) {
      bincome.remaind = bincome.amount * bincome.unitPrice;
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