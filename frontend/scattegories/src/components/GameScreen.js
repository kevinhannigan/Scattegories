import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";
import axios from "axios";

function GameScreen() {
  const { gameCode } = useParams();
  const { gameState, updateGameState, socket } = useGame();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [letter, setLetters] = useState("H")
  const [timer, setTimer] = useState(20); // Timer for the round
  const answersRef = useRef({}); // Store answers without risking stale state
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchCurrentRound = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/game/${gameCode}/current-round`);
        updateGameState({
          roundNumber: response.data.roundNumber,
        });
        setCategories(response.data.categories);
        setLetters(response.data.letter);
      } catch (error) {
        console.error("Error fetching current round:", error);
      }
    };

    fetchCurrentRound();
  }, [gameCode, updateGameState]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          submitAnswers(); // Auto-submit answers when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval); // Cleanup timer on unmount
  }, []);

  const handleInputChange = (categoryId, value) => {
    answersRef.current[categoryId] = value;
  };

  const submitAnswers = async () => {
    if (submitted) return; // Prevent duplicate submissions
    setSubmitted(true);

    try {
      const playerId = sessionStorage.getItem("playerId");
      await axios.post(`http://localhost:5000/api/game/${gameCode}/submit-answers`, {
        answers: answersRef.current,
        username: playerId,
      });

      socket.emit("voting_ready", gameCode); // Notify other players that the round is ready for voting
      navigate(`/voting/${gameCode}`);
    } catch (error) {
      console.error("Error submitting answers:", error);
    }
  };

  return (
    <div>
      <h1>Game Screen</h1>
      <h2>Letter: {letter}</h2>
      <h2>Round: {gameState.roundNumber}</h2>
      <h3>Time Remaining: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</h3>

      <form onSubmit={(e) => e.preventDefault()}>
        {categories.map((category) => (
          <div key={category.id}>
            <label>
              {category.name}:
              <input
                type="text"
                onChange={(e) => handleInputChange(category.id, e.target.value)}
              />
            </label>
          </div>
        ))}
        <button type="button" disabled={submitted || timer === 0} onClick={submitAnswers}>
          Submit
        </button>
      </form>
    </div>
  );
}

export default GameScreen;
