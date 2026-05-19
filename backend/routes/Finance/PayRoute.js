import express from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
} from "../../Controllers/Finance/PayController.js";

const PayRouter = express.Router();
PayRouter.get("/pay", getAllPayments);
PayRouter.get("/pay/:id", getPaymentById);
PayRouter.post("/pay", createPayment);
PayRouter.put("/pay/:id", updatePayment);
PayRouter.delete("/pay/:id", deletePayment);

export default PayRouter;