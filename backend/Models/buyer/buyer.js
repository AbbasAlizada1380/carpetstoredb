import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Buyer = sequelize.define(
  "Buyer",
  {
    fullname: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Buyer's full name",
    },
    phoneNumber: {
      type: DataTypes.STRING,
      comment: "Buyer's contact number",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether the buyer is active",
    },
  },
  {
    timestamps: true,
  }
);

export default Buyer;