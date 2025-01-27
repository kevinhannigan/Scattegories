import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { GameProvider } from "./context/GameContext";
import LandingPage from "./components/LandingPage";
import Lobby from "./components/Lobby";
import GameScreen from "./components/GameScreen";
import VotingScreen from "./components/VotingScreen";
import Leaderboard from "./components/Leaderboard";

function App() {
  return (
    <GameProvider>
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/lobby/:gameCode" element={<Lobby />} />
        <Route path="/game/:gameCode" element={<GameScreen />} />
        <Route path="/voting/:gameCode" element={<VotingScreen />} />
        <Route path="/leaderboard/:gameCode" element={<Leaderboard />} />
      </Routes>
    </Router>
    </GameProvider>
  );
}

export default App;
