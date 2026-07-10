import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Category = sequelize.define(
  "Category",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    typeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Types", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",   // ← change SET NULL to CASCADE
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
    BIncome: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of Bincome IDs",
    },
  },
  {
    timestamps: true,
  }
);

export default Category;