import express from "express";
import {
  createReceipt,
  getAllReceipts,
  updateReceipt,
  deleteReceipt,
  getReceiptsFiltered,     // 👈 import the new controller
} from "../../Controllers/Finance/ReceiptController.js";

const ReceiptRoute = express.Router();

ReceiptRoute.post("/", createReceipt);
ReceiptRoute.get("/", getAllReceipts);
ReceiptRoute.get("/filter", getReceiptsFiltered);   // 👈 new filtering route
ReceiptRoute.put("/:id", updateReceipt);
ReceiptRoute.delete("/:id", deleteReceipt);

export default ReceiptRoute;