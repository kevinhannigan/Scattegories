import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";
import axios from "axios";

function GameScreen() {
  const { gameCode } = useParams();
  const { gameState, updateGameState, socket, serverUrl } = useGame();
  const navigate = useNavigate();
  const [playerId] = useState(() => sessionStorage.getItem("playerId"));
  const [categories, setCategories] = useState([]);
  const [letter, setLetter] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [totalTime, setTotalTime] = useState(null);
  const [isRoundLoaded, setIsRoundLoaded] = useState(false);
  const answersRef = useRef({});
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (socket && gameCode) {
      socket.emit("join_game", gameCode);
    }
  }, [socket, gameCode]);

  const submitAnswers = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);

    try {
      await axios.post(`${serverUrl}/api/game/${gameCode}/submit-answers`, {
        answers: answersRef.current,
        username: playerId,
      });
      navigate(`/voting/${gameCode}`);
    } catch (error) {
      console.error("Error submitting answers:", error);
    }
  }, [gameCode, playerId, navigate, serverUrl]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchCurrentRound = async () => {
      try {
        const response = await axios.get(
          `${serverUrl}/api/game/${gameCode}/current-round`
        );

        updateGameState({
          roundNumber: response.data.roundNumber,
          timer: response.data.timer,
        });

        const t = response.data.timer || 60;
        setCategories(response.data.categories);
        setLetter(response.data.letter);
        setTotalTime(t);
        setTimeLeft(t);
        setSubmitted(false);
        submittedRef.current = false;
        answersRef.current = {};
        setIsRoundLoaded(true);
      } catch (error) {
        console.error("Error fetching current round:", error);
        fetchedRef.current = false;
      }
    };

    fetchCurrentRound();
  }, [gameCode, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRoundLoaded || timeLeft === null) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitAnswers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isRoundLoaded, submitAnswers]);

  const timerClass = timeLeft !== null && timeLeft <= 10
    ? "timer timer--danger"
    : timeLeft !== null && timeLeft <= 30
      ? "timer timer--warning"
      : "timer";

  const formatTime = (s) =>
    s !== null
      ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
      : "--:--";

  return (
    <div className="page page--top">
      <div className="game-header">
        <span className="game-header__round">
          Round {gameState.roundNumber}
        </span>
        <div className={timerClass}>
          <span className="timer-dot" />
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="letter-display">
        <span className="letter-label">Your letter</span>
        <span className="letter-char">{letter}</span>
      </div>

      {totalTime && timeLeft !== null && (
        <div style={{
          width: "100%",
          maxWidth: 720,
          height: 3,
          background: "var(--bg-card)",
          borderRadius: 2,
          marginBottom: "1.5rem",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${(timeLeft / totalTime) * 100}%`,
            height: "100%",
            background: timeLeft <= 10 ? "var(--danger)" : timeLeft <= 30 ? "#f5a623" : "var(--accent)",
            transition: "width 1s linear, background 0.5s ease",
            borderRadius: 2,
          }} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitAnswers();
        }}
        style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div className="category-grid">
          {categories.map((category, i) => (
            <div
              className="category-card"
              key={category.id}
              style={{ animationDelay: `${i * 30}ms`, animation: "fadeIn 0.3s ease both" }}
            >
              <span className="category-name">{category.name}</span>
              <input
                className="input"
                type="text"
                disabled={submitted}
                placeholder={`${letter}...`}
                onChange={(e) => (answersRef.current[category.id] = e.target.value)}
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: "1.5rem", width: "100%", maxWidth: 720 }}>
          {!submitted ? (
            <button type="submit" className="btn btn--primary btn--full">
              Submit Answers
            </button>
          ) : (
            <div className="status">
              <span className="status-dot" />
              Answers submitted — waiting for others
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export default GameScreen;
