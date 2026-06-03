// Models/accounting/BuyerAccount.js
import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const BuyerAccount = sequelize.define(
  "BuyerAccount",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    buyerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Buyers",
        key: "id",
      },
      comment: "Reference to the buyer",
    },
    sellIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("sellIds");
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue("sellIds", JSON.stringify(value));
      },
      comment: "Array of Sell record IDs",
    },
    remaindIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("remaindIds");
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue("remaindIds", JSON.stringify(value));
      },
      comment: "Array of remaind IDs (could be references to seller debt records)",
    },
    receiptSaleIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("receiptSaleIds");
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue("receiptSaleIds", JSON.stringify(value));
      },
      comment: "Array of Receipt sales record IDs",
    },
    receiptIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("receiptIds");
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue("receiptIds", JSON.stringify(value));
      },
      comment: "Array of Receipt record IDs",
    },
    // NEW: Boolean flag for non‑empty remaindIds
    has_remaindIds: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Indicates whether remaindIds is non‑empty (for fast indexing)",
    },
  },
  {
    timestamps: true,
    tableName: "BuyerAccounts",
  }
);

export default BuyerAccount;