import express from "express";
import {
  createBSale,
  getAllBSales,
  getBSaleById,
  getBSalesByBillId,
  updateBSale,
  updateBSaleBatch,
  deleteBSale,
} from "../../Controllers/stock/BSalesController.js";

const bsalesRouter = express.Router();

bsalesRouter.post("/", createBSale);

// ✅ Batch endpoint must come BEFORE "/:id" or Express will treat "batch" as an id
bsalesRouter.put("/batch", updateBSaleBatch);

bsalesRouter.get("/", getAllBSales);

// ✅ by-bill must also come BEFORE "/:id"
bsalesRouter.get("/by-bill/:billId", getBSalesByBillId);

bsalesRouter.get("/:id", getBSaleById);
bsalesRouter.put("/:id", updateBSale);
bsalesRouter.delete("/:id", deleteBSale);

export default bsalesRouter;