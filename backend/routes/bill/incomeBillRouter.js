import express from "express";
import {
  createIncomeBill,
  getAllIncomeBills,
  getIncomeBillById,
  getIncomeBillsByCustomer,
  updateIncomeBill,
  deleteIncomeBill,
} from "../../Controllers/bill/incomeBillController.js";

const incomeBillRouter = express.Router();

incomeBillRouter.post("/", createIncomeBill);
incomeBillRouter.get("/", getAllIncomeBills);

// ⚠️ Specific routes BEFORE "/:id"
incomeBillRouter.get("/by-customer/:customerId", getIncomeBillsByCustomer);

incomeBillRouter.get("/:id", getIncomeBillById);
incomeBillRouter.put("/:id", updateIncomeBill);
incomeBillRouter.delete("/:id", deleteIncomeBill);

export default incomeBillRouter;