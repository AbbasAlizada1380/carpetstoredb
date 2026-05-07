import express from "express";
import {
  createReceipt,
  getAllReceipts,
  getReceiptsByBuyer,
  updateReceipt,
  deleteReceipt,
} from "../../Controllers/Finance/ReceiptController.js";


const ReceiptRoute = express.Router();

// Receipt routes
ReceiptRoute.post("/", createReceipt);
ReceiptRoute.get("/", getAllReceipts);
ReceiptRoute.get("/buyer/:buyerId", getReceiptsByBuyer);
ReceiptRoute.put("/:id", updateReceipt);
ReceiptRoute.delete("/:id", deleteReceipt);

export default ReceiptRoute;