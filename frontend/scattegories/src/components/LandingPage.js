import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useGame } from "../context/GameContext";

function LandingPage() {
  const [username, setUsername] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { updateGameState, emitEvent, serverUrl } = useGame();

  const createGame = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await axios.post(`${serverUrl}/api/game/create`, { username });
      const { gameCode: newGameCode, playerId } = response.data;

      updateGameState({ gameCode: newGameCode, isHost: true, roundNumber: 1 });
      emitEvent("join_lobby", newGameCode);

      sessionStorage.setItem("playerId", playerId);
      localStorage.setItem("gameCode", newGameCode);

      navigate(`/lobby/${newGameCode}`);
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create the game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await axios.post(`${serverUrl}/api/game/join`, {
        username,
        gameCode: gameCode.toUpperCase(),
      });
      const { playerId } = response.data;

      if (!playerId) {
        alert("Failed to join the game. Please try again.");
        setLoading(false);
        return;
      }

      const normalizedCode = gameCode.toUpperCase();
      updateGameState({ gameCode: normalizedCode, isHost: false });
      emitEvent("join_lobby", normalizedCode);

      sessionStorage.setItem("playerId", playerId);
      localStorage.setItem("gameCode", normalizedCode);

      navigate(`/lobby/${normalizedCode}`);
    } catch (error) {
      console.error("Error joining game:", error);
      alert("Failed to join the game. Please check the game code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e, action) => {
    if (e.key === "Enter") action();
  };

  return (
    <div className="page">
      <div className="card stack--lg">
        <div className="center gap-sm">
          <h1 className="title title--accent">Scattegories</h1>
          <p className="subtitle">The fast-thinking word game</p>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="username">Your Name</label>
          <input
            id="username"
            className="input"
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, createGame)}
            autoComplete="off"
            autoFocus
          />
        </div>

        <button
          className="btn btn--primary btn--full"
          onClick={createGame}
          disabled={!username || loading}
        >
          Create Game
        </button>

        <div className="divider">or join a game</div>

        <div className="input-group">
          <label className="input-label" htmlFor="gameCode">Game Code</label>
          <input
            id="gameCode"
            className="input input--mono"
            type="text"
            placeholder="ABC123"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => handleKeyDown(e, joinGame)}
            maxLength={6}
            autoComplete="off"
          />
        </div>

        <button
          className="btn btn--secondary btn--full"
          onClick={joinGame}
          disabled={!username || !gameCode || loading}
        >
          Join Game
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
