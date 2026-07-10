import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Bill = sequelize.define(
  "Bill",
  {
    billNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    buyerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "buyers",
        key: "id",
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("paid", "partial", "unpaid"),
      defaultValue: "unpaid",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    discount_percent: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discounted_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    },
    sells: {
      type: DataTypes.JSON,      // stores array of sell IDs e.g. [1, 2, 3]
      allowNull: false,
      defaultValue: [],
    },
    bsales: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of blanket sell (BSales) IDs",
    },
  },
  {
    tableName: "Bill",
    timestamps: true,
  }
);

export default Bill;