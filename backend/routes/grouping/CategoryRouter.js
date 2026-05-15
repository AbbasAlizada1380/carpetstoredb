import express from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getIncomesByCategory,
  getCategoryReports,          // ← import the new report controller
} from "../../Controllers/grouping/CategoryController.js";

const CategoryRouter = express.Router();

CategoryRouter.post("/", createCategory);
CategoryRouter.get("/", getAllCategories);
CategoryRouter.get("/reports", getCategoryReports);   // ← new report route
CategoryRouter.get("/:id/incomes", getIncomesByCategory);
CategoryRouter.get("/:id", getCategoryById);
CategoryRouter.put("/:id", updateCategory);
CategoryRouter.delete("/:id", deleteCategory);

export default CategoryRouter;