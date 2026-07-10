import sequelize from "../dbconnection.js";
import Category from "./grouping/Category.js";
import Type from "./grouping/Type.js";
import Sells from "./Stock/Sells.js";
import Income from "./Stock/income.js";
import Buyer from "./buyer/buyer.js";
import BuyerAccount from "./buyer/BuyerAccount.js";
import Receipt from "./Finance/Receipt.js";
import Bill from "./bill/Bill.js";
import Customer from "./customer/Customers.js";
import CustomerAccount from "./customer/CustomerAccount.js";
import IncomeBill from "./bill/incomeBill.js";
import Pay from "./Finance/Pay.js";
import Exist from "./Stock/exist.js";
import bExist from "./Stock/bExist.js";
import Bincome from "./Stock/bincome.js";
import BSales from "./Stock/BSales.js"; // 👈 NEW: import BSales model

// ---------- Define associations ----------

// Type ↔ Category
Type.hasMany(Category, { foreignKey: "typeId", as: "categoryList" });
Category.belongsTo(Type, { foreignKey: "typeId", as: "type" });

// Category ↔ Sells (carpet sales)
Category.hasMany(Sells, { foreignKey: "Category", as: "sells" });
Sells.belongsTo(Category, { foreignKey: "Category", as: "categoryDetail" });

// Income ↔ Sells
Sells.belongsTo(Income, { foreignKey: "incomeId", as: "income" });
Income.hasMany(Sells, { foreignKey: "incomeId", as: "sells" });

// Income associations (with Category, Type, Customer)
Income.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Category.hasMany(Income, { foreignKey: "categoryId", as: "incomes" });

Income.belongsTo(Type, { foreignKey: "typeId", as: "type" });
Type.hasMany(Income, { foreignKey: "typeId", as: "incomes" });

Income.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Customer.hasMany(Income, { foreignKey: "customerId", as: "incomes" });

// Buyer ↔ Sells
Buyer.hasMany(Sells, { foreignKey: "buyerId", as: "sells" });
Sells.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });

// Accounting associations (Buyer side)
Buyer.hasOne(BuyerAccount, { foreignKey: "buyerId", as: "account" });
BuyerAccount.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });

Buyer.hasMany(Receipt, { foreignKey: "buyerId", as: "receipts" });
Receipt.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });

// Bill associations (original buyer bill)
Bill.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });
Buyer.hasMany(Bill, { foreignKey: "buyerId", as: "bills" });

// Customer & CustomerAccount
Customer.hasOne(CustomerAccount, { foreignKey: "customerId", as: "account" });
CustomerAccount.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

// IncomeBill associations
IncomeBill.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Customer.hasMany(IncomeBill, { foreignKey: "customerId", as: "incomeBills" });

// Pay associations (customer payments)
Pay.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Customer.hasMany(Pay, { foreignKey: "customerId", as: "payments" });

// Bincome associations (blanket incomes)
Bincome.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Category.hasMany(Bincome, { foreignKey: "categoryId", as: "bincomes" });

// bExist (blanket stock) associations
Category.hasMany(bExist, { foreignKey: "categoryId", as: "bExists" });
bExist.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// ─── BSales (blanket sales) associations ──────────────────────────────
BSales.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Category.hasMany(BSales, { foreignKey: "categoryId", as: "bsales" });

BSales.belongsTo(bExist, { foreignKey: "bexistId", as: "bExist" });
bExist.hasMany(BSales, { foreignKey: "bexistId", as: "bsales" });

BSales.belongsTo(Buyer, { foreignKey: "buyerId", as: "buyer" });
Buyer.hasMany(BSales, { foreignKey: "buyerId", as: "bsales" });

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
  Bill,
  Customer,
  CustomerAccount,
  IncomeBill,
  Pay,
  Exist,
  bExist,
  Bincome,
  BSales, // 👈 NEW: export BSales
};