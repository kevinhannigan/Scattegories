const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const RoundCategory = sequelize.define("RoundCategory", {
  roundId: {
    type: DataTypes.INTEGER,
    references: {
      model: "Rounds",
      key: "id",
    },
    allowNull: false,
  },
  categoryId: {
    type: DataTypes.INTEGER,
    references: {
      model: "Categories",
      key: "id",
    },
    allowNull: false,
  },
});

module.exports = RoundCategory;
