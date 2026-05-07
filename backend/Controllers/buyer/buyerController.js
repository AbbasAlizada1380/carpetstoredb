import Buyer from "../../Models/buyer/buyer.js"; // adjust path as needed
import { Op } from "sequelize";

/* ===========================
   Create Buyer
=========================== */
export const createBuyer = async (req, res) => {
  try {
    const { fullname, phoneNumber, isActive, address, email } = req.body;

    if (!fullname) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const buyer = await Buyer.create({
      fullname,
      phoneNumber,
      isActive: isActive ?? true,
      address,
      email,
    });

    res.status(201).json(buyer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating buyer", error });
  }
};

/* ===========================
   Get Active Buyers
=========================== */
export const getActiveBuyers = async (req, res) => {
  try {
    const activeBuyers = await Buyer.findAll({
      where: { isActive: true },
      order: [["createdAt", "DESC"]],
    });

    res.json({
      buyers: activeBuyers,
      total: activeBuyers.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching active buyers",
      error: error.message,
    });
  }
};

/* ===========================
   Get Buyers (Paginated)
=========================== */
export const getBuyers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Buyer.findAndCountAll({
      limit,
      offset,
      order: [["id", "DESC"]],
    });

    res.json({
      buyers: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching buyers",
      error: error.message,
    });
  }
};

/* ===========================
   Get Buyer by ID
=========================== */
export const getBuyerById = async (req, res) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    res.json(buyer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching buyer", error });
  }
};

/* ===========================
   Update Buyer (PUT)
=========================== */
export const updateBuyer = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, phoneNumber, isActive, address, email } = req.body;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    await buyer.update({
      fullname,
      phoneNumber,
      isActive,
      address,
      email,
    });

    res.json(buyer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating buyer", error });
  }
};

/* ===========================
   Partial Update (PATCH)
=========================== */
export const updateBuyerProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    await buyer.update(updateData);

    res.json(buyer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating buyer", error });
  }
};

/* ===========================
   Delete Buyer
=========================== */
export const deleteBuyer = async (req, res) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    await buyer.destroy();
    res.json({ message: "Buyer deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting buyer", error });
  }
};

/* ===========================
   Search Buyers
=========================== */
export const searchBuyers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ message: "جستجو الزامی است" });
    }

    const search = q.trim();

    const buyers = await Buyer.findAll({
      where: {
        [Op.or]: [
          { fullname: { [Op.like]: `%${search}%` } },
          { phoneNumber: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { address: { [Op.like]: `%${search}%` } },
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    if (!buyers.length) {
      return res.status(404).json({ message: "هیچ نتیجه‌ای یافت نشد" });
    }

    res.json(buyers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطا در جستجو", error });
  }
};
