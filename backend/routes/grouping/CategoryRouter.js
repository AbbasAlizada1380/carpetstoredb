import express from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../../Controllers/grouping/CategoryController.js";

const CategoryRouter = express.Router();

CategoryRouter.post("/", createCategory);
CategoryRouter.get("/", getAllCategories);
CategoryRouter.get("/:id", getCategoryById);
CategoryRouter.put("/:id", updateCategory);
CategoryRouter.delete("/:id", deleteCategory);

export default CategoryRouter;