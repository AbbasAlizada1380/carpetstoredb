import { Sequelize } from "sequelize";

const sequelize = new Sequelize("carpetstoredb", "root", "newapp", {
  host: "localhost",
  port: 3306,
  dialect: "mysql",
  logging: console.log, // Enable logging to see connection attempts
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  retry: {
    max: 3,
  },
});

// Test connection (wrapped in an async IIFE)
(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
})();

export default sequelize;