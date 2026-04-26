import express from "express";
import {
  createOrderItem,
  getOrderItems,
  getOrderItemById,
  updateOrderItem,
  updateOrderItemProperties,
  deleteOrderItem,
} from "../Controllers/OrderItemsController.js";

const OrderItemRoute = express.Router();

OrderItemRoute.patch("/:id", updateOrderItemProperties);
OrderItemRoute.post("/", createOrderItem);
OrderItemRoute.get("/", getOrderItems);
OrderItemRoute.get("/:id", getOrderItemById);
OrderItemRoute.put("/:id", updateOrderItem);
OrderItemRoute.delete("/:id", deleteOrderItem);

export default OrderItemRoute;
