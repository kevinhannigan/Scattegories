const Game = require("./Game");
const Player = require("./Player");
const Round = require("./Round");
const Category = require("./Category");
const RoundCategory = require("./RoundCategory");
const Answer = require("./Answer");

// Define relationships
Game.hasMany(Player, { foreignKey: "gameId" });
Player.belongsTo(Game, { foreignKey: "gameId" });

Game.hasMany(Round, { foreignKey: "gameId" });
Round.belongsTo(Game, { foreignKey: "gameId" });

Round.belongsToMany(Category, { through: RoundCategory, foreignKey: "roundId" });
Category.belongsToMany(Round, { through: RoundCategory, foreignKey: "categoryId" });

Round.hasMany(Answer, { foreignKey: "roundId" });
Answer.belongsTo(Round, { foreignKey: "roundId" });

Player.hasMany(Answer, { foreignKey: "playerId" });
Answer.belongsTo(Player, { foreignKey: "playerId" });

Category.hasMany(Answer, { foreignKey: "categoryId" });
Answer.belongsTo(Category, { foreignKey: "categoryId" });


module.exports = { Game, Player, Round, Category, RoundCategory, Answer };
