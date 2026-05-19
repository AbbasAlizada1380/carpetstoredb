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

// ---------- Custom endpoints (corrected for model) ----------
// GET /api/customer-account/report/unpaid-summary
// Returns list of customers with unpaid bills, summing the remaind from IncomeBill
export const getCustomersWithUnpaid = async (req, res) => {
    try {
        // Find all CustomerAccounts with non-empty unpaid array
        const accounts = await CustomerAccount.findAll({
            where: {
                unpaid: { [Op.ne]: [] }  // not an empty array
            },
            attributes: ['customerId', 'unpaid'],
        });
        if (!accounts.length) {
            return res.status(200).json({ success: true, data: [], total: 0 });
        }
        // Collect all unpaid bill IDs
        const allUnpaidBillIds = [];
        for (const acc of accounts) {
            const unpaid = acc.unpaid || [];
            allUnpaidBillIds.push(...unpaid);
        }
        if (allUnpaidBillIds.length === 0) {
            return res.status(200).json({ success: true, data: [], total: 0 });
        }
        // Fetch IncomeBills with remainding amount > 0
        const unpaidBills = await IncomeBill.findAll({
            where: {
                id: allUnpaidBillIds,
                remainingAmount: { [Op.gt]: 0 }
            },
            attributes: ['id', 'customerId', 'remainingAmount', 'totalAmount', 'paidAmount']
        });
        // Group by customerId
        const customerMap = new Map();
        for (const bill of unpaidBills) {
            const custId = bill.customerId;
            const amount = parseFloat(bill.remainingAmount);
            if (!customerMap.has(custId)) {
                customerMap.set(custId, { total_due: 0, bills: [] });
            }
            const entry = customerMap.get(custId);
            entry.total_due += amount;
            entry.bills.push({ billId: bill.id, remaining: amount });
        }
        const customerIds = Array.from(customerMap.keys());
        const customers = await Customer.findAll({
            where: { id: customerIds },
            attributes: ['id', 'fullname']
        });
        const responseData = [];
        let grandTotal = 0;
        for (const cust of customers) {
            const data = customerMap.get(cust.id);
            responseData.push({
                customer: { id: cust.id, fullname: cust.fullname },
                total_due: data.total_due,
                details: data.bills   // optional
            });
            grandTotal += data.total_due;
        }
        return res.status(200).json({ success: true, data: responseData, total: grandTotal });
    } catch (error) {
        console.error('Error fetching customers with unpaid:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/customer-account/:customerId/sells?page=1&limit=10
// Returns sells from the customer's "total" array (which stores IncomeBill IDs, not Sells IDs)
// But the original code tried to fetch Sell records. To be consistent, we need to decide:
// The "total" array holds IncomeBill IDs. So we should fetch IncomeBill, not Sells.
// I'll change it to return bills instead of sells.
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