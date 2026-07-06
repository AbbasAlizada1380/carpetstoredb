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
    // ─── NEW: Currency indicator ──────────────────────────────────────
    is_Afs: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if amount is in Afghanis, False if in other currency (e.g., USD)",
    },
  },
  {
    timestamps: true,
    tableName: "Pays",
  }
);

export default Pay;