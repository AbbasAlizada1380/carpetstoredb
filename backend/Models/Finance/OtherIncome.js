// Models/accounting/OtherIncome.js
import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const OtherIncome = sequelize.define(
  "OtherIncome",
  {
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Amount of other income",
    },
    for: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Purpose or source of the income (e.g., 'Donation', 'Service Fee')",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes or description",
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
    tableName: "OtherIncomes",
  }
);

export default OtherIncome;