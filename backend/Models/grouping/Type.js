import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Type = sequelize.define(
  "Type",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    categories: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    // New fields for storing arrays of related ID references
    EIncome: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of IDs for expense-related income",
    },
    SIncome: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of IDs for sales income",
    },
  },
  {
    timestamps: true,
  }
);

export default Type;