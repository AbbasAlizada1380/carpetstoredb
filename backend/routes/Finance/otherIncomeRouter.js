import express from "express";
import {
  createOtherIncome,
  getOtherIncomes,
  getOtherIncomeById,
  updateOtherIncome,
  deleteOtherIncome,
  getOtherIncomeReport,       // ✅ added report controller
} from "../../Controllers/Finance/otherIncomeController.js";

const otherIncomeRouter = express.Router();

otherIncomeRouter.post("/", createOtherIncome);
otherIncomeRouter.get("/", getOtherIncomes);
otherIncomeRouter.get("/report", getOtherIncomeReport);   // ✅ report route (must come before /:id)
otherIncomeRouter.get("/:id", getOtherIncomeById);
otherIncomeRouter.put("/:id", updateOtherIncome);
otherIncomeRouter.delete("/:id", deleteOtherIncome);

export default otherIncomeRouter;