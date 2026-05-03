import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

export const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState(() => {
    const savedState = localStorage.getItem("gameState");
    return savedState
      ? JSON.parse(savedState)
      : {
          gameCode: null,
          roundNumber: 1,
          numRounds: 5,
          spicyMode: false,
          isHost: false,
          timer: 60,
        };
  });

  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(false);

  useEffect(() => {
    localStorage.setItem("gameState", JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setSocketReady(true);

      // Rejoin game room on reconnection
      const savedState = localStorage.getItem("gameState");
      if (savedState) {
        const { gameCode } = JSON.parse(savedState);
        if (gameCode) {
          socket.emit("join_game", gameCode);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocketReady(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const updateGameState = useCallback((updates) => {
    setGameState((prevState) => {
      const newState = { ...prevState, ...updates };
      localStorage.setItem("gameState", JSON.stringify(newState));
      return newState;
    });
  }, []);

  const emitEvent = useCallback((event, payload) => {
    if (socketRef.current) {
      socketRef.current.emit(event, payload);
    }
  }, []);

  return (
    <GameContext.Provider
      value={{
        gameState,
        updateGameState,
        emitEvent,
        socket: socketRef.current,
        socketReady,
        serverUrl: SERVER_URL,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
