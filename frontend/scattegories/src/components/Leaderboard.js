import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useGame } from "../context/GameContext";

function Leaderboard() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { gameState, updateGameState, socket } = useGame();
  const [roundNumber, setRoundNumber] = useState(gameState.roundNumber || 1); // Default to 5 rounds
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Join the game room
    socket.emit("join_game", gameCode);

    // Listen for "next_round_started" to transition all players to the game screen
    socket.on("next_round_started", ({ roundNumber, letter, categories }) => {
      // Update the global state with the new round data
      updateGameState({ roundNumber });

      // Navigate to the GameScreen with the new round data
      navigate(`/game/${gameCode}`, { state: { roundNumber, letter, categories } });
    });

    // Fetch leaderboard and game details
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/game/${gameCode}/leaderboard`);
        setPlayers(response.data.players);

        // Update game state from backend data
        updateGameState({
          roundNumber: response.data.roundNumber || 1, // Default to round 1 if not found
          //numRounds: response.data.numRounds,
        });
      } catch (error) {
        console.error("Error fetching leaderboard or game details:", error);
      }
    };

    fetchLeaderboard();

    return () => {
      socket.off("next_round_started"); // Clean up socket event listener on unmount
    };
  }, [gameCode, navigate, socket, updateGameState]);

  const startNextRound = async () => {
    try {
      const playerId = parseInt(sessionStorage.getItem("playerId"));
      console.log('Host starting next round: ' + playerId)
      const response = await axios.post(`http://localhost:5000/api/game/${gameCode}/start-next-round`, {
        playerId: playerId
      });

      console.log("Response from starting new round: " + JSON.stringify(response))

      updateGameState({
        roundNumber: response.data.roundNumber,
      });

      // Emit the "next_round_started" event (response from backend includes the round details)
      const { roundNumber, letter, categories } = response.data.round;
      socket.emit("next_round_started", { gameCode, roundNumber, letter, categories });
    } catch (error) {
      console.error("Error starting next round:", error);
    }
  };

  return (
    <div>
      <h1>Leaderboard</h1>
      <h2>
        Round <span className="game-code">{roundNumber}</span> of <span className="game-code">{gameState.numRounds}</span>
      </h2>
      <div className="leader-table">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={player.id}>
              <td>{index + 1}</td>
              <td>{player.username}</td>
              <td>{player.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {gameState.isHost && roundNumber < gameState.numRounds && (
        <button className="landingButton" onClick={startNextRound}>Start Next Round</button>
      )}
      {roundNumber >= gameState.numRounds && (
        <p>Game Over! Thanks for playing!</p>
      )}
    </div>
  );
}

export default Leaderboard;
