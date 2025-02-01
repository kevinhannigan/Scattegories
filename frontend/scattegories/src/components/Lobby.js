import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

function Lobby() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { gameState, updateGameState, socket, emitEvent } = useGame();
  const [numRounds, setNumRounds] = useState(gameState.numRounds || 5); // Default to 5 rounds
  const [timer, setTimer] = useState(gameState.timer); // Default timer
  const [spicyMode, setSpicyMode] = useState(gameState.spicyMode || false); // Default to non-spicy mode
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Restore game state from localStorage
    const savedGameCode = localStorage.getItem("gameCode");
    if (savedGameCode) {
      updateGameState({ gameCode: savedGameCode });
    }
    // Emit 'join_lobby' event once when the component mounts
    if (socket && gameCode) {
      socket.emit("join_lobby", gameCode);

      // Listen for 'player_list_updated' events from the server
      socket.on("player_list_updated", (updatedPlayers) => {
        setPlayers(updatedPlayers); // Update the player list
      });

      // Listen for 'game_started' event to navigate to the game screen
      socket.on("game_started", () => {
        navigate(`/game/${gameCode}`);
      });

      // Clean up socket event listeners when the component unmounts
      return () => {
        socket.off("player_list_updated");
        socket.off("game_started");
      };
    }
  }, [socket, gameCode, navigate]);

  const startGame = async () => {
    try {
      const playerId = parseInt(sessionStorage.getItem("playerId"), 10);
      console.log('Lobby Player Id: ' + playerId)
      console.log('Starting Game with Timer: ' + timer)

      // Trigger the backend to create the first round and initialize game
      const response = await fetch(`http://localhost:5000/api/game/${gameCode}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, numRounds, spicyMode, timer, gameCode }),
      });
      console.log("Game Starting with Data: " + JSON.stringify({ playerId, numRounds, spicyMode, timer }))

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error starting game:", errorData.error);
        return;
      }
      // Update game state and emit event
      updateGameState({ numRounds, spicyMode, timer: timer });
      emitEvent("game_started", { gameCode });
      navigate(`/game/${gameCode}`); // Navigate to the GameScreen
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  const handleChange = (e) => {
    const newValue = Number(e.target.value); // Ensure it's a number
    setTimer(newValue);
    updateGameState({ timer: newValue })
    console.log("Timer: " + newValue)
  };
  return (
    <div className="landingPage">
      <h1>Lobby</h1>
      <h2>Game Code: <span className="game-code">{gameCode}</span></h2>
      <h2>Players:</h2>
      <ul className="lobby-list">
        {players.map((player) => (
          <li className="player-name" key={player.id}>{player.username}</li>
        ))}
      </ul>
      {gameState.isHost && (
        <div className="game-inputs">
          <div>
          <label>
            Number of Rounds:
            <input
              type="number"
              min="1"
              max="5"
              value={numRounds}
              onChange={(e) => setNumRounds(parseInt(e.target.value, 10))}
            />
          </label>
          </div>
          <div>
          <label htmlFor="timeSelect">Select Time:</label>
          <select id="timeSelect" value={timer} onChange={handleChange}>
            <option value={10}>10 seconds</option>
            <option value={60}>60 seconds</option>
            <option value={120}>120 seconds</option>
            <option value={180}>180 seconds</option>
            <option value={240}>240 seconds</option>
          </select>
          </div>
          <div>
          <label>
            Spicy Mode:
            <input
              className="checkbox"
              type="checkbox"
              checked={spicyMode}
              onChange={(e) => setSpicyMode(e.target.checked)}
            />
          </label>
          </div>
          <div>
            <button className="landingButton" onClick={startGame}>Start Game</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;
