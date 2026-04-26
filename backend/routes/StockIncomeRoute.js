import express from "express";
import {
  createIncome,
  getIncomes,
  getIncomeById,
  updateIncome,
  updateIncomeProperties,
  deleteIncome,
} from "../Controllers/stock/IncomeController.js";

const IncomeRoute = express.Router();

IncomeRoute.patch("/:id", updateIncomeProperties);
IncomeRoute.post("/", createIncome);
IncomeRoute.get("/", getIncomes);
IncomeRoute.get("/:id", getIncomeById);
IncomeRoute.put("/:id", updateIncome);
IncomeRoute.delete("/:id", deleteIncome);

export default IncomeRoute;