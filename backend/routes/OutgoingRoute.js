import express from "express";
import {
  createOutgoing,
  getOutgoings,
  getOutgoingById,
  updateOutgoing,
  // updateOutgoingProperties,
  deleteOutgoing,
} from "../Controllers/stock/OutgoingController.js";

const OutgoingRoute = express.Router();

// Create new outgoing record (sell/remove from stock)
OutgoingRoute.post("/", createOutgoing);

// Get all outgoing records with pagination
OutgoingRoute.get("/", getOutgoings);

// Get single outgoing record by ID
OutgoingRoute.get("/:id", getOutgoingById);

// Full update of outgoing record
OutgoingRoute.put("/:id", updateOutgoing);

// Partial update of outgoing record
// OutgoingRoute.patch("/:id", updateOutgoingProperties);

// Delete outgoing record
OutgoingRoute.delete("/:id", deleteOutgoing);

export default OutgoingRoute;