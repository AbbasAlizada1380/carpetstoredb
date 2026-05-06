// routes/buyerRoutes.js
import express from "express";
import {
  createBuyer,
  getBuyers,
  getBuyerById,
  updateBuyer,
  updateBuyerProperties,
  deleteBuyer,
  searchBuyers,
  getActiveBuyers,
} from "../../Controllers/buyer/BuyersController.js";

const BuyerRoute = express.Router();

BuyerRoute.patch("/:id", updateBuyerProperties);
BuyerRoute.get("/active", getActiveBuyers);
BuyerRoute.get("/search", searchBuyers);
BuyerRoute.post("/", createBuyer);
BuyerRoute.get("/", getBuyers);
BuyerRoute.get("/:id", getBuyerById);
BuyerRoute.put("/:id", updateBuyer);
BuyerRoute.delete("/:id", deleteBuyer);

export default BuyerRoute;