import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useGame } from "../context/GameContext";

function JoinPage() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { updateGameState, emitEvent, serverUrl } = useGame();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playerCount, setPlayerCount] = useState(null);

  useEffect(() => {
    fetch(`${serverUrl}/api/game/${gameCode}/players`)
      .then((r) => {
        if (!r.ok) throw new Error("Game not found");
        return r.json();
      })
      .then((data) => setPlayerCount(data.players.length))
      .catch(() => setError("This game doesn't exist or has already started."));
  }, [gameCode, serverUrl]);

  const joinGame = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${serverUrl}/api/game/join`, {
        username,
        gameCode: gameCode.toUpperCase(),
      });
      const { playerId } = response.data;

      if (!playerId) {
        setError("Failed to join. Please try again.");
        setLoading(false);
        return;
      }

      const normalizedCode = gameCode.toUpperCase();
      updateGameState({ gameCode: normalizedCode, isHost: false });
      emitEvent("join_lobby", normalizedCode);

      sessionStorage.setItem("playerId", playerId);
      localStorage.setItem("gameCode", normalizedCode);

      navigate(`/lobby/${normalizedCode}`);
    } catch (err) {
      const message =
        err.response?.data?.error || "Failed to join. Check the link and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && username) joinGame();
  };

  if (error && playerCount === null) {
    return (
      <div className="page">
        <div className="card stack--lg center">
          <h1 className="title title--accent">Scattegories</h1>
          <p className="subtitle" style={{ color: "var(--danger)" }}>{error}</p>
          <button className="btn btn--primary" onClick={() => navigate("/")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card stack--lg">
        <div className="center gap-sm">
          <h1 className="title title--accent">Scattegories</h1>
          <p className="subtitle">You've been invited to a game</p>
        </div>

        <div className="center gap-sm">
          <p className="section-label">Game Code</p>
          <div className="badge">{gameCode.toUpperCase()}</div>
          {playerCount !== null && (
            <p className="subtitle">
              {playerCount} {playerCount === 1 ? "player" : "players"} waiting
            </p>
          )}
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
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && (
          <p className="subtitle" style={{ color: "var(--danger)" }}>{error}</p>
        )}

        <button
          className="btn btn--primary btn--full"
          onClick={joinGame}
          disabled={!username || loading}
        >
          {loading ? "Joining…" : "Join Game"}
        </button>
      </div>
    </div>
  );
}

export default JoinPage;
