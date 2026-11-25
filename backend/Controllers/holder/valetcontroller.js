import { Valet, Holder } from "../../Models/index.js";
import { Op, fn, col, literal } from "sequelize";

/* =========================================================
   Create Valet entry
   POST /api/valets
   body: { amount, holder, type, source?, description? }

   Rules:
     - deposit  → source is forced to "valet" (in the model hook)
     - withdraw, source = "valet"    → must not exceed holder's current balance
     - withdraw, source = "business" → no balance limit
   ========================================================= */
export const createValet = async (req, res) => {
  try {
    const { amount, holder, type, source, description } = req.body;

    /* --- Base validation --- */
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "مبلغ نامعتبر است" });
    }
    if (!holder) {
      return res.status(400).json({ message: "شناسه حامل الزامی است" });
    }
    if (!["deposit", "withdraw"].includes(type)) {
      return res
        .status(400)
        .json({ message: "نوع تراکنش نامعتبر است (deposit یا withdraw)" });
    }

    /* --- Source validation (withdraw only) --- */
    if (type === "withdraw") {
      if (!source) {
        return res.status(400).json({
          message: "برای برداشت، انتخاب منبع (والټ یا کسب‌وکار) الزامی است",
        });
      }
      if (!["valet", "business"].includes(source)) {
        return res
          .status(400)
          .json({ message: "منبع نامعتبر است (valet یا business)" });
      }
    }

    /* --- Confirm holder exists --- */
    const holderRow = await Holder.findByPk(holder);
    if (!holderRow) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    /* -------------------------------------------------------
       Overdraft check:
       Only enforced when the withdraw is FROM THE VALET wallet.
       Withdrawals from a business are not capped.
       ------------------------------------------------------- */
    if (type === "withdraw" && source === "valet") {
      const balanceRow = await Valet.findOne({
        where: { holder },
        attributes: [
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN type = 'deposit' THEN amount ELSE -amount END"
              )
            ),
            "balance",
          ],
        ],
        raw: true,
      });

      const currentBalance = Number(balanceRow?.balance || 0);
      if (amt > currentBalance) {
        return res.status(400).json({
          success: false,
          message: `موجودی والټ کافی نیست. موجودی فعلی: ${currentBalance} افغانی`,
          currentBalance,
        });
      }
    }

    /* -------------------------------------------------------
       Resolve source:
         - deposit  → "valet"
         - withdraw → whatever came from the frontend
       ------------------------------------------------------- */
    const resolvedSource = type === "deposit" ? "valet" : source;

    const valet = await Valet.create({
      amount: amt,
      holder,
      type,
      source: resolvedSource,
      description: description ? String(description).trim() : null,
    });

    res.status(201).json({
      success: true,
      message: "تراکنش با موفقیت ثبت شد",
      valet,
    });
  } catch (error) {
    console.error("createValet error:", error);
    res.status(500).json({
      success: false,
      message: "خطا در ثبت تراکنش",
      error: error.message,
    });
  }
};

/* =========================================================
   Get Valet entries (paginated + filters)
   GET /api/valets?page&limit&holder&type&source&from&to
   ========================================================= */
export const getValets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.holder) where.holder = req.query.holder;
    if (req.query.type) where.type = req.query.type;
    if (req.query.source) where.source = req.query.source;

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) {
        const f = new Date(req.query.from);
        f.setHours(0, 0, 0, 0);
        where.createdAt[Op.gte] = f;
      }
      if (req.query.to) {
        const t = new Date(req.query.to);
        t.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = t;
      }
    }

    const { count, rows } = await Valet.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Holder,
          as: "Holder", // ✅ FIXED: Matches the alias in the model
          attributes: ["id", "fullName", "NIC"],
        },
      ],
    });

    /* Totals across the filtered set */
    const totals = await Valet.findOne({
      where,
      attributes: [
        [fn("COUNT", col("id")), "count"],
        [
          fn(
            "SUM",
            literal("CASE WHEN type = 'deposit' THEN amount ELSE 0 END")
          ),
          "totalDeposit",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN type = 'withdraw' THEN amount ELSE 0 END")
          ),
          "totalWithdraw",
        ],
      ],
      raw: true,
    });

    res.json({
      valets: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
      totals: {
        count: Number(totals?.count || 0),
        totalDeposit: Number(totals?.totalDeposit || 0),
        totalWithdraw: Number(totals?.totalWithdraw || 0),
        net:
          Number(totals?.totalDeposit || 0) -
          Number(totals?.totalWithdraw || 0),
      },
    });
  } catch (error) {
    console.error("getValets error:", error);
    res.status(500).json({
      message: "خطا در دریافت تراکنش‌ها",
      error: error.message,
    });
  }
};

/* =========================================================
   Get Valet by ID
   ========================================================= */
export const getValetById = async (req, res) => {
  try {
    const valet = await Valet.findByPk(req.params.id, {
      include: [
        {
          model: Holder,
          as: "Holder", // ✅ FIXED
          attributes: ["id", "fullName", "NIC"],
        },
      ],
    });

    if (!valet) {
      return res.status(404).json({ message: "تراکنش یافت نشد" });
    }

    res.json(valet);
  } catch (error) {
    console.error("getValetById error:", error);
    res.status(500).json({
      message: "خطا در دریافت تراکنش",
      error: error.message,
    });
  }
};

/* =========================================================
   Get Valet entries of one Holder
   ========================================================= */
export const getValetsByHolder = async (req, res) => {
  try {
    const { holderId } = req.params;

    const holder = await Holder.findByPk(holderId, {
      attributes: ["id", "fullName", "NIC"],
    });
    if (!holder) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    const entries = await Valet.findAll({
      where: { holder: holderId },
      order: [["createdAt", "DESC"]],
    });

    const balance = entries.reduce(
      (sum, v) =>
        sum + (v.type === "deposit" ? Number(v.amount) : -Number(v.amount)),
      0
    );

    res.json({
      holder,
      entries,
      count: entries.length,
      balance,
    });
  } catch (error) {
    console.error("getValetsByHolder error:", error);
    res.status(500).json({
      message: "خطا در دریافت تراکنش‌های حامل",
      error: error.message,
    });
  }
};

/* =========================================================
   Update Valet (full)
   PUT /api/valets/:id
   ========================================================= */
export const updateValet = async (req, res) => {
  try {
    const valet = await Valet.findByPk(req.params.id);
    if (!valet) {
      return res.status(404).json({ message: "تراکنش یافت نشد" });
    }

    const { amount, holder, type, source, description } = req.body;

    if (amount != null && Number(amount) <= 0) {
      return res.status(400).json({ message: "مبلغ نامعتبر است" });
    }
    if (type != null && !["deposit", "withdraw"].includes(type)) {
      return res.status(400).json({ message: "نوع تراکنش نامعتبر است" });
    }
    if (holder != null) {
      const exists = await Holder.findByPk(holder);
      if (!exists) {
        return res.status(404).json({ message: "حامل یافت نشد" });
      }
    }

    /* Resolve effective values */
    const nextType = type != null ? type : valet.type;
    const nextSource = source !== undefined ? source : valet.source;
    const nextAmount = amount != null ? Number(amount) : valet.amount;
    const nextHolder = holder != null ? holder : valet.holder;

    /* Source rules */
    if (nextType === "withdraw") {
      if (!nextSource) {
        return res.status(400).json({
          message: "برای برداشت، انتخاب منبع (والټ یا کسب‌وکار) الزامی است",
        });
      }
      if (!["valet", "business"].includes(nextSource)) {
        return res
          .status(400)
          .json({ message: "منبع نامعتبر است (valet یا business)" });
      }
    }

    /* Overdraft check — only for valet withdrawals */
    if (nextType === "withdraw" && nextSource === "valet") {
      const balanceRow = await Valet.findOne({
        where: {
          holder: nextHolder,
          id: { [Op.ne]: valet.id }, // exclude the row being edited
        },
        attributes: [
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN type = 'deposit' THEN amount ELSE -amount END"
              )
            ),
            "balance",
          ],
        ],
        raw: true,
      });

      const balanceWithoutThis = Number(balanceRow?.balance || 0);
      if (nextAmount > balanceWithoutThis) {
        return res.status(400).json({
          success: false,
          message: `موجودی والټ کافی نیست. موجودی فعلی: ${balanceWithoutThis} افغانی`,
          currentBalance: balanceWithoutThis,
        });
      }
    }

    /* Resolve the source for the update:
       - deposit → "valet"
       - withdraw → user's choice */
    const resolvedSource = nextType === "deposit" ? "valet" : nextSource;

    await valet.update({
      amount: nextAmount,
      holder: nextHolder,
      type: nextType,
      source: resolvedSource,
      description:
        description !== undefined
          ? description
            ? String(description).trim()
            : null
          : valet.description,
    });

    res.json({
      success: true,
      message: "تراکنش با موفقیت به‌روزرسانی شد",
      valet,
    });
  } catch (error) {
    console.error("updateValet error:", error);
    res.status(500).json({
      message: "خطا در به‌روزرسانی تراکنش",
      error: error.message,
    });
  }
};

/* =========================================================
   Partial Update
   PATCH /api/valets/:id
   ========================================================= */
export const updateValetProperties = async (req, res) => {
  try {
    const valet = await Valet.findByPk(req.params.id);
    if (!valet) {
      return res.status(404).json({ message: "تراکنش یافت نشد" });
    }

    const allowed = ["amount", "holder", "type", "source", "description"];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    if (updates.amount != null) {
      if (Number(updates.amount) <= 0) {
        return res.status(400).json({ message: "مبلغ نامعتبر است" });
      }
      updates.amount = Number(updates.amount);
    }
    if (
      updates.type != null &&
      !["deposit", "withdraw"].includes(updates.type)
    ) {
      return res.status(400).json({ message: "نوع تراکنش نامعتبر است" });
    }
    if (updates.description !== undefined) {
      updates.description = updates.description
        ? String(updates.description).trim()
        : null;
    }

    /* Resolve effective values */
    const nextType = updates.type ?? valet.type;
    const nextSource = updates.source ?? valet.source;
    const nextAmount = updates.amount ?? valet.amount;
    const nextHolder = updates.holder ?? valet.holder;

    /* Source rules */
    if (nextType === "withdraw") {
      if (!nextSource) {
        return res.status(400).json({
          message: "برای برداشت، انتخاب منبع (والټ یا کسب‌وکار) الزامی است",
        });
      }
      if (!["valet", "business"].includes(nextSource)) {
        return res
          .status(400)
          .json({ message: "منبع نامعتبر است (valet یا business)" });
      }
    }

    /* Overdraft check — only for valet withdrawals */
    if (nextType === "withdraw" && nextSource === "valet") {
      const balanceRow = await Valet.findOne({
        where: {
          holder: nextHolder,
          id: { [Op.ne]: valet.id },
        },
        attributes: [
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN type = 'deposit' THEN amount ELSE -amount END"
              )
            ),
            "balance",
          ],
        ],
        raw: true,
      });

      const balanceWithoutThis = Number(balanceRow?.balance || 0);
      if (nextAmount > balanceWithoutThis) {
        return res.status(400).json({
          success: false,
          message: `موجودی والټ کافی نیست. موجودی فعلی: ${balanceWithoutThis} افغانی`,
          currentBalance: balanceWithoutThis,
        });
      }
    }

    /* Same rule as create: deposit → "valet" */
    updates.source = nextType === "deposit" ? "valet" : nextSource;

    await valet.update(updates);

    res.json({
      success: true,
      message: "تراکنش با موفقیت به‌روزرسانی شد",
      valet,
    });
  } catch (error) {
    console.error("updateValetProperties error:", error);
    res.status(500).json({
      message: "خطا در به‌روزرسانی تراکنش",
      error: error.message,
    });
  }
};

/* =========================================================
   Delete Valet
   ========================================================= */
export const deleteValet = async (req, res) => {
  try {
    const valet = await Valet.findByPk(req.params.id);
    if (!valet) {
      return res.status(404).json({ message: "تراکنش یافت نشد" });
    }

    const deletedId = valet.id;
    await valet.destroy();

    res.json({
      success: true,
      message: "تراکنش با موفقیت حذف شد",
      deletedId,
    });
  } catch (error) {
    console.error("deleteValet error:", error);
    res.status(500).json({
      message: "خطا در حذف تراکنش",
      error: error.message,
    });
  }
};