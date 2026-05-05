import sequelize from "../dbconnection.js";
import Category from "./grouping/Category.js";
import Type from "./grouping/Type.js";
import Sells from "./Stock/Sells.js";
import Income from "./Stock/income.js";

// ---------- Define associations ----------
// Type ↔ Category
Type.hasMany(Category, { foreignKey: "typeId", as: "categoryList" });
Category.belongsTo(Type, { foreignKey: "typeId", as: "type" });

// Category ↔ Sells
Category.hasMany(Sells, { foreignKey: "Category", as: "sells" });
Sells.belongsTo(Category, { foreignKey: "Category", as: "categoryDetail" });


export {
  sequelize,
  Category,
  Type,
  Sells,
  Income
};