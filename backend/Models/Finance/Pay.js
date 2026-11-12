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
      allowNull: true,
      references: {
        model: "Customers",
        key: "id",
      },
      onDelete: "SET NULL",
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
    // ─── NEW: standardized currency fields ────────────────────────────
    isAfn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the currency is Afghan Afghani (AFN); false means USD",
    },
    DV: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 65,
      comment: "Dollar value / exchange rate — default 65 (AFN per USD)",
    },
        appliedTo: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment:
        "Array of { billId, billCurrency, appliedInBillCurrency, consumedInPaymentCurrency, rate }",
    },
  },
  {
    timestamps: true,
    tableName: "Pays",
  }
);

export default Pay;