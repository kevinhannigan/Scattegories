import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../src/styles.css"
import { GameProvider } from "./context/GameContext"; // Import GameProvider

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <GameProvider>
      <App />
    </GameProvider>
);
