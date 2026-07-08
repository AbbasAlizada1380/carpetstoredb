import express from "express";
import {
  createBSale,
  getAllBSales,
  getBSaleById,
  updateBSale,
  deleteBSale,
} from "../../Controllers/stock/BSalesController.js";

const bsalesRouter = express.Router();

bsalesRouter.post("/", createBSale);
bsalesRouter.get("/", getAllBSales);
bsalesRouter.get("/:id", getBSaleById);
bsalesRouter.put("/:id", updateBSale);
bsalesRouter.delete("/:id", deleteBSale);

export default bsalesRouter;