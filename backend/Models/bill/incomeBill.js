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
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",
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
      comment: "Array of carpet income IDs or objects",
    },
    // ─── Blanket (Bincome) entries ──────────────────────────────
    bIncome: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of blanket income (Bincome) IDs or objects",
    },
    // ─── Currency / exchange rate ───────────────────────────────
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
  },
  {
    tableName: "incomeBill",
    timestamps: true,
  }
);

export default IncomeBill;
