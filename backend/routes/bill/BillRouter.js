import express from "express";
import {
  getAllBills,
  getBillById,
  getBillDetails,              // 👈 new import
  getBillsByDateRange,
  getBillsByCustomer,
  getFilteredBills,
  deleteBill,
} from "../../Controllers/bill/BillController.js";

const BillRouter = express.Router();

// ─── Static / specific routes first ───
BillRouter.get("/filter", getFilteredBills);
BillRouter.get("/date-range", getBillsByDateRange);
BillRouter.get("/customers/:customerId/bills", getBillsByCustomer);
BillRouter.get("", getAllBills);

// ─── Parameterized routes (specific suffix BEFORE bare :id) ───
BillRouter.get("/:id/details", getBillDetails);   // 👈 new route
BillRouter.get("/:id", getBillById);
BillRouter.delete("/:id", deleteBill);

export default BillRouter;