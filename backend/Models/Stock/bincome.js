import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Bincome = sequelize.define(
  "Bincome",
  {
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Foreign key referencing the category table",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2), // Changed to DECIMAL for monetary precision
      allowNull: false,
      comment: "Total monetary amount for this blanket income entry",
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Weight of the blanket (e.g., in kilograms)",
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2), // Fixed: DECIMAL, not INTEGER
      allowNull: false,
      comment: "Price per unit weight or per item",
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2), // Fixed: DECIMAL
      allowNull: false, // Now it will be set by hooks, so no nulls
      defaultValue: 0,
      comment: "Computed total price (amount × unitPrice)",
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    remaind: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        name: "bincome_categoryId_index",
        fields: ["categoryId"],
      },
    ],
    hooks: {
      // Automatically compute totalPrice before creating
      beforeCreate: (bincome) => {
        const amount = parseFloat(bincome.amount) || 0;
        const unitPrice = parseFloat(bincome.unitPrice) || 0;
        bincome.totalPrice = Math.round((amount * unitPrice) * 100) / 100;
      },
      // Recompute on update if amount or unitPrice change
      beforeUpdate: (bincome) => {
        if (bincome.changed('amount') || bincome.changed('unitPrice')) {
          const amount = parseFloat(bincome.amount) || 0;
          const unitPrice = parseFloat(bincome.unitPrice) || 0;
          bincome.totalPrice = Math.round((amount * unitPrice) * 100) / 100;
        }
      },
    },
  }
);

export default Bincome;