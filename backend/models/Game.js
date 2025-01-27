const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Game = sequelize.define("Game", {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  hostId: {
    type: DataTypes.INTEGER, // Reference to the Player ID
    allowNull: false,
  },
  started: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  numRounds: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  spicyMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Game;
