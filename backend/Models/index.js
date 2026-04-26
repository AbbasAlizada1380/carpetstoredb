import sequelize from "../dbconnection.js";
import Category from "./grouping/Category.js";
import Type from "./grouping/Type.js";
import defineAssociations from "./Association.js";

// Apply associations
defineAssociations();

// Export models and sequelize instance
export {
    sequelize,
    Category,
    Type,
};