import express from "express";
import {
  createValet,
  getValets,
  getValetById,
  getValetsByHolder,
  updateValet,
  updateValetProperties,
  deleteValet,
} from "../../Controllers/holder/valetcontroller.js";

const Valetroute = express.Router();

Valetroute.post("/", createValet);

Valetroute.get("/", getValets);
Valetroute.get("/holder/:holderId", getValetsByHolder); // before /:id
Valetroute.get("/:id", getValetById);

Valetroute.put("/:id", updateValet);
Valetroute.patch("/:id", updateValetProperties);
Valetroute.delete("/:id", deleteValet);

export default Valetroute;