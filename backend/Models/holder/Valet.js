import { DataTypes } from "sequelize";
import sequelize from "../../dbconnection.js";

const Valet = sequelize.define(
  "Valet",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
      comment:
        "Amount in AFN (always positive — the type determines direction)",
    },

    holder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Holders",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      comment: "FK to the Holder this valet belongs to",
    },

    type: {
      type: DataTypes.ENUM("withdraw", "deposit"),
      allowNull: false,
      defaultValue: "deposit",
      comment:
        "withdraw = money out of the holder, deposit = money into the holder",
    },

    source: {
      type: DataTypes.ENUM("valet", "business"),
      allowNull: false,
      defaultValue: "valet",
      comment:
        "deposit → always 'valet'. withdraw → 'valet' (from the wallet) or 'business' (from a business).",
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional note describing this transaction",
    },
  },
  {
    timestamps: true,
    tableName: "Valets",
    indexes: [
      { fields: ["holder"] },
      { fields: ["type"] },
      { fields: ["source"] },
      { fields: ["createdAt"] },
    ],
  }
);

/* =========================================================
   Enforce the source rule:
     - withdraw → must be "valet" or "business"
     - deposit  → always "valet"
   Runs on create() and save() so any write path is covered.
   ========================================================= */
Valet.beforeValidate((valet) => {
  if (valet.type === "withdraw") {
    if (!valet.source) {
      throw new Error(
        "انتخاب منبع برداشت (والټ یا کسب‌وکار) الزامی است"
      );
    }
    if (!["valet", "business"].includes(valet.source)) {
      throw new Error("منبع نامعتبر است (valet یا business)");
    }
  } else {
    /* deposit → force to "valet" regardless of what the caller sent */
    valet.source = "valet";
  }
});

export default Valet;