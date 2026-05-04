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
}
  },
  {
    timestamps: true,
  }
);

export default Category;