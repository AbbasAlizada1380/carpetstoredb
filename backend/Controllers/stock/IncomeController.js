// Controllers/stock/IncomeController.js
import { IncomeBill, Pay, CustomerAccount, Customer } from "../../Models/index.js";
import { Income, Type, Category } from "../../Models/index.js";
import sequelize from "../../dbconnection.js";

const calculateLength = (area, width) => {
  if (!area || !width || width === 0) return null;
  return area / width;
};

// Update customer account with BILL ID using safe JSON operations
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
    // Add to paid, remove from unpaid only if exists
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
    // Add to unpaid, remove from paid only if exists
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

// Add Pay ID to customer account's pay array using raw SQL
const addPayToCustomerAccount = async (customerId, payId) => {
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

  // Append payId to pay array
  await db.query(
    `UPDATE CustomerAccounts 
     SET pay = JSON_ARRAY_APPEND(COALESCE(pay, JSON_ARRAY()), '$', :payId)
     WHERE customerId = :customerId`,
    { replacements: { payId, customerId }, type: db.QueryTypes.UPDATE }
  );
};

// Add income ID to Category.EIncome (already uses raw SQL, keep as is)
const addIncomeToCategoryEIncome = async (categoryId, incomeId) => {
  if (!categoryId || !incomeId) return;
  const db = Category.sequelize;
  await db.query(
    `UPDATE Categories 
     SET EIncome = JSON_ARRAY_APPEND(COALESCE(EIncome, JSON_ARRAY()), '$', :incomeId) 
     WHERE id = :categoryId`,
    { replacements: { categoryId, incomeId }, type: db.QueryTypes.UPDATE }
  );
};

// Generate unique bill number
const generateBillNumber = async () => {
  const lastBill = await IncomeBill.findOne({ order: [['id', 'DESC']], attributes: ['billNumber'] });
  let nextNumber = 1;
  if (lastBill && lastBill.billNumber) {
    const match = lastBill.billNumber.match(/\d+$/);
    if (match) nextNumber = parseInt(match[0]) + 1;
  }
  return `INV-${nextNumber.toString().padStart(6, '0')}`;
};

export const createIncome = async (req, res) => {
  let transaction;

  try {
    let { incomes, customerId, newCustomer, totalReceipt } = req.body;

    if (!incomes && req.body.typeId) incomes = [req.body];
    if (!incomes || !Array.isArray(incomes) || incomes.length === 0) {
      return res.status(400).json({ message: "Incomes array is required and must not be empty" });
    }

    transaction = await sequelize.transaction();

    // ----- Customer handling -----
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

    // ----- Create incomes -----
    const createdIncomes = [];
    const lotNumbersSet = new Set();

    for (let i = 0; i < incomes.length; i++) {
      const inc = incomes[i];
      const { typeId, categoryId, width, color, degree, lotNumber, area, unit_price, amount } = inc;

      // Validation (unchanged)
      if (!typeId) throw new Error(`Income ${i + 1}: Type ID is required`);
      if (!categoryId) throw new Error(`Income ${i + 1}: Category ID is required`);
      if (!width || parseFloat(width) <= 0) throw new Error(`Income ${i + 1}: Width must be a positive number`);
      if (!area || parseFloat(area) <= 0) throw new Error(`Income ${i + 1}: Area must be a positive number`);
      if (!color?.trim()) throw new Error(`Income ${i + 1}: Color is required`);
      if (!lotNumber?.trim()) throw new Error(`Income ${i + 1}: Lot number is required`);
      if (!unit_price || parseFloat(unit_price) <= 0) throw new Error(`Income ${i + 1}: Unit price must be a positive number`);

      if (lotNumbersSet.has(lotNumber.trim())) {
        throw new Error(`Income ${i + 1}: Duplicate lot number "${lotNumber}" within the same request`);
      }
      lotNumbersSet.add(lotNumber.trim());

      const existingIncome = await Income.findOne({ where: { lotNumber: lotNumber.trim() }, transaction });
      if (existingIncome) throw new Error(`Income ${i + 1}: Lot number "${lotNumber}" already exists`);

      const typeExists = await Type.findByPk(typeId, { transaction });
      if (!typeExists) throw new Error(`Income ${i + 1}: Invalid Type ID ${typeId}`);
      const categoryExists = await Category.findByPk(categoryId, { transaction });
      if (!categoryExists) throw new Error(`Income ${i + 1}: Invalid Category ID ${categoryId}`);

      const length = calculateLength(parseFloat(area), parseFloat(width));
      if (!length) throw new Error(`Income ${i + 1}: Could not calculate length from area and width`);

      const calculatedAmount = parseFloat(area) * parseFloat(unit_price);
      if (Math.abs(calculatedAmount - parseFloat(amount)) > 0.01) {
        throw new Error(`Income ${i + 1}: Amount mismatch – expected ${calculatedAmount}, received ${amount}`);
      }

      const newIncome = await Income.create({
        width: parseFloat(width),
        color: color.trim(),
        degree: degree?.trim() || null,
        lotNumber: lotNumber.trim(),
        area: parseFloat(area),
        length: parseFloat(length),
        customerId: finalCustomerId,
        typeId,
        categoryId,
        unit_price: parseFloat(unit_price),
        amount: parseFloat(amount),
        paidAmount: 0,
        remaind: parseFloat(amount),
      }, { transaction });

      createdIncomes.push(newIncome);
    }

    await transaction.commit();
    transaction = null;

    // ----- Apply payment to incomes (update remaind & paidAmount) -----
    let remainingReceipt = parseFloat(totalReceipt) || 0;
    const totalInvoiceAmount = createdIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);

    if (remainingReceipt > totalInvoiceAmount + 0.01) {
      return res.status(400).json({ message: "Payment amount exceeds total invoice amount" });
    }

    const sortedIncomes = [...createdIncomes].sort((a, b) => a.id - b.id);
    for (const income of sortedIncomes) {
      if (remainingReceipt <= 0) break;
      const currentRemaind = parseFloat(income.remaind);
      const amountToPay = Math.min(remainingReceipt, currentRemaind);
      const newPaidAmount = parseFloat(income.paidAmount) + amountToPay;
      const newRemaind = currentRemaind - amountToPay;
      await income.update({ paidAmount: newPaidAmount, remaind: newRemaind });
      remainingReceipt -= amountToPay;
    }

    // ----- Update Category.EIncome (append income IDs) -----
    for (const income of createdIncomes) {
      await addIncomeToCategoryEIncome(income.categoryId, income.id);
    }

    // ----- Create incomeBill -----
    const billNumber = await generateBillNumber();
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
      Incomes: createdIncomes.map(i => i.id),
    });

    // ----- Create Pay record if payment was received, and add its ID to CustomerAccount.pay -----
    let newPay = null;
    if (totalPaid > 0) {
      newPay = await Pay.create({
        customerId: finalCustomerId,
        amountofmoney: totalPaid,
        description: `پرداخت بابت فاکتور ${billNumber}`,
      });
      // This will now work reliably using raw SQL
      await addPayToCustomerAccount(finalCustomerId, newPay.id);
    }

    // ----- Update CustomerAccount with the BILL ID (paid/unpaid/total arrays) -----
    const isBillFullyPaid = (billStatus === 'paid');
    await updateCustomerAccountWithBill(finalCustomerId, newBill.id, isBillFullyPaid);

    // ----- Fetch detailed incomes for response -----
    const incomesWithDetails = await Income.findAll({
      where: { id: createdIncomes.map(i => i.id) },
      include: [
        { model: Category, as: "category" },
        { model: Type, as: "type" },
        { model: Customer, as: "customer" },
      ],
    });

    res.status(201).json({
      message: `${createdIncomes.length} income(s) created successfully`,
      incomes: incomesWithDetails,
      bill: newBill,
      pay: newPay,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error in createIncome:", error);
    res.status(500).json({ error: error.message });
  }
};
// ======================= READ ALL (with pagination) =======================
export const getAllIncomes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Income.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      items: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= READ ONE =======================
export const getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await Income.findByPk(id);
    if (!income) return res.status(404).json({ message: "Income record not found" });
    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= UPDATE =======================
export const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { width, color, degree, lotNumber, area, categoryId } = req.body;

    const income = await Income.findByPk(id);
    if (!income) return res.status(404).json({ message: "Income record not found" });

    const oldCategoryId = income.categoryId;
    let newCategoryId = categoryId;

    // Update fields if provided
    if (width !== undefined) income.width = width;
    if (color !== undefined) income.color = color;
    if (degree !== undefined) income.degree = degree;
    if (lotNumber !== undefined) income.lotNumber = lotNumber;
    if (area !== undefined) income.area = area;
    if (newCategoryId !== undefined) income.categoryId = newCategoryId;

    // Recalculate length if width or area changed
    if ((width !== undefined && width > 0) || (area !== undefined && area > 0)) {
      const finalWidth = width !== undefined ? width : income.width;
      const finalArea = area !== undefined ? area : income.area;
      if (finalWidth > 0 && finalArea > 0) {
        income.length = finalArea / finalWidth;
      } else {
        return res.status(400).json({ message: "Width and area must be positive to recalculate length" });
      }
    }

    // Check lotNumber uniqueness if changed
    if (lotNumber !== undefined && lotNumber !== income.lotNumber) {
      const existing = await Income.findOne({ where: { lotNumber } });
      if (existing) return res.status(400).json({ message: "Lot number already exists" });
    }

    await income.save();

    // If category changed, update EIncome arrays
    if (newCategoryId !== undefined && newCategoryId !== oldCategoryId) {
      if (oldCategoryId) await removeIncomeFromCategoryEIncome(oldCategoryId, id);
      if (newCategoryId) await addIncomeToCategoryEIncome(newCategoryId, id);
    }

    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================= DELETE =======================
export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const income = await Income.findByPk(id);
    if (!income) return res.status(404).json({ message: "Income record not found" });

    const categoryId = income.categoryId;

    await income.destroy();

    // Remove income ID from Category.EIncome
    if (categoryId) {
      await removeIncomeFromCategoryEIncome(categoryId, id);
    }

    res.status(200).json({ message: "Income record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};