import sequelize from "../dbconnection.js";
import Category from "./grouping/Category.js";
import Type from "./grouping/Type.js";
import Sells from "./Stock/Sells.js";
import Income from "./Stock/income.js";
import Buyer from "./buyer/buyer.js";

// ---------- Define associations ----------
// Type ↔ Category
Type.hasMany(Category, { foreignKey: "typeId", as: "categoryList" });
Category.belongsTo(Type, { foreignKey: "typeId", as: "type" });

// Category ↔ Sells
Category.hasMany(Sells, { foreignKey: "Category", as: "sells" });
Sells.belongsTo(Category, { foreignKey: "Category", as: "categoryDetail" });

// Buyer ↔ Sells
Buyer.hasMany(Sells, { foreignKey: "buyerId", as: "sells" });
Sells.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });
// ------------------------------------------

Sells.belongsTo(Income, { foreignKey: "incomeId", as: "income" });
Income.hasMany(Sells, { foreignKey: "incomeId", as: "sells" });

export {
  sequelize,
  Category,
  Type,
  Sells,
  Income,
  Buyer,
};