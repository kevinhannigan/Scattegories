const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const allCategories = require("./categories");
const ai = require("./ai");

ai.init();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// --------------- In-memory game store ---------------

const games = {};
const MAX_AI_CALLS_PER_GAME = 30;

function getRandomLetter() {
  const letters = "ABCDEFGHIJKLMNOPRSTW";
  return letters[Math.floor(Math.random() * letters.length)];
}

function pickRandomCategories(spicyMode, count = 12) {
  const pool = spicyMode
    ? allCategories
    : allCategories.filter((c) => !c.spicy);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// --------------- Config endpoint ---------------

app.get("/api/config", (req, res) => {
  res.json({ aiEnabled: ai.isAvailable() });
});

// --------------- REST API routes ---------------

app.post("/api/game/create", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username is required." });

  const gameCode = uuidv4().slice(0, 6).toUpperCase();
  const playerId = uuidv4();

  games[gameCode] = {
    code: gameCode,
    hostId: playerId,
    numRounds: 5,
    spicyMode: false,
    theme: "",
    timer: 60,
    started: false,
    players: {
      [playerId]: { id: playerId, username, score: 0 },
    },
    rounds: [],
    aiCallCount: 0,
  };

  res.status(201).json({ gameCode, playerId });
});

app.post("/api/game/join", (req, res) => {
  const { username, gameCode } = req.body;
  if (!username || !gameCode)
    return res.status(400).json({ error: "Username and game code required." });

  const game = games[gameCode];
  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.started) return res.status(400).json({ error: "Game already started." });

  const playerId = uuidv4();
  game.players[playerId] = { id: playerId, username, score: 0 };

  const playerList = Object.values(game.players);
  io.to(gameCode).emit("player_list_updated", playerList);

  res.status(200).json({ playerId });
});

app.get("/api/game/:gameCode/players", (req, res) => {
  const game = games[req.params.gameCode];
  if (!game) return res.status(404).json({ error: "Game not found." });

  res.status(200).json({
    players: Object.values(game.players),
    host: game.hostId,
  });
});

app.post("/api/game/:gameCode/start", async (req, res) => {
  const { gameCode } = req.params;
  const { playerId, numRounds, spicyMode, timer, theme } = req.body;
  const game = games[gameCode];

  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.hostId !== playerId)
    return res.status(403).json({ error: "Only the host can start the game." });

  game.numRounds = numRounds || game.numRounds;
  game.spicyMode = spicyMode !== undefined ? spicyMode : game.spicyMode;
  game.timer = timer || game.timer;
  game.theme = theme || "";
  game.started = true;

  if (game.rounds.length === 0) {
    const letter = getRandomLetter();
    let categories;

    if (ai.isAvailable() && game.aiCallCount < MAX_AI_CALLS_PER_GAME) {
      try {
        const playerNames = Object.values(game.players).map((p) => p.username);
        categories = await ai.generateCategories(
          playerNames,
          game.spicyMode,
          game.theme
        );
        game.aiCallCount++;
      } catch (err) {
        console.error("AI category generation failed, using static fallback:", err.message);
        categories = null;
      }
    }

    if (!categories) {
      categories = pickRandomCategories(game.spicyMode);
    }

    game.rounds.push({
      roundNumber: 1,
      letter,
      categories,
      answers: {},
      votes: {},
      judgments: null,
      judged: false,
      judging: false,
      scoresApplied: false,
    });
  }

  io.to(gameCode).emit("game_started");
  res.status(200).json({ message: "Game started successfully." });
});

app.get("/api/game/:gameCode/current-round", (req, res) => {
  const game = games[req.params.gameCode];
  if (!game) return res.status(404).json({ error: "Game not found." });

  const round = game.rounds[game.rounds.length - 1];
  if (!round) return res.status(404).json({ error: "No round found." });

  res.status(200).json({
    roundNumber: round.roundNumber,
    letter: round.letter,
    categories: round.categories,
    timer: game.timer,
  });
});

app.post("/api/game/:gameCode/submit-answers", (req, res) => {
  const { gameCode } = req.params;
  const { answers, username: playerId } = req.body;
  const game = games[gameCode];

  if (!game) return res.status(404).json({ error: "Game not found." });
  if (!playerId) return res.status(400).json({ error: "Player ID is required." });

  const player = game.players[playerId];
  if (!player) return res.status(404).json({ error: "Player not found." });

  const round = game.rounds[game.rounds.length - 1];
  if (!round) return res.status(404).json({ error: "No round found." });

  round.answers[playerId] = answers;

  const totalPlayers = Object.keys(game.players).length;
  const submittedCount = Object.keys(round.answers).length;

  io.to(gameCode).emit("submission_progress", {
    submitted: submittedCount,
    total: totalPlayers,
  });

  // Auto-trigger AI judging when all players have submitted
  if (
    submittedCount >= totalPlayers &&
    !round.judged &&
    !round.judging &&
    ai.isAvailable() &&
    game.aiCallCount < MAX_AI_CALLS_PER_GAME
  ) {
    triggerAiJudging(game, round, gameCode);
  }

  res.status(200).json({ message: "Answers submitted successfully." });
});

async function triggerAiJudging(game, round, gameCode) {
  round.judging = true;
  io.to(gameCode).emit("judging_started");

  try {
    const judgments = await ai.judgeAnswers(
      round.letter,
      round.categories,
      round.answers,
      game.players
    );
    game.aiCallCount++;

    const judgmentMap = {};
    if (judgments) {
      for (const j of judgments) {
        judgmentMap[j.id] = { approved: j.approved, reason: j.reason };
      }
    }

    round.judgments = judgmentMap;
    round.judged = true;
    round.judging = false;

    io.to(gameCode).emit("judging_complete", { judgments: judgmentMap });
  } catch (err) {
    console.error("AI judging failed:", err.message);
    round.judging = false;
    round.judgingError = true;
    io.to(gameCode).emit("judging_failed");
  }
}

// Host can force-trigger AI judging even if not all players submitted
app.post("/api/game/:gameCode/force-judge", async (req, res) => {
  const { gameCode } = req.params;
  const { playerId } = req.body;
  const game = games[gameCode];

  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.hostId !== playerId)
    return res.status(403).json({ error: "Only the host can force judging." });

  const round = game.rounds[game.rounds.length - 1];
  if (!round) return res.status(404).json({ error: "No round found." });
  if (round.judged) return res.status(400).json({ error: "Already judged." });
  if (round.judging) return res.status(400).json({ error: "Judging in progress." });

  if (ai.isAvailable() && game.aiCallCount < MAX_AI_CALLS_PER_GAME) {
    triggerAiJudging(game, round, gameCode);
    res.status(200).json({ message: "AI judging triggered." });
  } else {
    res.status(400).json({ error: "AI not available." });
  }
});

app.get("/api/game/:gameCode/round-status", (req, res) => {
  const game = games[req.params.gameCode];
  if (!game) return res.status(404).json({ error: "Game not found." });

  const round = game.rounds[game.rounds.length - 1];
  if (!round) return res.status(404).json({ error: "No round found." });

  const totalPlayers = Object.keys(game.players).length;
  const submittedCount = Object.keys(round.answers).length;

  res.status(200).json({
    submitted: submittedCount,
    total: totalPlayers,
    judging: round.judging,
    judged: round.judged,
    judgingError: round.judgingError || false,
    judgments: round.judgments,
    aiEnabled: ai.isAvailable(),
  });
});

app.get("/api/game/:gameCode/answers", (req, res) => {
  const game = games[req.params.gameCode];
  if (!game) return res.status(404).json({ error: "Game not found." });

  const round = game.rounds[game.rounds.length - 1];
  if (!round) return res.status(404).json({ error: "No round found." });

  const answers = buildAnswersList(game, round);
  res.status(200).json({ answers });
});

app.post("/api/game/:gameCode/submit-votes", (req, res) => {
  const { gameCode } = req.params;
  const { votes } = req.body;
  const game = games[gameCode];

  if (!game) return res.status(404).json({ error: "Game not found." });
  if (!Array.isArray(votes))
    return res.status(400).json({ error: "Invalid votes format." });

  const round = game.rounds[game.rounds.length - 1];

  // Prevent double-scoring for this round
  if (round.scoresApplied) {
    return res.status(400).json({ error: "Scores already applied for this round." });
  }

  for (const vote of votes) {
    round.votes[vote.answerId] = vote.approved;

    if (vote.approved) {
      const parts = vote.answerId.split("_");
      const answerPlayerId = parts[0];
      if (game.players[answerPlayerId]) {
        game.players[answerPlayerId].score += 1;
      }
    }
  }

  round.scoresApplied = true;
  res.status(200).json({ message: "Votes submitted successfully." });
});

app.get("/api/game/:gameCode/leaderboard", (req, res) => {
  const game = games[req.params.gameCode];
  if (!game) return res.status(404).json({ error: "Game not found." });

  const players = Object.values(game.players).sort((a, b) => b.score - a.score);
  res.status(200).json({ players, host: game.hostId });
});

app.post("/api/game/:gameCode/start-next-round", async (req, res) => {
  const { gameCode } = req.params;
  const { playerId } = req.body;
  const game = games[gameCode];

  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.hostId !== playerId)
    return res.status(403).json({ error: "Only the host can start the next round." });

  const currentRound = game.rounds[game.rounds.length - 1];
  const nextRoundNumber = currentRound.roundNumber + 1;

  if (nextRoundNumber > game.numRounds) {
    io.to(gameCode).emit("game_over", { message: "Game Over!" });
    return res.status(200).json({ message: "Game Over!" });
  }

  const letter = getRandomLetter();
  let categories;

  if (ai.isAvailable() && game.aiCallCount < MAX_AI_CALLS_PER_GAME) {
    try {
      const playerNames = Object.values(game.players).map((p) => p.username);
      categories = await ai.generateCategories(
        playerNames,
        game.spicyMode,
        game.theme
      );
      game.aiCallCount++;
    } catch (err) {
      console.error("AI category generation failed, using static fallback:", err.message);
      categories = null;
    }
  }

  if (!categories) {
    categories = pickRandomCategories(game.spicyMode);
  }

  const newRound = {
    roundNumber: nextRoundNumber,
    letter,
    categories,
    answers: {},
    votes: {},
    judgments: null,
    judged: false,
    judging: false,
    scoresApplied: false,
  };
  game.rounds.push(newRound);

  io.to(gameCode).emit("next_round_started", {
    roundNumber: nextRoundNumber,
    letter,
    categories,
    timer: game.timer,
  });

  res.status(200).json({
    message: "Next round started successfully.",
    round: newRound,
  });
});

// --------------- Helper ---------------

function buildAnswersList(game, round) {
  const list = [];
  for (const [playerId, playerAnswers] of Object.entries(round.answers)) {
    const player = game.players[playerId];
    if (!player) continue;

    for (const [catId, answerText] of Object.entries(playerAnswers)) {
      const category = round.categories.find((c) => String(c.id) === String(catId));
      if (!category) continue;

      const answerId = `${playerId}_${catId}`;
      list.push({
        id: answerId,
        answerText: answerText || "",
        Player: { username: player.username },
        Category: { name: category.name },
        approved: round.votes[answerId] ?? null,
      });
    }
  }
  return list;
}

// --------------- Serve React build in production ---------------

const clientBuildPath = path.join(__dirname, "..", "frontend", "scattegories", "build");
app.use(express.static(clientBuildPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

// --------------- Socket.IO ---------------

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join_lobby", (gameCode) => {
    socket.join(gameCode);
    const game = games[gameCode];
    if (game) {
      io.to(gameCode).emit("player_list_updated", Object.values(game.players));
    }
  });

  socket.on("join_game", (gameCode) => {
    socket.join(gameCode);
  });

  socket.on("game_started", ({ gameCode }) => {
    io.to(gameCode).emit("game_started");
  });

  socket.on("update_votes", ({ gameCode, votes }) => {
    socket.to(gameCode).emit("vote_updated", votes);
  });

  socket.on("move_to_leaderboard", ({ gameCode }) => {
    io.to(gameCode).emit("move_to_leaderboard");
  });

  socket.on("voting_complete", (gameCode) => {
    io.to(gameCode).emit("voting_complete");
  });

  socket.on("next_round", (gameCode) => {
    io.to(gameCode).emit("next_round");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

// --------------- Start ---------------

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
