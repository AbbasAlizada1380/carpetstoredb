import express from "express";
import {
  getAllBills,
  getBillById,
  getBillsByDateRange,
  getBillsByCustomer,
  getFilteredBills,
  deleteBill,                  // 👈 new import
} from "../../Controllers/bill/BillController.js";

const BillRouter = express.Router();

// ─── Static / specific routes first ───
BillRouter.get("/filter", getFilteredBills);
BillRouter.get("/date-range", getBillsByDateRange);
BillRouter.get("/customers/:customerId/bills", getBillsByCustomer);
BillRouter.get("", getAllBills);

// ─── Parameterized routes last ───
BillRouter.get("/:id", getBillById);
BillRouter.delete("/:id", deleteBill);   // 👈 new DELETE route

export default BillRouter;