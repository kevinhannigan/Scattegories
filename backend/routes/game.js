const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { Game, Player, Round, Answer, Category, RoundCategory} = require("../models");

const sequelize = require("../db");

const router = express.Router();

/**
 * Route: POST /create
 * Purpose: Create a new game.
 */
router.post("/create", async (req, res) => {
    const { username, numRounds = 5, spicyMode = false } = req.body; // Default to 5 rounds and non-spicy mode
    const gameCode = uuidv4().slice(0, 6); // Generate a 6-character unique game code
  
    try {
      // Create the player first
      const player = await Player.create({ username });
  
      // Create the game with the player's ID as the hostId, and set the game settings
      const game = await Game.create({
        code: gameCode,
        hostId: player.id, // Set hostId directly during creation
        numRounds, // Save the number of rounds
        spicyMode // Save spicy mode
      });
  
      // Associate the player with the game
      player.gameId = game.id;
      await player.save();
  
      // Return the gameCode and playerId to the frontend
      res.status(201).json({ gameCode, playerId: player.id });
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ error: "Failed to create game." });
    }
  });
  
  
  
  

/**
 * Route: POST /join
 * Purpose: Join an existing game.
 */
router.post("/join", async (req, res) => {
  const { username, gameCode } = req.body;

  try {
    const game = await Game.findOne({ where: { code: gameCode } });

    if (!game) {
      return res.status(404).json({ error: "Game not found." });
    }

    const player = await Player.create({ username, gameId: game.id });
    console.log(`Player joined game ${gameCode} with ID: ${player.id}`);

    // Emit a real-time event for the updated player list
    const io = req.io;
    const players = await Player.findAll({ where: { gameId: game.id }, attributes: ["id", "username"] });
    io.to(gameCode).emit("player_list_updated", players);

    res.status(200).json({ playerId: player.id });
  } catch (error) {
    console.error("Error joining game:", error);
    res.status(500).json({ error: "Failed to join game." });
  }
});
  


/**
 * Route: GET /:gameCode/players
 * Purpose: Fetch all players in a game lobby.
 */
router.get("/:gameCode/players", async (req, res) => {
    const { gameCode } = req.params;
  
    try {
      const game = await Game.findOne({ where: { code: gameCode } });
  
      if (!game) {
        return res.status(404).json({ error: "Game not found." });
      }
  
      const players = await Player.findAll({ where: { gameId: game.id } });
  
      res.status(200).json({
        players,
        host: game.hostId, // Return the host username
      });
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ error: "Failed to fetch players." });
    }
  });
  



/**
 * Route: POST /:gameCode/start
 * Purpose: Start the game (only the host can start).
 */
router.post("/:gameCode/start", async (req, res) => {
    const { gameCode } = req.params;
    const { playerId, numRounds, spicyMode, timer } = req.body; // Include numRounds and spicyMode in the request body

    try {
        // Fetch the game by its code
        const game = await Game.findOne({ where: { code: gameCode } });

        if (!game) {
            return res.status(404).json({ error: "Game not found." });
        }

        // Ensure only the host can start the game
        if (game.hostId !== playerId) {
            return res.status(403).json({ error: "Only the host can start the game." });
        }

        // Update the game settings before starting
        game.numRounds = numRounds || game.numRounds; // Use the provided numRounds or keep the existing value
        game.spicyMode = spicyMode !== undefined ? spicyMode : game.spicyMode; // Use the provided spicyMode or keep the existing value
        game.timer = timer
        game.started = true;
        await game.save();

        // Check if the first round already exists
        const existingRound = await Round.findOne({
            where: { gameId: game.id },
        });

        if (!existingRound) {
            // Create the first round
            const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Generate a random letter (A-Z)
            const firstRound = await Round.create({
                gameId: game.id,
                roundNumber: 1,
                letter: randomLetter,
            });

            // Fetch and assign 12 random categories to the first round
            const categories = await Category.findAll({
                where: game.spicyMode ? {} : { spicy: false }, // Filter based on spicyMode
                order: sequelize.random(), // Randomize categories
                limit: 12, // Select 12 categories
            });

            // Save the categories to the RoundCategory join table
            for (const category of categories) {
                await RoundCategory.create({
                    roundId: firstRound.id,
                    categoryId: category.id,
                });
            }

            console.log("First round created with letter:", firstRound.letter);
        }

        // Emit the 'game_started' event to all players in the game room
        req.io.to(gameCode).emit("game_started");

        // Respond with success
        res.status(200).json({ message: "Game started successfully." });
    } catch (error) {
        console.error("Error starting game:", error);
        res.status(500).json({ error: "Failed to start the game." });
    }
});

  
  
  
  
  

/**
 * Route: GET /:gameCode/answers
 * Purpose: Fetch answers for the current round.
 */
/**
 * Route: GET /:gameCode/answers
 * Purpose: Fetch all answers for the current round.
 */
router.get("/:gameCode/answers", async (req, res) => {
    const { gameCode } = req.params;
  
    try {
        // Fetch the game by its code
        const game = await Game.findOne({ where: { code: gameCode } });
  
        if (!game) {
            return res.status(404).json({ error: "Game not found." });
        }
  
        // Fetch the latest round for the game
        const round = await Round.findOne({
            where: { gameId: game.id },
            order: [["roundNumber", "DESC"]],
        });
  
        if (!round) {
            return res.status(404).json({ error: "No round found for this game." });
        }
  
        // Fetch all answers for the current round, including player and category data
        const answers = await Answer.findAll({
            where: { roundId: round.id },
            include: [
                { model: Player, attributes: ["username"] },
                { model: Category, attributes: ["name"] }
            ],
            order: [["id", "ASC"]] // Optional: Order answers by submission
        });
  
        res.status(200).json({ answers });
    } catch (error) {
        console.error("Error fetching answers:", error);
        res.status(500).json({ error: "Failed to fetch answers." });
    }
});

  

/**
 * Route: POST /:gameCode/submit-votes
 * Purpose: Submit votes for answers and update player scores.
 */
/**
 * Route: POST /:gameCode/submit-votes
 * Purpose: Submit votes for answers and update player scores.
 */
router.post("/:gameCode/submit-votes", async (req, res) => {
    const { gameCode } = req.params;
    const { votes } = req.body;
  
    console.log("Votes received:", votes); // Debug log
  
    try {
      if (!Array.isArray(votes)) {
        return res.status(400).json({ error: "Invalid votes format. Expected an array." });
      }
  
      for (const vote of votes) {
        const answer = await Answer.findByPk(vote.answerId);
  
        if (answer) {
          answer.approved = vote.approved; // Update approval status
          await answer.save();
  
          if (vote.approved) {
            // Update player score for approved answers
            const player = await Player.findByPk(answer.playerId);
            player.score += 1;
            await player.save();
          }
        }
      }
  
      res.status(200).json({ message: "Votes submitted successfully." });
    } catch (error) {
      console.error("Error submitting votes:", error);
      res.status(500).json({ error: "Failed to submit votes." });
    }
  });
  
  

/**
 * Route: GET /:gameCode/leaderboard
 * Purpose: Fetch the leaderboard.
 */
router.get("/:gameCode/leaderboard", async (req, res) => {
    const { gameCode } = req.params;
  
    try {
      // Fetch the game by code
      const game = await Game.findOne({ where: { code: gameCode } });
  
      if (!game) {
        return res.status(404).json({ error: "Game not found." });
      }
  
      // Fetch all players in the game
      const players = await Player.findAll({
        where: { gameId: game.id },
        order: [["score", "DESC"]],
      });
  
      // Include the host's username in the response
      res.status(200).json({
        players,
        host: game.host, // Return the host's username
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard." });
    }
  });
  
  

  router.get("/:gameCode/current-round", async (req, res) => {
    const { gameCode } = req.params;
  
    try {
      const game = await Game.findOne({ where: { code: gameCode } });
  
      if (!game) {
        return res.status(404).json({ error: "Game not found." });
      }
  
      const round = await Round.findOne({
        where: { gameId: game.id },
        order: [["roundNumber", "DESC"]], // Fetch the latest round
        include: {
          model: Category, // Include associated categories
          through: { attributes: [] }, // Exclude join table attributes
        },
      });
  
      if (!round) {
        return res.status(404).json({ error: "No round found for this game." });
      }
  
      res.status(200).json({
        roundNumber: round.roundNumber, // Include round number
        letter: round.letter,
        categories: round.Categories,
        timer: game.timer
      });
    } catch (error) {
      console.error("Error fetching current round:", error);
      res.status(500).json({ error: "Failed to fetch current round." });
    }
  });
  
  
  
  

  router.post("/:gameCode/submit-answers", async (req, res) => {
    const { gameCode } = req.params;
    const { answers, username } = req.body;
  
    try {
      if (!username) {
        return res.status(400).json({ error: "Username is required." });
      }
  
      const game = await Game.findOne({ where: { code: gameCode } });
      if (!game) return res.status(404).json({ error: "Game not found." });
  
      const player = await Player.findOne({ where: { id: username, gameId: game.id } });
      if (!player) return res.status(404).json({ error: "Player not found." });
  
      const round = await Round.findOne({
        where: { gameId: game.id },
        order: [["id", "DESC"]],
      });
      if (!round) return res.status(404).json({ error: "No round found for this game." });
  
      const savedAnswers = [];
      for (const categoryId in answers) {
        const newAnswer = await Answer.create({
          roundId: round.id,
          categoryId,
          playerId: player.id,
          answerText: answers[categoryId],
        });
        savedAnswers.push(newAnswer);
      }
  
      // Fetch the newly saved answers with player and category details
      const updatedAnswers = await Answer.findAll({
        where: { roundId: round.id },
        include: [
          { model: Player, attributes: ["username"] },
          { model: Category, attributes: ["name"] },
        ],
      });
  
      // Emit updated answers to the game room
      req.io.to(gameCode).emit("answers_updated", updatedAnswers);
  
      res.status(200).json({ message: "Answers submitted successfully." });
    } catch (error) {
      console.error("Error submitting answers:", error);
      res.status(500).json({ error: "Failed to submit answers." });
    }
  });
  
  

  /**
 * Route: POST /:gameCode/start-next-round
 * Purpose: Start the next round.
 */
/**
 * Route: POST /:gameCode/start-next-round
 * Purpose: Start the next round for the game.
 */
router.post("/:gameCode/start-next-round", async (req, res) => {
    const { gameCode } = req.params;
    const playerId  = req.body.playerId; 
    console.log(req.body.playerId)
    console.log('Player Hosting' + playerId)// Ensure the playerId is sent in the request body

    try {
        // Fetch the game by its gameCode
        const game = await Game.findOne({ where: { code: gameCode } });

        if (!game) {
            return res.status(404).json({ error: "Game not found." });
        }

        console.log('Host of the Game in DB: ' + game.hostId)

        // Ensure only the host can start the next round
        if (game.hostId !== playerId) {
            return res.status(403).json({ error: "Only the host can start the next round." });
        }

        // Fetch the current round and calculate the next round number
        const currentRound = await Round.findOne({
            where: { gameId: game.id },
            order: [["roundNumber", "DESC"]], // Get the latest round
        });

        if (!currentRound) {
            return res.status(404).json({ error: "No current round found for this game." });
        }

        const nextRoundNumber = currentRound.roundNumber + 1;

        // Check if the game has more rounds
        if (nextRoundNumber > game.numRounds) {
            req.io.to(gameCode).emit("game_over", { message: "Game Over!" });
            return res.status(200).json({ message: "Game Over!" });
        }

        // Generate a random letter for the next round
        const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z

        // Create the new round
        const newRound = await Round.create({
            gameId: game.id,
            roundNumber: nextRoundNumber,
            letter: randomLetter
        });

        // Fetch and assign 12 random categories to the new round
        const categories = await Category.findAll({
            where: game.spicyMode ? {} : { spicy: false }, // Filter based on spicyMode
            order: sequelize.random(), // Randomize categories
            limit: 12, // Select 12 categories
        });

        for (const category of categories) {
            await RoundCategory.create({
                roundId: newRound.id,
                categoryId: category.id,
            });
        }

        // Emit a 'next_round_started' event to all players in the room
        req.io.to(gameCode).emit("next_round_started", {
            roundNumber: newRound.roundNumber,
            letter: newRound.letter,
            categories,
            timer: game.timer
        });

        res.status(200).json({
            message: "Next round started successfully.",
            round: newRound,
        });
    } catch (error) {
        console.error("Error starting next round:", error);
        res.status(500).json({ error: "Failed to start the next round." });
    }
});

  
  
  
  



module.exports = router;
