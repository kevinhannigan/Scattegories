import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useGame } from "../context/GameContext";

function LandingPage() {
  const [username, setUsername] = useState("");
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();
  const { updateGameState, emitEvent } = useGame(); // Leverage GameContext

  const createGame = async () => {
    try {
      const response = await axios.post("http://localhost:5000/api/game/create", { username });
      const { gameCode, playerId } = response.data;

      updateGameState({ gameCode, isHost: true, roundNumber: 1 });

      emitEvent("join_lobby", gameCode);

      // Store playerId and gameCode persistently
      sessionStorage.setItem("playerId", playerId);
      localStorage.setItem("gameCode", gameCode);

      navigate(`/lobby/${gameCode}`);
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create the game. Please try again.");
    }
  };

  const joinGame = async () => {
    try {
      const response = await axios.post("http://localhost:5000/api/game/join", { username, gameCode });
      const { playerId } = response.data;

      if (!playerId || isNaN(playerId)) {
        console.error("Invalid playerId received:", playerId);
        alert("Failed to join the game. Please try again.");
        return;
      }

      updateGameState({ gameCode, isHost: false });

      emitEvent("join_lobby", gameCode);

      // Store playerId and gameCode persistently
      sessionStorage.setItem("playerId", playerId);
      localStorage.setItem("gameCode", gameCode);

      navigate(`/lobby/${gameCode}`);
    } catch (error) {
      console.error("Error joining game:", error);
      alert("Failed to join the game. Please check the game code and try again.");
    }
  };

  return (
    <div>
      <h1>Scattegories Game</h1>
      <div>
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <button onClick={createGame} disabled={!username}>
          Create Game
        </button>
      </div>
      <div>
        <input
          type="text"
          placeholder="Enter Game Code"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value)}
        />
      </div>
      <div>
        <button onClick={joinGame} disabled={!username || !gameCode}>
          Join Game
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
