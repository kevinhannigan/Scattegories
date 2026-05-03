import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

function VotingScreen() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { socket, gameState, emitEvent, serverUrl } = useGame();

  const [groupedAnswers, setGroupedAnswers] = useState({});
  const [votes, setVotes] = useState({});
  const [aiJudgments, setAiJudgments] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [judging, setJudging] = useState(false);
  const [judgingFailed, setJudgingFailed] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(null);
  const [finalized, setFinalized] = useState(false);

  const fetchRoundStatus = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/game/${gameCode}/round-status`);
      const data = await res.json();
      setAiEnabled(data.aiEnabled);
      setSubmissionProgress({ submitted: data.submitted, total: data.total });

      if (data.judged && data.judgments) {
        setAiJudgments(data.judgments);
        setJudging(false);
        // Pre-fill votes from AI judgments
        const prefilled = {};
        for (const [answerId, judgment] of Object.entries(data.judgments)) {
          prefilled[answerId] = judgment.approved;
        }
        setVotes(prefilled);
      } else if (data.judging) {
        setJudging(true);
      }
    } catch (err) {
      console.error("Error fetching round status:", err);
    }
  }, [gameCode, serverUrl]);

  useEffect(() => {
    // Join socket room
    if (socket && gameCode) {
      socket.emit("join_game", gameCode);
    }
  }, [socket, gameCode]);

  useEffect(() => {
    const fetchAnswers = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/game/${gameCode}/answers`);
        const data = await response.json();

        const grouped = data.answers.reduce((acc, answer) => {
          const catName = answer.Category.name;
          if (!acc[catName]) acc[catName] = [];
          acc[catName].push(answer);
          return acc;
        }, {});

        setGroupedAnswers(grouped);
      } catch (error) {
        console.error("Error fetching answers:", error);
      }
    };

    fetchAnswers();
    fetchRoundStatus();

    if (socket) {
      socket.on("submission_progress", (progress) => {
        setSubmissionProgress(progress);
      });

      socket.on("judging_started", () => {
        setJudging(true);
        setJudgingFailed(false);
      });

      socket.on("judging_complete", ({ judgments }) => {
        setAiJudgments(judgments);
        setJudging(false);
        const prefilled = {};
        for (const [answerId, judgment] of Object.entries(judgments)) {
          prefilled[answerId] = judgment.approved;
        }
        setVotes(prefilled);
        // Re-fetch answers to update the display
        fetchAnswers();
      });

      socket.on("judging_failed", () => {
        setJudging(false);
        setJudgingFailed(true);
      });

      socket.on("vote_updated", (updatedVotes) => {
        setVotes(updatedVotes);
      });

      socket.on("move_to_leaderboard", () => {
        navigate(`/leaderboard/${gameCode}`);
      });
    }

    return () => {
      if (socket) {
        socket.off("submission_progress");
        socket.off("judging_started");
        socket.off("judging_complete");
        socket.off("judging_failed");
        socket.off("vote_updated");
        socket.off("move_to_leaderboard");
      }
    };
  }, [gameCode, socket, navigate, serverUrl, fetchRoundStatus]);

  const handleVoteChange = (answerId, approved) => {
    const updatedVotes = { ...votes, [answerId]: approved };
    setVotes(updatedVotes);

    if (socket) {
      socket.emit("update_votes", { gameCode, votes: updatedVotes });
    }
  };

  const forceJudge = async () => {
    try {
      const playerId = sessionStorage.getItem("playerId");
      await fetch(`${serverUrl}/api/game/${gameCode}/force-judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
    } catch (err) {
      console.error("Error forcing judging:", err);
    }
  };

  const submitVotes = async () => {
    if (finalized) return;
    setFinalized(true);

    try {
      const votesArray = Object.entries(votes).map(([answerId, approved]) => ({
        answerId,
        approved,
      }));

      await fetch(`${serverUrl}/api/game/${gameCode}/submit-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes: votesArray }),
      });

      emitEvent("move_to_leaderboard", { gameCode });
      navigate(`/leaderboard/${gameCode}`);
    } catch (error) {
      console.error("Error submitting votes:", error);
      setFinalized(false);
    }
  };

  const getAnswerClass = (answerId) => {
    if (votes[answerId] === true) return "voting-answer voting-answer--accepted";
    if (votes[answerId] === false) return "voting-answer voting-answer--rejected";
    return "voting-answer";
  };

  const categories = Object.entries(groupedAnswers);

  const isManualMode = !aiEnabled || judgingFailed;
  const isWaitingForJudging = aiEnabled && !aiJudgments && !judgingFailed;
  const showForceJudge =
    gameState.isHost &&
    aiEnabled &&
    !aiJudgments &&
    !judging &&
    !judgingFailed &&
    submissionProgress &&
    submissionProgress.submitted < submissionProgress.total;

  return (
    <div className="page page--top">
      <div className="center gap-sm" style={{ marginBottom: "1.5rem" }}>
        <h1 className="title" style={{ fontSize: "1.5rem" }}>
          {isManualMode ? "Review Answers" : "AI Results"}
        </h1>
        <p className="subtitle">Round {gameState.roundNumber}</p>
      </div>

      {/* Waiting / Progress States */}
      {isWaitingForJudging && !judging && (
        <div className="card center gap-md" style={{ marginBottom: "1.5rem", padding: "2rem" }}>
          {submissionProgress && (
            <p className="subtitle">
              {submissionProgress.submitted} of {submissionProgress.total} players submitted
            </p>
          )}
          <div className="status">
            <span className="status-dot" />
            Waiting for all answers
          </div>
          {showForceJudge && (
            <button className="btn btn--secondary btn--sm" onClick={forceJudge}>
              Judge available answers now
            </button>
          )}
        </div>
      )}

      {judging && (
        <div className="card center gap-md" style={{ marginBottom: "1.5rem", padding: "2rem" }}>
          <div className="status">
            <span className="status-dot" />
            AI is analyzing answers…
          </div>
          <p className="subtitle">This usually takes a few seconds</p>
        </div>
      )}

      {judgingFailed && (
        <div className="card center gap-md" style={{ marginBottom: "1.5rem", padding: "2rem" }}>
          <p className="subtitle" style={{ color: "var(--danger)" }}>
            AI judging unavailable — falling back to manual review
          </p>
        </div>
      )}

      {/* Answer Categories */}
      {categories.length === 0 && !isWaitingForJudging && !judging && (
        <div className="status">
          <span className="status-dot" />
          Waiting for answers
        </div>
      )}

      {(!isWaitingForJudging || isManualMode) &&
        categories.map(([categoryName, answers]) => (
          <div key={categoryName} className="voting-category">
            <h3 className="voting-category__title">{categoryName}</h3>
            {answers.map((answer) => (
              <div key={answer.id} className={getAnswerClass(answer.id)}>
                <div className="voting-answer__text">
                  <div className="voting-answer__value">
                    {answer.answerText || "—"}
                  </div>
                  <div className="voting-answer__player">
                    {answer.Player.username}
                  </div>
                  {aiJudgments && aiJudgments[answer.id] && (
                    <div
                      className="voting-answer__reason"
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginTop: "0.25rem",
                        fontStyle: "italic",
                      }}
                    >
                      {aiJudgments[answer.id].reason}
                    </div>
                  )}
                </div>
                {/* Host override controls (AI mode) or manual voting (manual mode) */}
                {gameState.isHost && (isManualMode || aiJudgments) && (
                  <div className="voting-answer__actions">
                    <button
                      className={`vote-btn vote-btn--accept${votes[answer.id] === true ? " active" : ""}`}
                      onClick={() => handleVoteChange(answer.id, true)}
                      aria-label="Accept"
                    >
                      ✓
                    </button>
                    <button
                      className={`vote-btn vote-btn--reject${votes[answer.id] === false ? " active" : ""}`}
                      onClick={() => handleVoteChange(answer.id, false)}
                      aria-label="Reject"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {/* Non-host sees verdict icon when AI judgments are ready */}
                {!gameState.isHost && aiJudgments && aiJudgments[answer.id] && (
                  <div style={{ fontSize: "1.25rem", flexShrink: 0 }}>
                    {votes[answer.id] === true ? "✓" : votes[answer.id] === false ? "✕" : "·"}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

      {/* Finalize Button */}
      {gameState.isHost && categories.length > 0 && (!isWaitingForJudging || isManualMode) && (
        <div style={{ width: "100%", maxWidth: 640, marginTop: "0.5rem" }}>
          <button
            className="btn btn--primary btn--full"
            onClick={submitVotes}
            disabled={finalized}
          >
            {finalized ? "Finalizing…" : aiJudgments ? "Continue to Leaderboard" : "Finalize Votes"}
          </button>
        </div>
      )}

      {!gameState.isHost && categories.length > 0 && (!isWaitingForJudging || isManualMode) && !judging && (
        <div className="status" style={{ marginTop: "1rem" }}>
          <span className="status-dot" />
          {aiJudgments ? "Waiting for host to continue" : "Host is reviewing answers"}
        </div>
      )}
    </div>
  );
}

export default VotingScreen;
