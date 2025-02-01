import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

function VotingScreen() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { socket, gameState } = useGame();
  const [groupedAnswers, setGroupedAnswers] = useState({});
  const [votes, setVotes] = useState({});

  useEffect(() => {
    // Fetch all answers when the component mounts
    const playerId = sessionStorage.getItem("playerId");
    console.log('Player Id Voting ' + playerId)
    const fetchAnswers = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/game/${gameCode}/answers`);
        const data = await response.json();

        // Group answers by category
        const grouped = data.answers.reduce((acc, answer) => {
          if (!acc[answer.Category.name]) {
            acc[answer.Category.name] = [];
          }
          acc[answer.Category.name].push(answer);
          return acc;
        }, {});

        setGroupedAnswers(grouped);
      } catch (error) {
        console.error("Error fetching answers:", error);
      }
    };

    fetchAnswers();

    // Listen for vote updates from the server
    if (socket) {
      socket.on("vote_updated", (updatedVotes) => {
        setVotes(updatedVotes); // Synchronize votes across players
      });

      socket.on("move_to_leaderboard", () => {
        navigate(`/leaderboard/${gameCode}`);
      });
    }

    return () => {
      if (socket) {
        socket.off("vote_updated");
        socket.off("move_to_leaderboard");
      }
    };
  }, [gameCode, socket, navigate]);

  const handleVoteChange = (answerId, approved) => {
    const updatedVotes = { ...votes, [answerId]: approved };
    setVotes(updatedVotes);

    // Emit updated votes to all players
    if (socket) {
      socket.emit("update_votes", { gameCode, votes: updatedVotes });
    }
  };

  const submitVotes = async () => {
    try {
      const playerId = parseInt(sessionStorage.getItem("playerId"));
      const votesArray = Object.entries(votes).map(([answerId, approved]) => ({
        answerId: parseInt(answerId),
        approved,
      }));

      await fetch(`http://localhost:5000/api/game/${gameCode}/submit-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, votes: votesArray }),
      });

      // Notify all players to move to the leaderboard
      if (socket) {
        socket.emit("move_to_leaderboard", { gameCode });
        navigate(`/leaderboard/${gameCode}`); // Navigate to the Leaderboard
      }
    } catch (error) {
      console.error("Error submitting votes:", error);
    }
  };

  const getAnswerStyle = (answerId) => {
    if (votes[answerId] === true) {
      return { backgroundColor: "#d4edda", color: "#155724", fontWeight: "bold" }; // Light green background, dark green text
    }
    if (votes[answerId] === false) {
      return { backgroundColor: "#f8d7da", color: "#721c24", fontWeight: "bold" }; // Light red background, bold red text
    }
    return {}; // Default style
  };

  return (
    <div>
      <h1>Voting Screen</h1>
      <h2>Rounds: {gameState.numRounds}</h2>
      {Object.entries(groupedAnswers).map(([categoryName, answers]) => (
        <div key={categoryName} style={{ marginBottom: "20px" }}>
          <h2>{categoryName}</h2>
          {answers.map((answer) => (
            <div key={answer.id} style={{ marginLeft: "20px", ...getAnswerStyle(answer.id) }}>
              <p>
                {answer.answerText} ({answer.Player.username})
              </p>
              {gameState.isHost && (
                <>
                  <button onClick={() => handleVoteChange(answer.id, true)}>Yes</button>
                  <button onClick={() => handleVoteChange(answer.id, false)}>No</button>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      {gameState.isHost && <button onClick={submitVotes}>Submit Votes</button>}
    </div>
  );
}

export default VotingScreen;
