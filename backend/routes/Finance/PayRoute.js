import express from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsFiltered,      // 👈 import the new controller
} from "../../Controllers/Finance/PayController.js";

const PayRouter = express.Router();

// Specific routes first (no parameter conflicts)
PayRouter.get("/filter", getPaymentsFiltered);   // 👈 new filter endpoint

// Then generic /:id routes
PayRouter.get("", getAllPayments);
PayRouter.get("/:id", getPaymentById);
PayRouter.post("", createPayment);
PayRouter.put("/:id", updatePayment);
PayRouter.delete("/:id", deletePayment);

export default PayRouter;