import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useGame } from "../context/GameContext";

function Leaderboard() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { gameState, updateGameState, socket, serverUrl } = useGame();
  const [players, setPlayers] = useState([]);
  const [starting, setStarting] = useState(false);
  const isGameOver = gameState.roundNumber >= gameState.numRounds;

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_game", gameCode);

    socket.on("next_round_started", ({ roundNumber }) => {
      updateGameState({ roundNumber });
      navigate(`/game/${gameCode}`);
    });

    socket.on("game_over", () => {
      updateGameState({ roundNumber: gameState.numRounds });
    });

    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(
          `${serverUrl}/api/game/${gameCode}/leaderboard`
        );
        setPlayers(response.data.players);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      }
    };

    fetchLeaderboard();

    return () => {
      socket.off("next_round_started");
      socket.off("game_over");
    };
  }, [gameCode, socket, navigate, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNextRound = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const playerId = sessionStorage.getItem("playerId");
      await axios.post(`${serverUrl}/api/game/${gameCode}/start-next-round`, {
        playerId,
      });
    } catch (error) {
      console.error("Error starting next round:", error);
      setStarting(false);
    }
  };

  const playAgain = () => {
    localStorage.removeItem("gameState");
    localStorage.removeItem("gameCode");
    sessionStorage.removeItem("playerId");
    navigate("/");
  };

  return (
    <div className="page">
      <div className="center gap-sm" style={{ marginBottom: "2rem" }}>
        <h1 className="title" style={{ fontSize: "1.5rem" }}>
          {isGameOver ? "Final Standings" : "Leaderboard"}
        </h1>
        <p className="subtitle">
          Round {gameState.roundNumber} of {gameState.numRounds}
        </p>
      </div>

      <div className="leaderboard">
        {players.map((player, index) => (
          <div
            className="leaderboard-row"
            key={player.id}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="leaderboard-rank">{index + 1}</span>
            <span className="leaderboard-name">{player.username}</span>
            <span className="leaderboard-score">{player.score}</span>
          </div>
        ))}
      </div>

      {isGameOver ? (
        <div className="game-over">
          <p className="game-over__title">Game Over</p>
          <p className="game-over__sub">Thanks for playing!</p>
          <button className="btn btn--primary" onClick={playAgain}>
            Play Again
          </button>
        </div>
      ) : (
        <>
          {gameState.isHost ? (
            <button
              className="btn btn--primary"
              onClick={startNextRound}
              disabled={starting}
              style={{ marginTop: "1.5rem" }}
            >
              {starting ? "Starting…" : "Next Round"}
            </button>
          ) : (
            <div className="status" style={{ marginTop: "1.5rem" }}>
              <span className="status-dot" />
              Waiting for host
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Leaderboard;
