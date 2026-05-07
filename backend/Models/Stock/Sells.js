import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";
import Category from "../grouping/Category.js";

const Sells = sequelize.define(
  "Sells",
  {
    categoryId: {
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
    area: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    length: {
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
    buyerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    incomeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Incomes", key: "id" },
    }
  },
  {
    timestamps: true,
  }
);

export default Sells;