// routes/stock/bExistRoutes.js
import express from "express";
import {
  createBExist,
  getAllBExist,
  getBExistById,
  updateBExist,
  deleteBExist,
  getStockValue,
} from "../../Controllers/stock/bExistController.js";

const bExistRoute = express.Router();

bExistRoute.post("/", createBExist);
bExistRoute.get("/", getAllBExist);
bExistRoute.get("/value", getStockValue);   // get total value per category
bExistRoute.get("/:id", getBExistById);
bExistRoute.put("/:id", updateBExist);
bExistRoute.delete("/:id", deleteBExist);

export default bExistRoute;