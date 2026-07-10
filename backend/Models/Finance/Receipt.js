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
      comment: "Amount received from buyer",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional note or description",
    },
  },
  {
    timestamps: true,
    tableName: "Receipts",
  }
);

export default Receipt;