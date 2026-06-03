import express from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
} from "../../Controllers/Finance/PayController.js";

const PayRouter = express.Router();
PayRouter.get("", getAllPayments);
PayRouter.get("/:id", getPaymentById);
PayRouter.post("", createPayment);
PayRouter.put("/:id", updatePayment);
PayRouter.delete("/:id", deletePayment);

export default PayRouter;