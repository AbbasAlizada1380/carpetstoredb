import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Outgoing = sequelize.define(
  "Outgoing",
  {
    size: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.STRING,
    },
    money: {
      type: DataTypes.STRING,
    }
  },
  {
    timestamps: true,
  }
);

export default Outgoing;
;
