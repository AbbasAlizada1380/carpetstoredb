// index.js
import sequelize from "../dbconnection.js";
import Category from "./grouping/Category.js";
import Type from "./grouping/Type.js";
import Sells from "./Stock/Sells.js";
import Income from "./Stock/income.js";
import Buyer from "./buyer/buyer.js";
import BuyerAccount from "./buyer/BuyerAccount.js";
import Receipt from "./Finance/Receipt.js";
import Bill from "./bill/Bill.js";                    // <-- import Bill model

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

// Income ↔ Sells
Sells.belongsTo(Income, { foreignKey: "incomeId", as: "income" });
Income.hasMany(Sells, { foreignKey: "incomeId", as: "sells" });

// ---------- Accounting associations ----------
// Buyer ↔ BuyerAccount (one‑to‑one)
Buyer.hasOne(BuyerAccount, { foreignKey: "buyerId", as: "account" });
BuyerAccount.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });

// Buyer ↔ Receipt (one‑to‑many)
Buyer.hasMany(Receipt, { foreignKey: "buyerId", as: "receipts" });
Receipt.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });

// ---------- Bill associations ----------
// Bill belongs to Buyer (each bill has one buyer)
Bill.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });
// Buyer has many Bills
Buyer.hasMany(Bill, { foreignKey: "buyerId", as: "bills" });

// ------------------------------------------

export {
  sequelize,
  Category,
  Type,
  Sells,
  Income,
  Buyer,
  BuyerAccount,
  Receipt,
  Bill,                 // <-- export Bill
};