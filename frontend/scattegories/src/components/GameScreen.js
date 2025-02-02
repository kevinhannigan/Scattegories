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
  const [letter, setLetter] = useState("");
  const [timer, setTimer] = useState(null); // 🔧 Set as `null` initially to ensure correct updates
  const [isRoundLoaded, setIsRoundLoaded] = useState(false);
  const answersRef = useRef({});
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef(null);

  // ✅ Step 1: Fetch Current Round & Set Initial Timer
  useEffect(() => {
    const fetchCurrentRound = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/game/${gameCode}/current-round`);
        console.log("Fetching new round:", JSON.stringify(response.data));

        updateGameState({
          roundNumber: response.data.roundNumber,
          timer: response.data.timer, // Use backend timer if available
        });

        setCategories(response.data.categories);
        setLetter(response.data.letter);

        // Ensure `isRoundLoaded` is set BEFORE setting the timer
        setIsRoundLoaded(true);

        // ✅ Separate `setTimer` to ensure it gets updated before countdown starts
        const savedTimer = localStorage.getItem(`gameTimer_${gameCode}`);
        setTimer(savedTimer ? parseInt(savedTimer, 10) : response.data.timer || 60);

      } catch (error) {
        console.error("Error fetching current round:", error);
      }
    };

    fetchCurrentRound();
  }, [gameCode]);

  useEffect(() => {
    if (!isRoundLoaded) return; // Ensure round is fully loaded before starting timer

    if (timerRef.current) {
      clearInterval(timerRef.current); // Avoid multiple intervals
    }

    console.log(`Starting timer countdown: ${timer} seconds`);

    timerRef.current = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(timerRef.current);
          submitAnswers();
          localStorage.removeItem(`gameTimer_${gameCode}`)
          return 0;
        }
        const newTime = prevTimer - 1;
        localStorage.setItem(`gameTimer_${gameCode}`, newTime);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timerRef.current); // Cleanup on unmount
  }, [isRoundLoaded, timer]); // 

  const submitAnswers = async () => {
    if (submitted) return;
    setSubmitted(true);

    try {
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
    <div className="landingPage">
       <h1>Round {gameState.roundNumber}</h1>
      <h2>Letter: <span className="category-letter">{letter}</span></h2>
      <h3>Time Remaining: <span className="round-timer">{timer !== null ? `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}` : "Loading..."}</span></h3>

      <form onSubmit={(e) => e.preventDefault()}>
        {categories.map((category) => (
          <div className="cattegory-list" key={category.id}>
            <label>
              {category.name}: 
              <input className="cattegory-input" type="text" onChange={(e) => (answersRef.current[category.id] = e.target.value)} />
            </label>
          </div>
        ))}
      </form>
    </div>
  );
}

export default GameScreen;
