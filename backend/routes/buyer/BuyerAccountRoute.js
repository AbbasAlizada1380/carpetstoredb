// Routes/BuyerAccountRoute.js
import express from "express";
import {
  getOrCreateBuyerAccount,
  getAllBuyerAccounts,
  addSellToAccount,
  addReceiptToAccount,
  removeSellFromAccount,
  removeReceiptFromAccount,
  getBuyersWithUnpaid,          // 👈 new controller
} from "../../Controllers/buyer/BuyerAccountController.js";

const BuyerAccountRoute = express.Router();

// ✅ Specific route must come BEFORE the parameterized route
BuyerAccountRoute.get("/unpaid", getBuyersWithUnpaid);

// 🟡 Generic parameterized route (catches /:buyerId)
BuyerAccountRoute.get("/:buyerId", getOrCreateBuyerAccount);
BuyerAccountRoute.get("/", getAllBuyerAccounts);

// Other routes
BuyerAccountRoute.post("/add-sell", addSellToAccount);
BuyerAccountRoute.post("/add-receipt", addReceiptToAccount);
BuyerAccountRoute.delete("/remove-sell", removeSellFromAccount);
BuyerAccountRoute.delete("/remove-receipt", removeReceiptFromAccount);

export default BuyerAccountRoute;