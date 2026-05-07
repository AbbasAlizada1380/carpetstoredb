import express from "express";
import {
  getOrCreateBuyerAccount,
  getAllBuyerAccounts,
  addSellToAccount,
  addReceiptToAccount,
  removeSellFromAccount,
  removeReceiptFromAccount,
} from "../../Controllers/Buyer/BuyerAccountController.js";

const BuyerAccountRoute = express.Router();

// Buyer Account routes
BuyerAccountRoute.get("/:buyerId", getOrCreateBuyerAccount);
BuyerAccountRoute.get("/", getAllBuyerAccounts);
BuyerAccountRoute.post("/add-sell", addSellToAccount);
BuyerAccountRoute.post("/add-receipt", addReceiptToAccount);
BuyerAccountRoute.delete("/remove-sell", removeSellFromAccount);
BuyerAccountRoute.delete("/remove-receipt", removeReceiptFromAccount);

export default BuyerAccountRoute;