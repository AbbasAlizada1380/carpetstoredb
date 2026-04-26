import Category from "./grouping/Category.js";
import Type from "./grouping/Type.js";

// Define associations
const defineAssociations = () => {
    // Type has many Categories
    Type.hasMany(Category, {
        foreignKey: "type",    // Category.type references Type.id
        as: "categoryList",    // alias for eager loading (e.g., Type.findByPk(1, { include: 'categoryList' }))
    });

    // Category belongs to one Type
    Category.belongsTo(Type, {
        foreignKey: "type",
        as: "parentType",      // alias: Category -> Type
    });
};

export default defineAssociations;