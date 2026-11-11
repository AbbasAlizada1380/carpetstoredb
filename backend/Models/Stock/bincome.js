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
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Quantity of carpet (e.g., number of pieces/rolls)",
    },
    initialAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Initial carpet quantity before any adjustments",
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Weight of the carpet (e.g., in kilograms)",
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price per carpet unit",
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Computed total price (carpet quantity × unitPrice)",
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
      beforeCreate: (bincome) => {
        const amount = parseFloat(bincome.amount) || 0;
        const unitPrice = parseFloat(bincome.unitPrice) || 0;
        bincome.totalPrice = Math.round(amount * unitPrice * 100) / 100;

        // Default initialAmount to the starting carpet quantity
        if (bincome.initialAmount === undefined || bincome.initialAmount === null) {
          bincome.initialAmount = amount;
        }
      },
      beforeUpdate: (bincome) => {
        if (bincome.changed("amount") || bincome.changed("unitPrice")) {
          const amount = parseFloat(bincome.amount) || 0;
          const unitPrice = parseFloat(bincome.unitPrice) || 0;
          bincome.totalPrice = Math.round(amount * unitPrice * 100) / 100;
        }
      },
    },
  }
);

export default Bincome;