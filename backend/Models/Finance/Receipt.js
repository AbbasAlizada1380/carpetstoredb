// Models/accounting/Receipt.js
import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Receipt = sequelize.define(
  "Receipt",
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
        model: "buyers",
        key: "id",
      },
      comment: "Reference to the buyer who paid",
    },
    amountofmoney: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Amount received from buyer (in the currency indicated by isAfn)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional note or description",
    },
    // ─── NEW: currency ──────────────────────────────────────────────
    isAfn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Currency of this receipt: true = AFN, false = USD",
    },
    DV: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Exchange rate (AFN per USD) used when applying this receipt",
    },
    // ─── NEW: per-bill audit trail (same shape as Pay.appliedTo) ────
    appliedTo: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Audit trail: which bills this receipt was applied to and in which currency",
    },
  },
  {
    timestamps: true,
    tableName: "Receipts",
  }
);

export default Receipt;