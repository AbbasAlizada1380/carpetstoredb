import sequelize from "../../dbconnection.js";
import {Customer} from "../../Models/index.js";
import Exist from "../../Models/Stock/exist.js";
import { Op } from "sequelize";
import { Bill, Buyer, Sells, Category, Income } from "../../Models/index.js"; // ensure Sells is imported
/* ===============================
   GET ALL BILLS (with customer, sells items, products)
================================ */

export const getAllBills = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // First, get paginated bills
    const { count, rows } = await Bill.findAndCountAll({
      distinct: true,
      include: [
        {
          model: Buyer,
          as: "buyer",
          attributes: ["id", "fullname", "phoneNumber"],
        },
      ],
      attributes: [
        "id", "billNumber", "buyerId", "date", "totalAmount", "paidAmount",
        "remainingAmount", "status", "notes", "discount_percent", "discounted_amount",
        "sells", "createdAt", "updatedAt"
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Collect all unique sell IDs from all bills
    const allSellIds = new Set();
    for (const bill of rows) {
      const sellIds = bill.sells || [];
      sellIds.forEach(id => allSellIds.add(id));
    }

    // Fetch all sell records in one go
    const sellsMap = new Map();
    if (allSellIds.size > 0) {
      const sells = await Sells.findAll({
        where: { id: Array.from(allSellIds) },
        include: [
          { model: Category, as: "categoryDetail" },
          { model: Income, as: "income" },
          { model: Buyer, as: "buyer" },
        ],
      });
      sells.forEach(sell => sellsMap.set(sell.id, sell));
    }

    // Attach sell records to each bill
    const billsWithSells = rows.map(bill => {
      const billJson = bill.toJSON();
      const sellIds = bill.sells || [];
      billJson.sellRecords = sellIds.map(id => sellsMap.get(id)).filter(s => s);
      return billJson;
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      bills: billsWithSells,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error in getAllBills:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bills", error: error.message });
  }
};

/* ===============================
   GET SINGLE BILL BY ID
================================ */
export const getBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await Bill.findByPk(id, {
      include: [
        {
          model: Buyer,
          as: "buyer",
          attributes: ["id", "fullname", "phoneNumber"],
        },
      ],
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    // Manually fetch sells using the IDs stored in bill.sells (array of integers)
    let sells = [];
    if (bill.sells && Array.isArray(bill.sells) && bill.sells.length > 0) {
      sells = await Sells.findAll({
        where: { id: bill.sells },
      });
    }

    // Convert bill to plain object and attach the sells array
    const billData = bill.toJSON();
    billData.sells = sells;   // or billData.items = sells

    res.json({ success: true, bill: billData });
  } catch (error) {
    console.error("Error in getBillById:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/* ===============================
   GET BILLS BY DATE RANGE
================================ */
export const getBillsByDateRange = async (req, res) => {
  const { from, to, customerId } = req.query;
  if (!from || !to) {
    return res.status(400).json({ success: false, message: "from and to dates are required" });
  }

  try {
    const startDate = new Date(`${from}T00:00:00`);
    const endDate = new Date(`${to}T23:59:59`);

    const whereClause = {
      date: { [Op.between]: [startDate, endDate] },
    };
    if (customerId) {
      whereClause.customerId = customerId;
    }

    const bills = await Bill.findAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "fullname", "phoneNumber"],
        },
        {
          model: Sells,
          as: "items",
          include: [
            {
              model: StockExist,
              as: "product",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["date", "DESC"]],
    });

    const totalBilled = bills.reduce((sum, b) => sum + parseFloat(b.totalAmount), 0);
    const totalPaid = bills.reduce((sum, b) => sum + parseFloat(b.paidAmount), 0);
    const totalRemaining = totalBilled - totalPaid;

    res.json({
      success: true,
      bills,
      summary: {
        totalBills: bills.length,
        totalAmount: totalBilled,
        totalPaid,
        totalRemaining,
      },
      filters: { from, to, customerId: customerId || null },
    });
  } catch (error) {
    console.error("Error in getBillsByDateRange:", error);
    res.status(500).json({ success: false, message: "Error fetching bills", error: error.message });
  }
};

/* ===============================
   GET BILLS BY CUSTOMER ID
================================ */
export const getBillsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const bills = await Bill.findAll({
      where: { customerId },
      include: [
        {
          model: Sells,
          as: "items",
          include: [
            {
              model: StockExist,
              as: "product",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const totalSpent = bills.reduce((sum, b) => sum + parseFloat(b.totalAmount), 0);
    const totalPaid = bills.reduce((sum, b) => sum + parseFloat(b.paidAmount), 0);

    res.json({
      success: true,
      customer: { id: customer.id, fullname: customer.fullname },
      bills,
      summary: {
        totalBills: bills.length,
        totalSpent,
        totalPaid,
        outstandingBalance: totalSpent - totalPaid,
      },
    });
  } catch (error) {
    console.error("Error in getBillsByCustomer:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/* ===============================
   GET FILTERED BILLS (by buyer and/or date range based on createdAt)
================================ */
export const getFilteredBills = async (req, res) => {
  try {
    const { customerId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const where = {};

    // Filter by buyer (customerId maps to buyerId)
    if (customerId) {
      where.buyerId = customerId;
    }

    // Date range filter based on createdAt
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        where.createdAt[Op.gte] = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);

    const { count, rows: bills } = await Bill.findAndCountAll({
      where,
      include: [
        {
          model: Buyer,
          as: "buyer",
          attributes: ["id", "fullname", "phoneNumber"],
        },
      ],
      attributes: [
        "id", "billNumber", "buyerId", "date", "totalAmount", "paidAmount",
        "remainingAmount", "status", "notes", "discount_percent", "discounted_amount",
        "sells", "createdAt", "updatedAt"
      ],
      order: [["createdAt", "DESC"]],
      limit: pageLimit,
      offset,
    });

    // Attach sell records (same as getAllBills)
    const allSellIds = new Set();
    for (const bill of bills) {
      const sellIds = bill.sells || [];
      sellIds.forEach(id => allSellIds.add(id));
    }
    const sellsMap = new Map();
    if (allSellIds.size > 0) {
      const sells = await Sells.findAll({
        where: { id: Array.from(allSellIds) },
        include: [
          { model: Category, as: "categoryDetail" },
          { model: Income, as: "income" },
          { model: Buyer, as: "buyer" },
        ],
      });
      sells.forEach(sell => sellsMap.set(sell.id, sell));
    }
    const billsWithSells = bills.map(bill => {
      const billJson = bill.toJSON();
      const sellIds = bill.sells || [];
      billJson.sellRecords = sellIds.map(id => sellsMap.get(id)).filter(s => s);
      return billJson;
    });

    const totalPages = Math.ceil(count / pageLimit);

    res.json({
      success: true,
      bills: billsWithSells,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: pageLimit,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getFilteredBills:", error);
    res.status(500).json({ success: false, message: "Failed to fetch filtered bills", error: error.message });
  }
};