import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

function Lobby() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { gameState, updateGameState, socket, serverUrl } = useGame();
  const [numRounds, setNumRounds] = useState(gameState.numRounds || 5);
  const [timer, setTimer] = useState(gameState.timer || 60);
  const [spicyMode, setSpicyMode] = useState(gameState.spicyMode || false);
  const [theme, setTheme] = useState("");
  const [players, setPlayers] = useState([]);
  const [starting, setStarting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/join/${gameCode}`;

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = inviteLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    fetch(`${serverUrl}/api/config`)
      .then((r) => r.json())
      .then((data) => setAiEnabled(data.aiEnabled))
      .catch(() => {});
  }, [serverUrl]);

  useEffect(() => {
    const savedGameCode = localStorage.getItem("gameCode");
    if (savedGameCode) {
      updateGameState({ gameCode: savedGameCode });
    }

    if (socket && gameCode) {
      socket.emit("join_lobby", gameCode);

      socket.on("player_list_updated", (updatedPlayers) => {
        setPlayers(updatedPlayers);
      });

      socket.on("game_started", () => {
        navigate(`/game/${gameCode}`);
      });

      return () => {
        socket.off("player_list_updated");
        socket.off("game_started");
      };
    }
  }, [socket, gameCode, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const startGame = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const playerId = sessionStorage.getItem("playerId");

      const response = await fetch(`${serverUrl}/api/game/${gameCode}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, numRounds, spicyMode, timer, theme, gameCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error starting game:", errorData.error);
        setStarting(false);
        return;
      }

      updateGameState({ numRounds, spicyMode, timer });
    } catch (error) {
      console.error("Error starting game:", error);
      setStarting(false);
    }
  };

  return (
    <div className="page">
      <div className="card card--wide card--waiting stack--lg">
        <div className="center gap-sm">
          <p className="subtitle">Game Code</p>
          <div className="badge">{gameCode}</div>
        </div>

        <div className="invite-section">
          <p className="section-label">Invite Players</p>
          <div className="invite-row">
            <input
              className="input"
              type="text"
              value={inviteLink}
              readOnly
              onClick={(e) => e.target.select()}
              style={{ fontSize: "0.8125rem" }}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={copyInviteLink}
              style={{ flexShrink: 0 }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <p className="section-label">
            Players ({players.length})
          </p>
          {players.length === 0 ? (
            <div className="empty">Waiting for players to join...</div>
          ) : (
            <ul className="player-list">
              {players.map((player, i) => (
                <li
                  className="player-item"
                  key={player.id}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="player-avatar">
                    {player.username.charAt(0)}
                  </span>
                  {player.username}
                </li>
              ))}
            </ul>
          )}
        </div>

        {gameState.isHost && (
          <div className="stack">
            <p className="section-label">Settings</p>
            <div className="settings-grid">
              <div className="setting-row">
                <span className="input-label">Rounds</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10"
                  value={numRounds}
                  onChange={(e) => setNumRounds(parseInt(e.target.value, 10))}
                />
              </div>
              <div className="setting-row">
                <span className="input-label">Time per round</span>
                <select
                  className="input"
                  value={timer}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTimer(v);
                    updateGameState({ timer: v });
                  }}
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={90}>1.5 minutes</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                </select>
              </div>
              <div className="setting-row">
                <span className="input-label">Spicy mode</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={spicyMode}
                    onChange={(e) => setSpicyMode(e.target.checked)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
              {aiEnabled && (
                <div className="input-group">
                  <label className="input-label" htmlFor="theme">
                    Game Theme (optional)
                  </label>
                  <input
                    id="theme"
                    className="input"
                    type="text"
                    placeholder="e.g., Harry Potter, Space, 90s TV"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>

            <button
              className="btn btn--primary btn--full"
              onClick={startGame}
              disabled={players.length < 1 || starting}
            >
              {starting ? "Starting…" : "Start Game"}
            </button>

            {aiEnabled && (
              <p className="subtitle" style={{ marginTop: "0.25rem" }}>
                AI-powered categories & judging enabled
              </p>
            )}
          </div>
        )}

        {!gameState.isHost && (
          <div className="status">
            <span className="status-dot" />
            Waiting for host to start
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
