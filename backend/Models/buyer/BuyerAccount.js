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
        model: "Buyers", // assumes your Buyer model table name
        key: "id",
      },
      comment: "Reference to the buyer",
    },
    sellIds: {
      type: DataTypes.TEXT, // store as JSON array or comma-separated
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
  },
  {
    timestamps: true,
    tableName: "BuyerAccounts",
  }
);

export default BuyerAccount;