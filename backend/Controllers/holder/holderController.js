import { Holder, Valet } from "../../Models/index.js";
import { Op, fn, col, literal } from "sequelize";

/* =========================================================
   Create Holder
   POST /api/holders
   body: { fullName, NIC }
   ========================================================= */
export const createHolder = async (req, res) => {
  try {
    const { fullName, NIC } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: "نام کامل الزامی است" });
    }
    if (!NIC || !NIC.trim()) {
      return res.status(400).json({ message: "شماره تذکره الزامی است" });
    }

    const holder = await Holder.create({
      fullName: fullName.trim(),
      NIC: NIC.trim(),
    });

    res.status(201).json({
      success: true,
      message: "حامل با موفقیت ثبت شد",
      holder,
    });
  } catch (error) {
    console.error("createHolder error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "این شماره تذکره قبلاً ثبت شده است",
        error: error.errors.map((e) => e.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "خطا در ثبت حامل",
      error: error.message,
    });
  }
};

/* =========================================================
   Get Holders (paginated + search)
   GET /api/holders?page&limit&q
   ========================================================= */
export const getHolders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.q && req.query.q.trim()) {
      const q = `%${req.query.q.trim()}%`;
      where[Op.or] = [
        { fullName: { [Op.like]: q } },
        { NIC: { [Op.like]: q } },
      ];
    }

    const { count, rows } = await Holder.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    /* Include each holder's computed balance */
    const holdersWithBalance = await Promise.all(
      rows.map(async (h) => {
        const balanceRow = await Valet.findOne({
          where: { holder: h.id },
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

        return {
          ...h.toJSON(),
          balance: Number(balanceRow?.balance || 0),
        };
      })
    );

    res.json({
      holders: holdersWithBalance,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error("getHolders error:", error);
    res.status(500).json({
      message: "خطا در دریافت حاملین",
      error: error.message,
    });
  }
};

/* =========================================================
   Get Holder by ID (with valet entries)
   GET /api/holders/:id
   ========================================================= */
export const getHolderById = async (req, res) => {
  try {
    const holder = await Holder.findByPk(req.params.id, {
      include: [
        {
          model: Valet,
          as: "valets",
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!holder) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    const balance = (holder.valets || []).reduce(
      (sum, v) =>
        sum + (v.type === "deposit" ? Number(v.amount) : -Number(v.amount)),
      0
    );

    res.json({
      ...holder.toJSON(),
      balance,
    });
  } catch (error) {
    console.error("getHolderById error:", error);
    res.status(500).json({
      message: "خطا در دریافت حامل",
      error: error.message,
    });
  }
};

/* =========================================================
   Update Holder (full)
   PUT /api/holders/:id
   ========================================================= */
export const updateHolder = async (req, res) => {
  try {
    const holder = await Holder.findByPk(req.params.id);
    if (!holder) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    const { fullName, NIC } = req.body;

    if (fullName !== undefined && !fullName.trim()) {
      return res.status(400).json({ message: "نام کامل الزامی است" });
    }
    if (NIC !== undefined && !NIC.trim()) {
      return res.status(400).json({ message: "شماره تذکره الزامی است" });
    }

    await holder.update({
      fullName: fullName != null ? fullName.trim() : holder.fullName,
      NIC: NIC != null ? NIC.trim() : holder.NIC,
    });

    res.json({
      success: true,
      message: "حامل با موفقیت به‌روزرسانی شد",
      holder,
    });
  } catch (error) {
    console.error("updateHolder error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "این شماره تذکره قبلاً ثبت شده است",
      });
    }

    res.status(500).json({
      message: "خطا در به‌روزرسانی حامل",
      error: error.message,
    });
  }
};

/* =========================================================
   Partial Update
   PATCH /api/holders/:id
   ========================================================= */
export const updateHolderProperties = async (req, res) => {
  try {
    const holder = await Holder.findByPk(req.params.id);
    if (!holder) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    const allowed = ["fullName", "NIC"];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    if (updates.fullName) updates.fullName = updates.fullName.trim();
    if (updates.NIC) updates.NIC = updates.NIC.trim();

    await holder.update(updates);

    res.json({
      success: true,
      message: "حامل با موفقیت به‌روزرسانی شد",
      holder,
    });
  } catch (error) {
    console.error("updateHolderProperties error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "این شماره تذکره قبلاً ثبت شده است",
      });
    }

    res.status(500).json({
      message: "خطا در به‌روزرسانی حامل",
      error: error.message,
    });
  }
};

/* =========================================================
   Delete Holder
   DELETE /api/holders/:id
   (RESTRICT if they have valet entries)
   ========================================================= */
export const deleteHolder = async (req, res) => {
  try {
    const holder = await Holder.findByPk(req.params.id);
    if (!holder) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    const valetCount = await Valet.count({
      where: { holder: holder.id },
    });

    if (valetCount > 0) {
      return res.status(400).json({
        success: false,
        message: `این حامل ${valetCount} رکورد مالی دارد و قابل حذف نیست`,
      });
    }

    await holder.destroy();

    res.json({
      success: true,
      message: "حامل با موفقیت حذف شد",
      deletedId: holder.id,
    });
  } catch (error) {
    console.error("deleteHolder error:", error);
    res.status(500).json({
      message: "خطا در حذف حامل",
      error: error.message,
    });
  }
};

/* =========================================================
   Holder balance
   GET /api/holders/:id/balance
   ========================================================= */
export const getHolderBalance = async (req, res) => {
  try {
    const holder = await Holder.findByPk(req.params.id, {
      attributes: ["id", "fullName", "NIC"],
    });
    if (!holder) {
      return res.status(404).json({ message: "حامل یافت نشد" });
    }

    const row = await Valet.findOne({
      where: { holder: holder.id },
      attributes: [
        [fn("COUNT", col("id")), "count"],
        [
          fn("SUM", literal("CASE WHEN type = 'deposit' THEN amount ELSE 0 END")),
          "totalDeposit",
        ],
        [
          fn("SUM", literal("CASE WHEN type = 'withdraw' THEN amount ELSE 0 END")),
          "totalWithdraw",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN type = 'deposit' THEN amount ELSE -amount END")
          ),
          "balance",
        ],
      ],
      raw: true,
    });

    res.json({
      holder,
      count: Number(row?.count || 0),
      totalDeposit: Number(row?.totalDeposit || 0),
      totalWithdraw: Number(row?.totalWithdraw || 0),
      balance: Number(row?.balance || 0),
    });
  } catch (error) {
    console.error("getHolderBalance error:", error);
    res.status(500).json({
      message: "خطا در محاسبه موجودی",
      error: error.message,
    });
  }
};