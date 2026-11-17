import express from "express";
import {
  getAllBills,
  getBillById,
  getBillDetails,
  getBillsByDateRange,
  getBillsByCustomer,
  getFilteredBills,
  deleteBill,
} from "../../Controllers/bill/BillController.js";

const BillRouter = express.Router();

// ─── Static / specific routes FIRST ───
BillRouter.get("/filter", getFilteredBills);
BillRouter.get("/date-range", getBillsByDateRange);
BillRouter.get("/customers/:customerId/bills", getBillsByCustomer);
BillRouter.get("", getAllBills);

// ─── Parameterized routes LAST ───
BillRouter.get("/:id/details", getBillDetails);
BillRouter.get("/:id", getBillById);
BillRouter.delete("/:id", deleteBill);

export default BillRouter;