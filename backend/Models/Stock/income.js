import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Income = sequelize.define(
  "Income",
  {
    width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Width of the carpet (e.g., in meters or centimeters)",
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Quality grade or degree of the carpet",
    },
    lotNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Batch or lot number for inventory tracking",
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    area: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Total area (width × length, pre-computed if needed)",
    },
    length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Length of the carpet",
    },
  },
  {
    timestamps: true,
  }
);


export default Income;