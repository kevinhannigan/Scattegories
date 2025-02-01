import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";
import axios from "axios";

function GameScreen() {
  const { gameCode } = useParams();
  const { gameState, updateGameState, socket } = useGame();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState(sessionStorage.getItem("playerId"));
  const [categories, setCategories] = useState([]);
  const [letter, setLetter] = useState("H");
  const [timer, setTimer] = useState(gameState.timer || 120);
  const answersRef = useRef({});
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef(null);

  // Load existing game state and timer
  useEffect(() => {
    const fetchCurrentRound = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/game/${gameCode}/current-round`);
        updateGameState({
          roundNumber: response.data.roundNumber,
          timer: response.data.timer || gameState.timer, // Use backend timer if available
        });
        setCategories(response.data.categories);
        setLetter(response.data.letter);

        // Load saved timer from storage or use the gameState timer
        const savedTimer = localStorage.getItem(`gameTimer_${gameCode}`);
        setTimer(savedTimer ? parseInt(savedTimer, 10) : response.data.timer || gameState.timer);
      } catch (error) {
        console.error("Error fetching current round:", error);
      }
    };
    fetchCurrentRound();
  }, [gameCode, updateGameState, gameState.timer]);

  // Timer countdown with persistence
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current); // Ensure no duplicate intervals
    }

    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            clearInterval(timerRef.current);
            submitAnswers();
            return 0;
          }
          const newTime = prevTimer - 1;
          localStorage.setItem(`gameTimer_${gameCode}`, newTime); // Persist timer
          return newTime;
        });
      }, 1000);
    } else {
      submitAnswers();
    }

    return () => clearInterval(timerRef.current); // Cleanup on unmount
  }, [timer, gameCode]);

  const handleInputChange = (categoryId, value) => {
    answersRef.current[categoryId] = value;
  };

  const submitAnswers = async () => {
    if (submitted) return;
    setSubmitted(true);

    try {
      const playerId = sessionStorage.getItem("playerId");
      await axios.post(`http://localhost:5000/api/game/${gameCode}/submit-answers`, {
        answers: answersRef.current,
        username: playerId,
      });

      socket.emit("voting_ready", gameCode);
      navigate(`/voting/${gameCode}`);
    } catch (error) {
      console.error("Error submitting answers:", error);
    }
  };

  return (
    <div>
      <h1>Game Screen</h1>
      <h2>Player: {playerId}</h2>
      <h2>Letter: {letter}</h2>
      <h2>Round: {gameState.roundNumber}</h2>
      <h3>Time Remaining: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</h3>

      <form onSubmit={(e) => e.preventDefault()}>
        {categories.map((category) => (
          <div key={category.id}>
            <label>
              {category.name}:
              <input type="text" onChange={(e) => handleInputChange(category.id, e.target.value)} />
            </label>
          </div>
        ))}
      </form>
    </div>
  );
}

export default GameScreen;
