const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Player = sequelize.define("Player", {
  username: { type: DataTypes.STRING, allowNull: false },
  score: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = Player;
