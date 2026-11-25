import express from "express";
import {
  createHolder,
  getHolders,
  getHolderById,
  updateHolder,
  updateHolderProperties,
  deleteHolder,
  getHolderBalance,
} from "../../Controllers/holder/holderController.js";

const holderRoute = express.Router();

holderRoute.post("/", createHolder);

holderRoute.get("/", getHolders);
holderRoute.get("/:id/balance", getHolderBalance); // before /:id
holderRoute.get("/:id", getHolderById);

holderRoute.put("/:id", updateHolder);
holderRoute.patch("/:id", updateHolderProperties);
holderRoute.delete("/:id", deleteHolder);

export default holderRoute;