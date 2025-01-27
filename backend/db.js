const { Sequelize } = require("sequelize");

// Initialize Sequelize
const sequelize = new Sequelize("scattegories", "postgres", "scattegories91", {
  host: "localhost",
  dialect: "postgres",
  logging: false, // Disable query logging (optional)
});

// Test the connection
sequelize
  .authenticate()
  .then(() => console.log("Connected to PostgreSQL!"))
  .catch((err) => console.error("Failed to connect to PostgreSQL:", err));

module.exports = sequelize;
