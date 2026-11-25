import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Holder = sequelize.define(
  "Holder",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Holder's full name",
    },

    NIC: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "National ID / NIC number",
    },
  },
  {
    timestamps: true,
    tableName: "Holders",
    indexes: [
      { fields: ["NIC"], unique: true },
      { fields: ["fullName"] },
    ],
  }
);

export default Holder;