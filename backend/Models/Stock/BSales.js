import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const BSales = sequelize.define(
  "BSales",
  {
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Categories", key: "id" },
      comment: "Product category",
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Number of units sold (replaces area)",
    },
    receipt: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      comment: "Amount paid",
    },
    remaind: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      comment: "Remaining debt",
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      comment: "Total amount = quantity × unit_price",
    },
    buyerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bexistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "bExists", key: "id" },
      comment: "Reference to blanket stock (bExist)",
    },
  },
  {
    tableName: "bsales",
    timestamps: true,
  }
);

export default BSales;