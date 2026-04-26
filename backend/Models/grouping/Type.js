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
      type: DataTypes.JSON, // 👈 آرایه اینجا ذخیره می‌شود
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    timestamps: true,
  }
);

export default Type;