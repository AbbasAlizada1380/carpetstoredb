 import express from "express";
import {
  createSell,
  getAllSells,
  getSellById,
  updateSell,
  deleteSell,
} from "../../Controllers/stock/SellsController.js";

const sellsRouter = express.Router();

sellsRouter.post("/", createSell);
sellsRouter.get("/", getAllSells);
sellsRouter.get("/:id", getSellById);
sellsRouter.put("/:id", updateSell);
sellsRouter.delete("/:id", deleteSell);

export default sellsRouter;