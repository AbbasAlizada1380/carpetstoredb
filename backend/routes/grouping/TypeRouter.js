import express from "express";
import {
    createType,
    getAllTypes,
    getTypeById,
    updateType,
    deleteType,
    getTypeCategories,
} from "../../Controllers/grouping/TypeController.js";

const TypeRouter = express.Router();

TypeRouter.post("/", createType);
TypeRouter.get("/:id/categories", getTypeCategories);
TypeRouter.get("/", getAllTypes);
TypeRouter.get("/:id", getTypeById);
TypeRouter.put("/:id", updateType);
TypeRouter.delete("/:id", deleteType);

export default TypeRouter;