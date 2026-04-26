import { DataTypes } from "sequelize";
import sequelize from "../dbconnection.js";
import Customer from "./Customers.js";

const OrderItem = sequelize.define(
  "OrderItem",
  {
    size: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    qnty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    money: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Customer,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // or "CASCADE" if you want
    },
  },
  {
    timestamps: true,
  }
);

export default OrderItem;