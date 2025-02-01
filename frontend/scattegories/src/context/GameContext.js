import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState({
    gameCode: null,
    roundNumber: 1,
    numRounds: 5,
    spicyMode: false,
    isHost: false,
    timer: 180
  });

  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      const socket = io("http://localhost:5000", { transports: ["websocket"] });
      socketRef.current = socket;

      // Listeners for global events
      socket.on("player_joined", ({ gameCode }) => {
        console.log(`Player joined lobby for game: ${gameCode}`);
      });

      socket.on("vote_updated", (votes) => {
        console.log("Votes updated:", votes);
      });

      socket.on("move_to_leaderboard", () => {
        console.log("Moving to leaderboard...");
      });

      socket.on("next_round", () => {
        console.log("Starting next round...");
      });

      // Clean up on unmount
      return () => socket.disconnect();
    }
  }, []);

  const updateGameState = (updates) => {
    setGameState((prevState) => ({ ...prevState, ...updates }));
  };

  const emitEvent = (event, payload) => {
    if (socketRef.current) {
      socketRef.current.emit(event, payload);
    }
  };

  return (
    <GameContext.Provider
      value={{ gameState, updateGameState, emitEvent, socket: socketRef.current }}
    >
      {children}
    </GameContext.Provider>
  );
};
