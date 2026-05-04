import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";
import Category from "../grouping/Category.js";

const Sells = sequelize.define(
  "Sells",
  {
    Category: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Categories", key: "id" }, // assumes a Type table exists
      comment: "Product category",
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
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
      comment: "Total amount = unit_price × amount",
    },
    customer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

export default Sells;