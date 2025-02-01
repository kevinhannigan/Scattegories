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
  const [gameState, setGameState] = useState(() => {
    // Load from storage if available
    const savedState = localStorage.getItem("gameState");
    return savedState
      ? JSON.parse(savedState)
      : {
        gameCode: null,
        roundNumber: 1,
        numRounds: 5,
        spicyMode: false,
        isHost: false,
        timer: 10,
      };
  });

  const socketRef = useRef(null);

  useEffect(() => {
    // Save game state in localStorage whenever it changes
    localStorage.setItem("gameState", JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    if (!socketRef.current) {
      const socket = io("http://localhost:5000", { transports: ["websocket"] });
      socketRef.current = socket;

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

      return () => socket.disconnect();
    }
  }, []);

  const updateGameState = (updates) => {
    setGameState((prevState) => {
      const newState = { ...prevState, ...updates };
      localStorage.setItem("gameState", JSON.stringify(newState));
      return newState;
    });
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
