import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const IncomeBill = sequelize.define(
  "IncomeBill",
  {
    billNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    customerId: {                     // ✅ single foreign key field
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",           // ✅ exact table name (plural, capital C)
        key: "id",
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("paid", "partial", "unpaid"),
      defaultValue: "unpaid",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    discount_percent: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discounted_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    },
    Incomes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "incomeBill",
    timestamps: true,
  }
);

export default IncomeBill;