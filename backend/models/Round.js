const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Round = sequelize.define("Round", {
  roundNumber: { type: DataTypes.INTEGER, allowNull: false },
  letter: { type: DataTypes.STRING, allowNull: false },
  gameId: {
    type: DataTypes.INTEGER,
    references: {
      model: "Games", // Name of the Game table
      key: "id", // Primary key in the Game table
    },
    onDelete: "CASCADE",
  },
});

module.exports = Round;
