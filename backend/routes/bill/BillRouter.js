import express from "express";
import {
  getAllBills,
  getBillById,
  getBillsByDateRange,
  getBillsByCustomer,
  getFilteredBills,
} from "../../Controllers/bill/BillController.js"; // adjust path

const BillRouter = express.Router();
BillRouter.get("/filter", getFilteredBills);
BillRouter.get("", getAllBills);
BillRouter.get("/:id", getBillById);
BillRouter.get("/date-range", getBillsByDateRange);
BillRouter.get("/customers/:customerId/bills", getBillsByCustomer);

export default BillRouter;