// Models/Finance/Pay.js
import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Pay = sequelize.define(
  "Pay",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // ✅ allows NULL when customer is deleted
      references: {
        model: "Customers",
        key: "id",
      },
      onDelete: "SET NULL",  // explicit for clarity
      onUpdate: "CASCADE",
      comment: "Reference to the customer who paid",
    },
    amountofmoney: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Amount received from customer",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional note or description",
    },
  },
  {
    timestamps: true,
    tableName: "Pays",
  }
);

export default Pay;