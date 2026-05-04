 import express from "express";
import {
  createIncome,
  getAllIncomes,
  getIncomeById,
  updateIncome,
  deleteIncome,
} from "../../Controllers/stock/IncomeController.js";

const incomeRoute = express.Router();

incomeRoute.post("/", createIncome);
incomeRoute.get("/", getAllIncomes);
incomeRoute.get("/:id", getIncomeById);
incomeRoute.put("/:id", updateIncome);
incomeRoute.delete("/:id", deleteIncome);

export default incomeRoute;