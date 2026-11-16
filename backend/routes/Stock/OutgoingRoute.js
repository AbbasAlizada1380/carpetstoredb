import express from "express";
import {
  createSell,
  getAllSells,
  getSellById,
  getSellsByBillId,
  updateSell,
  deleteSell,
} from "../../Controllers/stock/SellsController.js";

const sellsRouter = express.Router();

sellsRouter.post("/", createSell);
sellsRouter.get("/", getAllSells);

// ⚠️ Specific routes MUST come before "/:id"
sellsRouter.get("/by-bill/:billId", getSellsByBillId);

sellsRouter.get("/:id", getSellById);
sellsRouter.put("/:id", updateSell);
sellsRouter.delete("/:id", deleteSell);

export default sellsRouter;