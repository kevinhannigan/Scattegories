const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Category = sequelize.define("Category", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  spicy: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Category;
