import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const bExist = sequelize.define(
  "bExist",
  {
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Foreign key to Category",
    },
    quantity: {
      type: DataTypes.INTEGER, // changed to DECIMAL for precision
      allowNull: false,
      defaultValue: 0,
      comment: "Current stock quantity (weight or count)",
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2), // typical price precision
      allowNull: false,
      defaultValue: 0,
      comment: "Price per unit (e.g., per kg or per piece)",
    },
  },
  {
    timestamps: true,
  }
);

export default bExist;