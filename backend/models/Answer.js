const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Answer = sequelize.define("Answer", {
  roundId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Rounds",
      key: "id",
    },
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Categories",
      key: "id",
    },
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Players",
      key: "id",
    },
  },
  answerText: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Answer;
