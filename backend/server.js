const express = require("express");
const http = require("http"); // Required to create the server instance
const { Server } = require("socket.io"); // Import Socket.IO
const cors = require("cors");
const bodyParser = require("body-parser");
const sequelize = require("./db"); // Sequelize database connection
const gameRoutes = require("./routes/game"); // API routes
const { Game, Player } = require("./models"); // Models

const app = express();
const server = http.createServer(app); // Create HTTP server instance

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // React app's URL
    methods: ["GET", "POST"],
  },
});

const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Attach io to the req object
app.use((req, res, next) => {
  req.io = io; // Attach the io instance
  next(); // Call the next middleware
});

// API Routes
app.use("/api/game", gameRoutes);

// Sync Sequelize models with the database
//sequelize.sync({ force: true }).then(() => {
//   console.log("Database synced!");
// });

// In-memory tracking for game player lists
const gamePlayers = {};

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle when a player joins a lobby
  socket.on("join_lobby", async (gameCode) => {
    console.log(`User joined lobby for game: ${gameCode}`);

    socket.join(gameCode); // Join the socket room for the game

    // Fetch the current players in the game and emit an updated player list
    try {
      const game = await Game.findOne({ where: { code: gameCode } });
      if (!game) {
        console.error("Game not found:", gameCode);
        return;
      }

      const players = await Player.findAll({ where: { gameId: game.id }, attributes: ["id", "username"] });
      gamePlayers[gameCode] = players.map((player) => ({
        id: player.id,
        username: player.username,
      }));

      // Broadcast the updated player list to all players in the game room
      io.to(gameCode).emit("player_list_updated", gamePlayers[gameCode]);
    } catch (error) {
      console.error("Error fetching player list:", error);
    }
  });

  // Handle starting the game
  socket.on("game_started", async ({ gameCode, numRounds, spicyMode }) => {
    console.log(`Game started for game: ${gameCode}`);

    // Emit the game start event to all players in the game room
    io.to(gameCode).emit("game_started");

    try {
      // Update the game settings in the database
      const game = await Game.findOne({ where: { code: gameCode } });
      if (game) {
        game.numRounds = numRounds;
        game.spicyMode = spicyMode;
        game.started = true;
        await game.save();
      }
    } catch (error) {
      console.error("Error starting game:", error);
    }
  });

  // Handle player joining a game screen
  socket.on("join_game", (gameCode) => {
    socket.join(gameCode);
  });

  // Handle vote updates
  socket.on("update_votes", ({ gameCode, votes }) => {
    console.log(`Votes updated for game: ${gameCode}`);
    io.to(gameCode).emit("vote_updated", votes); // Broadcast votes to all players in the game
  });

  // Handle transition to leaderboard
  socket.on("move_to_leaderboard", async ({ gameCode }) => {
    console.log(`Moving to Leaderboard for game: ${gameCode}`);

    // Emit the game start event to all players in the game room
    io.to(gameCode).emit("move_to_leaderboard");

  });

  // Handle completion of voting
  socket.on("voting_complete", (gameCode) => {
    console.log(`Voting complete for game: ${gameCode}`);
    io.to(gameCode).emit("voting_complete");
  });

  // Handle next round
  socket.on("next_round", (gameCode) => {
    console.log(`Starting next round for game: ${gameCode}`);
    io.to(gameCode).emit("next_round");
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Start the HTTP and WebSocket server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
