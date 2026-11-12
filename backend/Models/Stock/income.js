import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Income = sequelize.define(
  "Income",
  {
    width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Width of the carpet (e.g., in meters or centimeters)",
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Quality grade or degree of the carpet",
    },
    lotNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Batch or lot number for inventory tracking",
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    area: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Current remaining area (width × current length, pre-computed)",
    },
    initialArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Original area when the carpet was first received (width × initialLength)",
    },

    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Current remaining length of the carpet",
    },
    initialLength: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Original length when the carpet was first received",
    },
    Sells: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array of IDs for sales",
    },
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
    timestamps: true,
  }
);

export default Income;