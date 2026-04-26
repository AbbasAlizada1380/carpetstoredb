import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Income = sequelize.define(
  "Income",
  {
    size: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.STRING,
    },
    price: {
      type: DataTypes.STRING,
    },
    money: {
      type: DataTypes.STRING,
    },
    spent: {
      type: DataTypes.STRING,
    }
  },
  {
    timestamps: true,
  }
);

export default Income;
;
