// controllers/stock/incomeBillController.js
import {
    IncomeBill,
    Customer,
    CustomerAccount,
    Income,
    Bincome,
    sequelize,
    Category,
    Type,
} from "../../Models/index.js";
import { Op } from "sequelize";

// ─── HELPERS ──────────────────────────────────────────────────────────────

// Generate a unique bill number: IBILL-000001, IBILL-000002, ...
const generateIncomeBillNumber = async (transaction = null) => {
    const last = await IncomeBill.findOne({
        order: [["id", "DESC"]],
        attributes: ["billNumber"],
        transaction,
    });
    let next = 1;
    if (last?.billNumber) {
        const m = last.billNumber.match(/\d+$/);
        if (m) next = parseInt(m[0], 10) + 1;
    }
    return `IBILL-${next.toString().padStart(6, "0")}`;
};

// Coerce a boolean-ish value
const coerceBoolean = (v, fieldName = "isAfn") => {
    if (typeof v === "boolean") return v;
    if (v === 1 || v === "1" || v === "true") return true;
    if (v === 0 || v === "0" || v === "false") return false;
    throw new Error(`${fieldName} must be a boolean`);
};

// Parse an optional JSON array field
const parseJsonArray = (v, fieldName) => {
    if (v === undefined || v === null) return undefined;
    if (!Array.isArray(v)) {
        throw new Error(`${fieldName} must be an array`);
    }
    return v;
};

// Compute remainingAmount + status from total/paid
const computeTotals = (totalAmount, paidAmount, discountedAmount = 0) => {
    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const discount = parseFloat(discountedAmount) || 0;
    const payable = Math.max(total - discount, 0);
    const remaining = Math.max(Math.round((payable - paid) * 100) / 100, 0);

    let status = "unpaid";
    if (remaining <= 0.009) status = "paid";
    else if (paid > 0) status = "partial";

    return {
        totalAmount: Math.round(total * 100) / 100,
        paidAmount: Math.round(paid * 100) / 100,
        remainingAmount: remaining,
        status,
    };
};

// Sync CustomerAccount arrays after a bill change
// (total = bill ids, paid/unpaid split by remaining amount)
const syncCustomerAccount = async (customerId, transaction) => {
    if (!customerId) return;

    const bills = await IncomeBill.findAll({
        where: { customerId },
        attributes: ["id", "remainingAmount"],
        transaction,
    });

    const totalIds = bills.map((b) => b.id);
    const paidIds = bills
        .filter((b) => parseFloat(b.remainingAmount) <= 0.009)
        .map((b) => b.id);
    const unpaidIds = bills
        .filter((b) => parseFloat(b.remainingAmount) > 0.009)
        .map((b) => b.id);

    let account = await CustomerAccount.findOne({
        where: { customerId },
        transaction,
        lock: true,
    });
    if (!account) {
        account = await CustomerAccount.create(
            {
                customerId,
                paid: [],
                unpaid: [],
                total: [],
                returned: [],
                pay: [],
                receive: [],
            },
            { transaction }
        );
    }

    await account.update(
        { total: totalIds, paid: paidIds, unpaid: unpaidIds },
        { transaction }
    );
};

// ======================= CREATE =======================
export const createIncomeBill = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            billNumber,
            customerId,
            totalAmount,
            paidAmount,
            remainingAmount: _ignored,   // always recomputed
            status: _ignoredStatus,      // always recomputed
            notes,
            discount_percent,
            discounted_amount,
            Incomes,
            bIncome,
            isAfn,
            DV,
        } = req.body;

        // ── Validate customer ──
        if (!customerId) {
            await t.rollback();
            return res.status(400).json({ message: "customerId is required" });
        }
        const customer = await Customer.findByPk(customerId, { transaction: t });
        if (!customer) {
            await t.rollback();
            return res.status(404).json({ message: "Customer not found" });
        }

        // ── Currency ──
        let finalIsAfn = false;
        let finalDV = 65;
        try {
            if (isAfn !== undefined) finalIsAfn = coerceBoolean(isAfn);
            if (DV !== undefined && DV !== null && DV !== "") {
                const parsed = parseFloat(DV);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    throw new Error("DV must be a non-negative number");
                }
                finalDV = parsed;
            }
        } catch (err) {
            await t.rollback();
            return res.status(400).json({ message: err.message });
        }

        // ── Arrays ──
        let finalIncomes, finalBIncome;
        try {
            finalIncomes = parseJsonArray(Incomes, "Incomes") ?? [];
            finalBIncome = parseJsonArray(bIncome, "bIncome") ?? [];
        } catch (err) {
            await t.rollback();
            return res.status(400).json({ message: err.message });
        }

        // ── Totals ──
        const discount = parseFloat(discounted_amount) || 0;
        const totals = computeTotals(
            totalAmount ?? 0,
            paidAmount ?? 0,
            discount
        );

        // ── Bill number ──
        const finalBillNumber =
            billNumber && String(billNumber).trim()
                ? String(billNumber).trim()
                : await generateIncomeBillNumber(t);

        // Check uniqueness
        const exists = await IncomeBill.findOne({
            where: { billNumber: finalBillNumber },
            transaction: t,
        });
        if (exists) {
            await t.rollback();
            return res
                .status(400)
                .json({ message: `Bill number ${finalBillNumber} already exists` });
        }

        const bill = await IncomeBill.create(
            {
                billNumber: finalBillNumber,
                customerId,
                totalAmount: totals.totalAmount,
                paidAmount: totals.paidAmount,
                remainingAmount: totals.remainingAmount,
                status: totals.status,
                notes: notes ?? null,
                discount_percent: parseFloat(discount_percent) || 0,
                discounted_amount: discount,
                Incomes: finalIncomes,
                bIncome: finalBIncome,
                isAfn: finalIsAfn,
                DV: finalDV,
            },
            { transaction: t }
        );

        await syncCustomerAccount(customerId, t);

        await t.commit();

        const created = await IncomeBill.findByPk(bill.id, {
            include: [{ model: Customer, as: "customer" }],
        });

        res.status(201).json({ message: "Income bill created", bill: created });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error("Error in createIncomeBill:", error);
        res.status(500).json({ error: error.message });
    }
};

// ======================= GET ALL =======================
export const getAllIncomeBills = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const offset = (page - 1) * limit;

        const where = {};

        if (req.query.customerId) {
            where.customerId = req.query.customerId;
        }
        if (req.query.status) {
            where.status = req.query.status;
        }
        if (req.query.isAfn !== undefined && req.query.isAfn !== "") {
            try {
                where.isAfn = coerceBoolean(req.query.isAfn);
            } catch (err) {
                return res.status(400).json({ message: err.message });
            }
        }
        if (req.query.from || req.query.to) {
            where.createdAt = {};
            if (req.query.from) {
                const d = new Date(req.query.from);
                d.setUTCHours(0, 0, 0, 0);
                where.createdAt[Op.gte] = d;
            }
            if (req.query.to) {
                const d = new Date(req.query.to);
                d.setUTCHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = d;
            }
        }

        const { count, rows } = await IncomeBill.findAndCountAll({
            where,
            include: [{ model: Customer, as: "customer" }],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
                hasNextPage: page < Math.ceil(count / limit),
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error("Error in getAllIncomeBills:", error);
        res.status(500).json({ error: error.message });
    }
};

// ======================= GET ONE =======================
export const getIncomeBillById = async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await IncomeBill.findByPk(id, {
            include: [{ model: Customer, as: "customer" }],
        });
        if (!bill) {
            return res.status(404).json({ message: "Income bill not found" });
        }

        const billJson = bill.toJSON();

        const incomeIds = Array.isArray(billJson.Incomes) ? billJson.Incomes : [];
        const bincomeIds = Array.isArray(billJson.bIncome) ? billJson.bIncome : [];

        // ─── Bulk-fetch Income + Bincome rows in parallel ──────────────────
        const [incomes, bincomes] = await Promise.all([
            incomeIds.length
                ? Income.findAll({
                    where: { id: incomeIds },
                    include: [
                        {
                            model: Category,
                            as: "category",
                            attributes: ["id", "name", "typeId"],
                            include: [
                                {
                                    model: Type,
                                    as: "type",
                                    attributes: ["id", "name"],
                                },
                            ],
                        },
                        {
                            model: Customer,
                            as: "customer",
                            attributes: ["id", "fullname"],
                        },
                    ],
                })
                : Promise.resolve([]),
            bincomeIds.length
                ? Bincome.findAll({
                    where: { id: bincomeIds },
                    include: [
                        {
                            model: Category,
                            as: "category",
                            attributes: ["id", "name", "typeId"],
                            include: [
                                {
                                    model: Type,
                                    as: "type",
                                    attributes: ["id", "name"],
                                },
                            ],
                        },
                    ],
                })
                : Promise.resolve([]),
        ]);

        // ─── Normalize Income rows (add flat category + type) ─────────────
        const incomeMap = new Map(incomes.map((i) => [i.id, i]));
        const normalizedIncomes = incomeIds
            .map((iid) => incomeMap.get(iid))
            .filter(Boolean)
            .map((inc) => {
                const plain = inc.toJSON();
                const category = plain.category || null;
                const type = category?.type || null;
                return {
                    ...plain,
                    category: category ? { id: category.id, name: category.name } : null,
                    type: type ? { id: type.id, name: type.name } : null,
                };
            });

        // ─── Normalize Bincome rows (add flat category + type) ────────────
        const bincomeMap = new Map(bincomes.map((b) => [b.id, b]));
        const normalizedBIncomes = bincomeIds
            .map((bid) => bincomeMap.get(bid))
            .filter(Boolean)
            .map((binc) => {
                const plain = binc.toJSON();
                const category = plain.category || null;
                const type = category?.type || null;
                return {
                    ...plain,
                    category: category ? { id: category.id, name: category.name } : null,
                    type: type ? { id: type.id, name: type.name } : null,
                };
            });

        // ─── Attach populated arrays + raw ids ────────────────────────────
        billJson.incomeRecords = normalizedIncomes;
        billJson.bincomeRecords = normalizedBIncomes;
        billJson.IncomeIds = incomeIds;
        billJson.BIncomeIds = bincomeIds;

        res.status(200).json({ success: true, bill: billJson });
    } catch (error) {
        console.error("Error in getIncomeBillById:", error);
        res.status(500).json({ error: error.message });
    }
};

// ======================= GET BY CUSTOMER =======================
export const getIncomeBillsByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const offset = (page - 1) * limit;

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        const { count, rows } = await IncomeBill.findAndCountAll({
            where: { customerId },
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        res.status(200).json({
            success: true,
            customer: { id: customer.id, fullname: customer.fullname },
            data: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        });
    } catch (error) {
        console.error("Error in getIncomeBillsByCustomer:", error);
        res.status(500).json({ error: error.message });
    }
};

// ======================= UPDATE =======================
export const updateIncomeBill = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            customerId,
            totalAmount,
            paidAmount,
            notes,
            discount_percent,
            discounted_amount,
            Incomes,
            bIncome,
            isAfn,
            DV,
            status,          // ignored — always recomputed
            remainingAmount, // ignored — always recomputed
            billNumber,      // rejected — immutable
        } = req.body;

        const bill = await IncomeBill.findByPk(id, { transaction: t, lock: true });
        if (!bill) {
            await t.rollback();
            return res.status(404).json({ message: "Income bill not found" });
        }

        // billNumber is immutable
        if (
            billNumber !== undefined &&
            String(billNumber).trim() !== String(bill.billNumber)
        ) {
            await t.rollback();
            return res
                .status(400)
                .json({ message: "billNumber is immutable; create a new bill instead." });
        }

        const oldCustomerId = bill.customerId;

        // ── Customer change ──
        if (customerId !== undefined && parseInt(customerId) !== parseInt(oldCustomerId)) {
            const customer = await Customer.findByPk(customerId, { transaction: t });
            if (!customer) {
                await t.rollback();
                return res.status(404).json({ message: "Customer not found" });
            }
            bill.customerId = customer.id;
        }

        // ── Currency ──
        try {
            if (isAfn !== undefined) bill.isAfn = coerceBoolean(isAfn);
            if (DV !== undefined && DV !== null && DV !== "") {
                const parsed = parseFloat(DV);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    throw new Error("DV must be a non-negative number");
                }
                bill.DV = parsed;
            }
        } catch (err) {
            await t.rollback();
            return res.status(400).json({ message: err.message });
        }

        // ── Arrays ──
        try {
            const newIncomes = parseJsonArray(Incomes, "Incomes");
            if (newIncomes !== undefined) bill.Incomes = newIncomes;
            const newBIncome = parseJsonArray(bIncome, "bIncome");
            if (newBIncome !== undefined) bill.bIncome = newBIncome;
        } catch (err) {
            await t.rollback();
            return res.status(400).json({ message: err.message });
        }

        // ── Notes / discount ──
        if (notes !== undefined) bill.notes = notes ?? null;
        if (discount_percent !== undefined) {
            bill.discount_percent = parseFloat(discount_percent) || 0;
        }

        // ── Amounts (recompute) ──
        const newTotal = totalAmount !== undefined
            ? parseFloat(totalAmount)
            : parseFloat(bill.totalAmount);
        const newPaid = paidAmount !== undefined
            ? parseFloat(paidAmount)
            : parseFloat(bill.paidAmount);
        const newDiscount = discounted_amount !== undefined
            ? parseFloat(discounted_amount)
            : parseFloat(bill.discounted_amount) || 0;

        if (
            [newTotal, newPaid, newDiscount].some(
                (n) => !Number.isFinite(n) || n < 0
            )
        ) {
            await t.rollback();
            return res
                .status(400)
                .json({ message: "totalAmount, paidAmount, discounted_amount must be non-negative numbers" });
        }

        const totals = computeTotals(newTotal, newPaid, newDiscount);
        bill.totalAmount = totals.totalAmount;
        bill.paidAmount = totals.paidAmount;
        bill.remainingAmount = totals.remainingAmount;
        bill.status = totals.status;
        bill.discounted_amount = newDiscount;

        await bill.save({ transaction: t });

        // ── Sync account for old and new customers ──
        if (oldCustomerId !== bill.customerId) {
            await syncCustomerAccount(oldCustomerId, t);
        }
        await syncCustomerAccount(bill.customerId, t);

        await t.commit();

        const updated = await IncomeBill.findByPk(bill.id, {
            include: [{ model: Customer, as: "customer" }],
        });

        res.status(200).json({ message: "Income bill updated", bill: updated });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error("Error in updateIncomeBill:", error);
        res.status(500).json({ error: error.message });
    }
};

// ======================= DELETE =======================
export const deleteIncomeBill = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const bill = await IncomeBill.findByPk(id, { transaction: t, lock: true });
        if (!bill) {
            await t.rollback();
            return res.status(404).json({ message: "Income bill not found" });
        }

        const customerId = bill.customerId;

        // ── Safety: reject if any payment was applied (paidAmount > 0) ──
        // If you'd rather allow deletion and reverse payments, that requires
        // undoing receipts/pays — out of scope for this CRUD controller.
        if (parseFloat(bill.paidAmount) > 0.009) {
            await t.rollback();
            return res.status(400).json({
                message:
                    "Cannot delete a bill that has received payments. Reverse the payments first.",
            });
        }

        await bill.destroy({ transaction: t });
        await syncCustomerAccount(customerId, t);

        await t.commit();
        res.status(200).json({ message: "Income bill deleted" });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error("Error in deleteIncomeBill:", error);
        res.status(500).json({ error: error.message });
    }
};