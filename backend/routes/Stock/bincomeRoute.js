// routes/bincomeRoutes.js
import express from "express";
import {
  createBincome,
  getAllBincome,
  getBincomeById,
  updateBincome,
  deleteBincome,
} from "../../Controllers/stock/bIncomeController.js";

const bIncomeRoute = express.Router();

bIncomeRoute.post("/", createBincome);
bIncomeRoute.get("/", getAllBincome);
bIncomeRoute.get("/:id", getBincomeById);
bIncomeRoute.put("/:id", updateBincome);
bIncomeRoute.delete("/:id", deleteBincome);

export default bIncomeRoute;