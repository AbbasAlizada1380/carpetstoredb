import OrderItem from "../Models/OrderItems.js";
import Customer from "../Models/Customers.js";

/* ===========================
   Create Order Item
=========================== */
export const createOrderItem = async (req, res) => {
  try {
    const { size, qnty, price, customerId } = req.body;

    if (!size || !qnty || !price || !customerId) {
      return res.status(400).json({
        message: "All fields (size, qnty, price, customerId) are required",
      });
    }

    const item = await OrderItem.create({
      size,
      qnty,
      price,
      money: qnty * price,
      customerId,
    });

    const newItem = await OrderItem.findByPk(item.id, {
      include: [{ model: Customer, as: "customer" }],
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error creating order item",
      error: error.message,
    });
  }
};

/* ===========================
   Get Order Items (Paginated)
=========================== */
export const getOrderItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await OrderItem.findAndCountAll({
      include: [{ model: Customer, as: "customer" }],
      order: [["id", "DESC"]],
      limit,
      offset,
    });

    res.json({
      orderItems: rows,
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
      message: "Error fetching order items",
      error: error.message,
    });
  }
};

/* ===========================
   Get Order Item by ID
=========================== */
export const getOrderItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await OrderItem.findByPk(id, {
      include: [{ model: Customer, as: "customer" }],
    });

    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching order item",
      error: error.message,
    });
  }
};

/* ===========================
   Update Order Item (PUT)
=========================== */
export const updateOrderItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, qnty, price, customerId } = req.body;

    const item = await OrderItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    const updatedQnty = qnty ?? item.qnty;
    const updatedPrice = price ?? item.price;

    await item.update({
      size: size ?? item.size,
      qnty: updatedQnty,
      price: updatedPrice,
      money: updatedQnty * updatedPrice,
      customerId: customerId ?? item.customerId,
    });

    const updatedItem = await OrderItem.findByPk(id, {
      include: [{ model: Customer, as: "customer" }],
    });

    res.json(updatedItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error updating order item",
      error: error.message,
    });
  }
};

/* ===========================
   Partial Update (PATCH)
=========================== */
export const updateOrderItemProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const item = await OrderItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    // Auto-recalculate money if qnty or price is updated
    if (updateData.qnty || updateData.price) {
      const qnty = updateData.qnty ?? item.qnty;
      const price = updateData.price ?? item.price;
      updateData.money = qnty * price;
    }

    await item.update(updateData);

    const updatedItem = await OrderItem.findByPk(id, {
      include: [{ model: Customer, as: "customer" }],
    });

    res.json(updatedItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error updating order item",
      error: error.message,
    });
  }
};

/* ===========================
   Delete Order Item
=========================== */
export const deleteOrderItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await OrderItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    await item.destroy();
    res.json({ message: "Order item deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error deleting order item",
      error: error.message,
    });
  }
};
