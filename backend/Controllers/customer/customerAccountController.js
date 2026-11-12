import sequelize from '../../dbconnection.js';
import { Income, IncomeBill, Sells, Bill, Customer, CustomerAccount } from '../../Models/index.js';
import { Op } from 'sequelize';

// ---------- CRUD for CustomerAccount (unchanged but ensure model usage) ----------
export const createCustomerAccount = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { customerId, paid, unpaid, total } = req.body;
        if (!customerId) {
            await transaction.rollback();
            return res.status(400).json({ message: 'customerId is required' });
        }
        const customer = await Customer.findByPk(customerId, { transaction });
        if (!customer) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Customer not found' });
        }
        const accountData = {
            customerId,
            paid: Array.isArray(paid) ? paid : [],
            unpaid: Array.isArray(unpaid) ? unpaid : [],
            total: Array.isArray(total) ? total : [],
        };
        const newAccount = await CustomerAccount.create(accountData, { transaction });
        await transaction.commit();
        res.status(201).json({ message: 'Customer account created successfully', data: newAccount });
    } catch (error) {
        await transaction.rollback();
        console.error('Create CustomerAccount Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getCustomerAccounts = async (req, res) => {
    try {
        const accounts = await CustomerAccount.findAll({
            include: [{ model: Customer, as: 'customer', attributes: ['id', 'fullname', 'phoneNumber'] }],
            order: [['createdAt', 'DESC']],
        });
        res.status(200).json(accounts);
    } catch (error) {
        console.error('Get CustomerAccounts Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getCustomerAccountById = async (req, res) => {
    try {
        const { id } = req.params;
        const account = await CustomerAccount.findByPk(id, {
            include: [{ model: Customer, as: 'customer', attributes: ['id', 'fullname', 'phoneNumber'] }],
        });
        if (!account) return res.status(404).json({ message: 'Customer account not found' });
        res.status(200).json(account);
    } catch (error) {
        console.error('Get CustomerAccount By ID Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const updateCustomerAccount = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { customerId, paid, unpaid, total } = req.body;
        const account = await CustomerAccount.findByPk(id, { transaction });
        if (!account) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Customer account not found' });
        }
        if (customerId && customerId !== account.customerId) {
            const customer = await Customer.findByPk(customerId, { transaction });
            if (!customer) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Customer not found' });
            }
        }
        if (customerId !== undefined) account.customerId = customerId;
        if (paid !== undefined) account.paid = Array.isArray(paid) ? paid : [];
        if (unpaid !== undefined) account.unpaid = Array.isArray(unpaid) ? unpaid : [];
        if (total !== undefined) account.total = Array.isArray(total) ? total : [];
        await account.save({ transaction });
        await transaction.commit();
        res.status(200).json({ message: 'Customer account updated successfully', data: account });
    } catch (error) {
        await transaction.rollback();
        console.error('Update CustomerAccount Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const deleteCustomerAccount = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const account = await CustomerAccount.findByPk(id, { transaction });
        if (!account) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Customer account not found' });
        }
        await account.destroy({ transaction });
        await transaction.commit();
        res.status(200).json({ message: 'Customer account deleted successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Delete CustomerAccount Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
export const getCustomersWithUnpaid = async (req, res) => {
  try {
    // Find all CustomerAccounts with non-empty unpaid array
    const accounts = await CustomerAccount.findAll({
      where: {
        unpaid: { [Op.ne]: [] }, // not an empty array
      },
      attributes: ["customerId", "unpaid"],
    });

    if (!accounts.length) {
      return res.status(200).json({
        success: true,
        data: [],
        total: { afn: 0, usd: 0 }, // ✅ NEW: grouped total
      });
    }

    // Collect all unpaid bill IDs
    const allUnpaidBillIds = [];
    for (const acc of accounts) {
      const unpaid = acc.unpaid || [];
      allUnpaidBillIds.push(...unpaid);
    }

    if (allUnpaidBillIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        total: { afn: 0, usd: 0 },
      });
    }

    // ✅ NEW: include isAfn + DV so we can group per currency
    const unpaidBills = await IncomeBill.findAll({
      where: {
        id: allUnpaidBillIds,
        remainingAmount: { [Op.gt]: 0 },
      },
      attributes: [
        "id",
        "customerId",
        "remainingAmount",
        "totalAmount",
        "paidAmount",
        "isAfn", // ✅
        "DV",    // ✅
      ],
    });

    // ✅ NEW: group by customerId AND by currency.
    // Structure:
    //   customerMap: Map<custId, {
    //     afn: { total_due, bills[], DV },
    //     usd: { total_due, bills[], DV },
    //   }>
    const customerMap = new Map();

    for (const bill of unpaidBills) {
      const custId = bill.customerId;
      const amount = parseFloat(bill.remainingAmount) || 0;
      const isAfn = !!bill.isAfn;
      const bucketKey = isAfn ? "afn" : "usd";

      if (!customerMap.has(custId)) {
        customerMap.set(custId, {
          afn: { total_due: 0, bills: [], DV: null },
          usd: { total_due: 0, bills: [], DV: null },
        });
      }

      const entry = customerMap.get(custId)[bucketKey];
      entry.total_due += amount;
      entry.bills.push({
        billId: bill.id,
        remaining: amount,
        DV: bill.DV != null ? parseFloat(bill.DV) : null,
      });

      // Track the DV used for this currency bucket. If bills disagree
      // (rare), we keep the most recent value and mark the bucket as mixed.
      const billDV = bill.DV != null ? parseFloat(bill.DV) : null;
      if (billDV != null) {
        if (entry.DV === null) entry.DV = billDV;
        else if (entry.DV !== billDV) entry.DV = "mixed";
      }
    }

    const customerIds = Array.from(customerMap.keys());
    const customers = await Customer.findAll({
      where: { id: customerIds },
      attributes: ["id", "fullname"],
    });

    // ✅ NEW: build response — one row per (customer, currency) with debt
    const responseData = [];
    const grandTotal = { afn: 0, usd: 0 };

    for (const cust of customers) {
      const buckets = customerMap.get(cust.id);
      if (!buckets) continue;

      for (const currency of ["usd", "afn"]) {
        const bucket = buckets[currency];
        if (bucket.total_due <= 0) continue;

        responseData.push({
          customer: { id: cust.id, fullname: cust.fullname },
          total_due: Number(bucket.total_due.toFixed(2)),
          isAfn: currency === "afn",
          DV: bucket.DV, // number, null, or "mixed"
          details: bucket.bills,
        });

        grandTotal[currency] += bucket.total_due;
      }
    }

    return res.status(200).json({
      success: true,
      data: responseData,
      total: {
        afn: Number(grandTotal.afn.toFixed(2)),
        usd: Number(grandTotal.usd.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error fetching customers with unpaid:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getCustomerSellsFromTotal = async (req, res) => {
    try {
        const { customerId } = req.params;
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        const offset = (page - 1) * limit;

        const account = await CustomerAccount.findOne({ where: { customerId } });
        if (!account) return res.status(404).json({ message: 'Customer account not found' });

        const billIds = account.total || [];
        const totalItems = billIds.length;
        if (totalItems === 0) {
            return res.status(200).json({ data: [], pagination: { page, limit, totalItems: 0, totalPages: 0 } });
        }

        const bills = await IncomeBill.findAll({
            where: { id: billIds },
            include: [{ model: Customer, as: 'customer', attributes: ['fullname'] }],
            order: [['createdAt', 'DESC']],
            offset,
            limit,
        });
        const totalPages = Math.ceil(totalItems / limit);
        res.status(200).json({ data: bills, pagination: { page, limit, totalItems, totalPages } });
    } catch (error) {
        console.error('Error fetching customer bills from total:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Helper to format an IncomeBill for frontend (renamed to match frontend expectations)
const formatBillForFrontend = (bill) => {
    return {
        id: bill.id,
        billNumber: bill.billNumber,
        date: bill.date,
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        remainingAmount: bill.remainingAmount,
        status: bill.status,
        Incomes: bill.Incomes,  // array of income IDs
        createdAt: bill.createdAt,
    };
};

// GET /api/customer-account/:customerId/order-items/:type
// type: 'orderId' (all), 'receiptOrders' (paid), 'remainOrders' (unpaid)
export const getCustomerOrderItemsByType = async (req, res) => {
    try {
        const { customerId, type } = req.params;
        const validTypes = ['orderId', 'receiptOrders', 'remainOrders'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: 'Invalid type. Use orderId, receiptOrders, or remainOrders' });
        }
        const account = await CustomerAccount.findOne({ where: { customerId } });
        if (!account) return res.status(404).json({ message: 'Customer account not found' });

        let billIds = [];
        if (type === 'orderId') billIds = account.total || [];
        else if (type === 'receiptOrders') billIds = account.paid || [];
        else if (type === 'remainOrders') billIds = account.unpaid || [];

        if (billIds.length === 0) {
            return res.status(200).json({ items: [], totalCount: 0, totalMoney: 0, totalReceipt: 0, totalRemaining: 0, customerName: null });
        }

        const bills = await IncomeBill.findAll({
            where: { id: billIds },
            include: [{ model: Customer, as: 'customer', attributes: ['fullname'] }],
            order: [['createdAt', 'DESC']],
        });

        const items = bills.map(formatBillForFrontend);
        const totalCount = items.length;
        const totalMoney = items.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalReceipt = items.reduce((sum, item) => sum + item.paidAmount, 0);
        const totalRemaining = items.reduce((sum, item) => sum + item.remainingAmount, 0);
        const customerName = bills[0]?.customer?.fullname || null;

        res.status(200).json({ items, totalCount, totalMoney, totalReceipt, totalRemaining, customerName });
    } catch (error) {
        console.error('Error in getCustomerOrderItemsByType:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// GET /api/customer-account/:customerId/date-range?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getCustomerOrderItemsByDateRange = async (req, res) => {
    try {
        const { customerId } = req.params;
        let { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ message: 'Both "from" and "to" dates are required' });
        const startDate = new Date(from);
        const endDate = new Date(to);
        if (isNaN(startDate) || isNaN(endDate)) return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
        endDate.setHours(23, 59, 59, 999);

        const bills = await IncomeBill.findAll({
            where: {
                customerId,
                createdAt: { [Op.between]: [startDate, endDate] }
            },
            include: [{ model: Customer, as: 'customer', attributes: ['id', 'fullname', 'phoneNumber'] }],
            order: [['createdAt', 'DESC']],
        });
        const items = bills.map(formatBillForFrontend);
        const totalItems = items.length;
        const totalMoney = items.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalReceipt = items.reduce((sum, item) => sum + item.paidAmount, 0);
        const totalRemaining = items.reduce((sum, item) => sum + item.remainingAmount, 0);
        const customer = bills[0]?.customer || null;

        res.status(200).json({
            success: true,
            data: { customer, items, summary: { totalItems, totalMoney, totalReceipt, totalRemaining } }
        });
    } catch (error) {
        console.error('Error in getCustomerOrderItemsByDateRange:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};