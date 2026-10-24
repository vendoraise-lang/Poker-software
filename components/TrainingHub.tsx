"use client";
import { useEffect, useRef, useState } from "react";
import DecisionScenario from "./DecisionScenario";
import Card from "./Card";
import PostflopLab from "./PostflopLab";
import BoardAnalyzer from "./BoardAnalyzer";
import ProgressBackup from "./ProgressBackup";
import EquityLab from "./EquityLab";
import {
  SCENARIOS,
  TOPIC_LABELS,
  scenarioById,
  type Choice,
  type Topic,
} from "@/lib/training/fixtures";
import {
  HAND_CLASSES,
  RANKS,
  POSITIONS,
  combinations,
  exampleCards,
  inOpeningRange,
  matrixClass,
  rangeCombinations,
  type Position,
} from "@/lib/training/ranges";
import { ODDS_CAUTION, ODDS_QUIZZES, gradeOdds } from "@/lib/training/odds";
import {
  accuracy,
  answerDaily,
  attemptCorrect,
  beginDaily,
  emptyTraining,
  finishDaily,
  mistakesBy,
  readTraining,
  recordAttempt,
  recommendedTopic,
  saveTraining,
  startDaily,
  topicStats,
  unlockedLevel,
  type TrainingProgress,
} from "@/lib/training/progress";
type Tool =
  | "Decisions"
  | "Ranges"
  | "Pot odds"
  | "Analysis"
  | "Daily"
  | "Postflop"
  | "Texture"
  | "Data"
  | "Equity";
type Update = (fn: (p: TrainingProgress) => TrainingProgress) => void;
const LEVELS = ["Foundations", "Facing pressure", "Stack depth & re-raises"];
function percent(total: number, correct: number) {
  return total ? `${Math.round((correct / total) * 100)}%` : "—";
}
export default function TrainingHub({
  initialPractice,
}: {
  initialPractice?: string;
}) {
  const [progress, setProgress] = useState(emptyTraining);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const snapshot = useRef<string | null>(null);
  const [tool, setTool] = useState<Tool>(
    initialPractice === "pot-odds"
      ? "Pot odds"
      : initialPractice && initialPractice !== "opening"
        ? "Postflop"
        : "Decisions",
  );
  const [texture, setTexture] = useState({ board: "Ks 9s 3d", hole: "As Qs" });
  const [target, setTarget] = useState<Topic | null>(
    initialPractice === "opening" ? "opening" : null,
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        snapshot.current = localStorage.getItem("pokerlab-training-v1");
        const loaded = readTraining(window.localStorage);
        setProgress(loaded.progress);
        setStorageError(!loaded.available);
        setBlocked(!loaded.available);
      } catch {
        setBlocked(true);
        setStorageError(true);
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready && !blocked) {
      let saved = false;
      try {
        if (localStorage.getItem("pokerlab-training-v1") !== snapshot.current)
          throw Error("conflict");
        saved = saveTraining(window.localStorage, progress);
        if (saved) snapshot.current = JSON.stringify(progress);
      } catch {}
      if (!saved)
        queueMicrotask(() => {
          setStorageError(true);
          setBlocked(true);
        });
    }
  }, [progress, ready, blocked]);
  const update: Update = (fn) => setProgress((p) => fn(p));
  function focus(topic: Topic) {
    setTarget(topic);
    setTool(topic === "pot-odds" ? "Pot odds" : "Decisions");
  }
  return (
    <div className="training-hub">
      <div className="training-intro">
        <div>
          <span className="eyebrow">YOUR STRATEGY WORKSPACE</span>
          <h2>Build the habit behind the hand.</h2>
          <p>
            Small, focused exercises. Clear explanations. Progress that stays on
            your device.
          </p>
        </div>
        <span className="training-pill">Play chips · Local-first</span>
      </div>
      <div className="tool-tabs" role="tablist" aria-label="Training tools">
        {(
          [
            "Decisions",
            "Ranges",
            "Pot odds",
            "Analysis",
            "Daily",
            "Postflop",
            "Texture",
            "Data",
            "Equity",
          ] as Tool[]
        ).map((t) => (
          <button
            key={t}
            id={`tool-${t.replace(" ", "-")}`}
            role="tab"
            tabIndex={tool === t ? 0 : -1}
            onKeyDown={(e) => {
              const tabs = Array.from(
                e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              );
              const i = tabs.indexOf(e.currentTarget);
              const next =
                e.key === "ArrowRight"
                  ? (i + 1) % tabs.length
                  : e.key === "ArrowLeft"
                    ? (i + tabs.length - 1) % tabs.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : -1;
              if (next >= 0) {
                e.preventDefault();
                tabs[next].click();
                tabs[next].focus();
              }
            }}
            aria-selected={tool === t}
            aria-controls="training-tool-panel"
            onClick={() => {
              setTarget(null);
              setTool(t);
            }}
          >
            {t}
            {t === "Daily" && <small>10 min</small>}
          </button>
        ))}
      </div>
      {storageError && (
        <p role="alert" className="error">
          Training storage is unavailable. Saved data may be invalid or changed
          in another tab; existing records remain untouched. You can practice in
          memory. Reload to load newer data, or restore a valid backup using
          Data.
        </p>
      )}
      {!ready ? (
        <p role="status">Loading your training progress…</p>
      ) : (
        <div
          role="tabpanel"
          tabIndex={0}
          id="training-tool-panel"
          aria-labelledby={`tool-${tool.replace(" ", "-")}`}
        >
          {tool === "Decisions" ? (
            <Preflop
              key={target ?? "general"}
              progress={progress}
              update={update}
              target={target}
            />
          ) : tool === "Ranges" ? (
            <RangeMatrix />
          ) : tool === "Pot odds" ? (
            <PotOdds progress={progress} update={update} />
          ) : tool === "Analysis" ? (
            <Analysis progress={progress} focus={focus} />
          ) : tool === "Postflop" ? (
            <PostflopLab
              initialConcept={
                initialPractice &&
                initialPractice !== "pot-odds" &&
                initialPractice !== "opening"
                  ? (initialPractice as import("@/lib/postflop/scenarios").Concept)
                  : undefined
              }
              analyze={(board, hole) => {
                setTexture({ board, hole });
                setTool("Texture");
              }}
            />
          ) : tool === "Texture" ? (
            <BoardAnalyzer
              key={texture.board + texture.hole}
              initialBoard={texture.board}
              initialHole={texture.hole}
            />
          ) : tool === "Equity" ? (
            <EquityLab />
          ) : tool === "Data" ? (
            <ProgressBackup />
          ) : (
            <Daily progress={progress} update={update} />
          )}
        </div>
      )}
    </div>
  );
}
function Preflop({
  progress,
  update,
  target,
}: {
  progress: TrainingProgress;
  update: Update;
  target: Topic | null;
}) {
  const [level, setLevel] = useState(
    target === "reraising" ? 3 : target === "defending" ? 2 : 1,
  );
  const [topic, setTopic] = useState<string>(target ?? "all");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Choice | null>(null);
  const fixtures = SCENARIOS.filter(
      (s) => s.level === level && (topic === "all" || s.topic === topic),
    ),
    s = fixtures[index % fixtures.length];
  const suggested = unlockedLevel(progress);
  const stats = accuracy(
    progress.attempts.filter((a) => a.kind === "decision"),
  );
  function reset() {
    setIndex(0);
    setAnswer(null);
  }
  return (
    <div className="trainer-layout">
      <section className="content-panel">
        <div className="training-controls">
          <label>
            Difficulty
            <select
              aria-label="Difficulty"
              value={level}
              onChange={(e) => {
                setLevel(Number(e.target.value));
                setTopic("all");
                reset();
              }}
            >
              {LEVELS.map((l, i) => (
                <option key={l} value={i + 1}>
                  {i + 1}. {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Focus
            <select
              aria-label="Decision focus"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                reset();
              }}
            >
              <option value="all">All topics at this level</option>
              {(["opening", "defending", "reraising"] as const)
                .filter((t) =>
                  SCENARIOS.some((s) => s.level === level && s.topic === t),
                )
                .map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {s ? (
          <>
            <div className="exercise-counter">
              Exercise {(index % fixtures.length) + 1} of {fixtures.length} ·{" "}
              {LEVELS[level - 1]}
            </div>
            <DecisionScenario
              scenario={s}
              answer={answer}
              onAnswer={(choice) => {
                if (answer) return;
                setAnswer(choice);
                update((p) =>
                  recordAttempt(p, {
                    kind: "decision",
                    target: s.id,
                    choice,
                    source: "practice",
                  }),
                );
              }}
            />
            {answer && (
              <button
                className="primary next-exercise"
                onClick={() => {
                  setIndex((i) => i + 1);
                  setAnswer(null);
                }}
              >
                Next scenario →
              </button>
            )}
          </>
        ) : (
          <p>No fixtures at this level for this focus. Choose another level.</p>
        )}
      </section>
      <aside className="content-panel drill-sidebar">
        <span className="eyebrow">YOUR LEARNING PATH</span>
        <h2>Start simple. Add context.</h2>
        {LEVELS.map((l, i) => (
          <div
            className={`path-step ${level === i + 1 ? "current" : ""}`}
            key={l}
          >
            <span>{i + 1}</span>
            <div>
              <b>{l}</b>
              <p>
                {
                  [
                    "First-in choices and the value of position.",
                    "Respond to an open without overvaluing the price.",
                    "Consider stack depth, domination, and three-bets.",
                  ][i]
                }
              </p>
            </div>
          </div>
        ))}
        <p>
          Suggested: level {suggested}. Five answers at each of the first two
          levels move the suggested level forward. Repeat freely; every
          explanation is part of practice.
        </p>
        <button
          className="subtle-button"
          onClick={() => {
            setLevel(suggested);
            setTopic("all");
            reset();
          }}
        >
          Use suggested level
        </button>
        <div className="accuracy-summary">
          <strong>{percent(stats.total, stats.correct)}</strong>
          <span>Decision accuracy · {stats.total} attempts</span>
        </div>
        <p className="teaching-note">
          Accuracy means agreement with these fixtures’ accepted teaching lines.
          It is not a measure of profitability or optimal play. Repeated
          attempts count.
        </p>
      </aside>
    </div>
  );
}
function RangeMatrix() {
  const [position, setPosition] = useState<Position>("UTG");
  const [hand, setHand] = useState("AKs");
  const included = inOpeningRange(position, hand);
  return (
    <div className="trainer-layout range-layout">
      <section className="content-panel">
        <div className="drill-topline">
          <h2>169 ways to start.</h2>
          <label>
            Opening position
            <select
              aria-label="Opening position"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
            >
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Explore simplified, raise-first-in teaching ranges for unopened 6-max
          pots at about 100 BB. These are approximations, not exact GTO
          solutions.
        </p>
        <div className="matrix-legend">
          <span>
            <i className="legend-pair" /> Pairs · diagonal
          </span>
          <span>
            <i className="legend-suited" /> Suited · above
          </span>
          <span>
            <i className="legend-offsuit" /> Offsuit · below
          </span>
          <span>
            <i className="legend-included" /> In sample range
          </span>
        </div>
        {position === "BB" && (
          <p className="range-notice">
            The big blind has no raise-first-in range: if everyone folds, you
            win the blinds. After a small-blind limp you can check or raise.
            Defence against opens belongs in the decision trainer.
          </p>
        )}
        <p className="teaching-note">
          On narrow screens, scroll the grid horizontally. With a keyboard,
          focus one hand and use the arrow keys to move.
        </p>
        <div className="matrix-scroll">
          <table className="hand-matrix" aria-label="169 starting-hand classes">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Row and column ranks</span>
                </th>
                {RANKS.map((r) => (
                  <th key={r} scope="col">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RANKS.map((r, i) => (
                <tr key={r}>
                  <th scope="row">{r}</th>
                  {RANKS.map((c, j) => {
                    const h = matrixClass(i, j),
                      on = inOpeningRange(position, h);
                    return (
                      <td key={c}>
                        <button
                          aria-label={`${h} ${i === j ? "pair" : i < j ? "suited" : "offsuit"}${on ? ", in sample range" : ""}`}
                          aria-pressed={hand === h}
                          tabIndex={hand === h ? 0 : -1}
                          id={`matrix-${i}-${j}`}
                          className={`${i === j ? "pair" : i < j ? "suited" : "offsuit"} ${on ? "included" : ""} ${hand === h ? "selected-hand" : ""}`}
                          onClick={() => setHand(h)}
                          onKeyDown={(e) => {
                            const moves: Record<string, [number, number]> = {
                              ArrowLeft: [i, Math.max(0, j - 1)],
                              ArrowRight: [i, Math.min(12, j + 1)],
                              ArrowUp: [Math.max(0, i - 1), j],
                              ArrowDown: [Math.min(12, i + 1), j],
                            };
                            const next = moves[e.key];
                            if (next) {
                              e.preventDefault();
                              setHand(matrixClass(...next));
                              document
                                .getElementById(`matrix-${next[0]}-${next[1]}`)
                                ?.focus();
                            }
                          }}
                        >
                          {h}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="teaching-note">
          Select any cell, or use arrow keys within the matrix. On small
          screens, scroll the grid horizontally. Classes have different weights:
          pairs have 6 combinations, suited hands 4, and offsuit hands 12.
        </p>
      </section>
      <aside className="content-panel range-detail">
        <span className="eyebrow">HAND EXPLORER</span>
        <div className="drill-cards">
          {exampleCards(hand).map((c, i) => (
            <Card key={i} card={c} />
          ))}
        </div>
        <h2>{hand}</h2>
        <p>
          {hand.length === 2
            ? "Pocket pair"
            : hand.endsWith("s")
              ? "Suited: both cards share a suit"
              : "Offsuit: the cards have different suits"}
          . {combinations(hand)} possible combinations.
        </p>
        <div className="range-verdict">
          {position === "BB"
            ? "No unopened BB decision"
            : included
              ? `Included in the ${position} sample`
              : `Outside the ${position} sample`}
        </div>
        <p>
          {position === "BB"
            ? "Do not use an opening chart as a big-blind defence chart."
            : included
              ? "Our beginner sample opens this hand with a raise when every earlier player has folded."
              : "Our conservative sample folds this hand first in. Other sensible strategies may include it."}
        </p>
        <p>
          {position === "SB"
            ? "This small-blind sample deliberately teaches raising or folding; it omits limping strategies."
            : "Later positions generally get wider sample ranges because fewer players remain to act."}
        </p>
        <div className="accuracy-summary">
          <strong>{rangeCombinations(position)} / 1,326</strong>
          <span>
            Card combinations in this sample ·{" "}
            {HAND_CLASSES.filter((h) => inOpeningRange(position, h)).length}{" "}
            classes
          </span>
        </div>
        <p className="teaching-note">
          No rake, antes, reads or tournament effects are modeled. Opening
          charts do not apply unchanged after a raise or at different stack
          depths.
        </p>
      </aside>
    </div>
  );
}
function PotOdds({
  progress,
  update,
}: {
  progress: TrainingProgress;
  update: Update;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const q = ODDS_QUIZZES[index % ODDS_QUIZZES.length],
    grade = answer === null ? null : gradeOdds(q, answer),
    stats = topicStats(progress)["pot-odds"];
  return (
    <div className="trainer-layout">
      <section className="content-panel">
        <span className="eyebrow">PRICE FIRST. CONTEXT ALWAYS.</span>
        <h2>What does a call cost?</h2>
        <div className="odds-lesson">
          <div>
            <b>1 · Find the pot now</b>
            <p>Original pot + your opponent’s new bet.</p>
          </div>
          <div>
            <b>2 · Add your call</b>
            <p>Your call also becomes part of the final pot.</p>
          </div>
          <div>
            <b>3 · Divide</b>
            <p>
              Call cost ÷ final pot = the share you need to break even, if there
              are no further costs.
            </p>
          </div>
        </div>
        <div className="quiz-box">
          <span className="exercise-counter">
            Quiz {(index % ODDS_QUIZZES.length) + 1} of {ODDS_QUIZZES.length}
          </span>
          <h3>{q.context}</h3>
          <p>
            What percentage of the final pot must you win on average to cover
            this call, ignoring future betting and rake? Choose the closest
            answer.
          </p>
          <div className="quiz-options">
            {q.options.map((n) => (
              <button
                key={n}
                disabled={answer !== null}
                className={answer === n ? "chosen" : ""}
                onClick={() => {
                  if (answer !== null) return;
                  setAnswer(n);
                  update((p) =>
                    recordAttempt(p, {
                      kind: "odds",
                      target: q.id,
                      choice: String(n),
                      source: "practice",
                    }),
                  );
                }}
              >
                {n}%
              </button>
            ))}
          </div>
        </div>
        {grade && (
          <div
            className={`answer-feedback ${grade.correct ? "correct" : "reconsider"}`}
            role="status"
          >
            <h3>
              {grade.correct
                ? "✓ You found the price"
                : "Let’s walk through the price"}
            </h3>
            <ol>
              <li>
                Pot now: {q.potBeforeBet} + {q.bet} ={" "}
                <b>{grade.potNow} chips</b>.
              </li>
              <li>
                After calling: {grade.potNow} + {grade.call} ={" "}
                <b>{grade.finalPot} chips</b>.
              </li>
              <li>
                Required share: {grade.call} ÷ {grade.finalPot} × 100 ={" "}
                <b>{grade.percentage}%</b> (rounded).
              </li>
            </ol>
            <p>
              You risk {grade.call} to contest {grade.potNow} already in the
              pot. The denominator includes your own call.
            </p>
            <button
              className="primary"
              onClick={() => {
                setIndex((i) => i + 1);
                setAnswer(null);
              }}
            >
              Next quiz →
            </button>
          </div>
        )}
      </section>
      <aside className="content-panel drill-sidebar">
        <h2>A price is not a verdict.</h2>
        <p>{ODDS_CAUTION}</p>
        <p>
          On the flop or turn, a draw may face another bet, miss its outs, or
          make a second-best hand. We do not estimate equity or recommend a call
          from this calculation alone.
        </p>
        <div className="accuracy-summary">
          <strong>{percent(stats.total, stats.correct)}</strong>
          <span>Pot odds accuracy · {stats.total} attempts</span>
        </div>
      </aside>
    </div>
  );
}
function Analysis({
  progress,
  focus,
}: {
  progress: TrainingProgress;
  focus: (topic: Topic) => void;
}) {
  const stats = topicStats(progress),
    overall = accuracy(progress.attempts),
    topic = recommendedTopic(progress);
  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <span>Training attempts</span>
          <strong>{overall.total}</strong>
        </div>
        <div className="stat">
          <span>Teaching-line accuracy</span>
          <strong>{percent(overall.total, overall.correct)}</strong>
        </div>
        <div className="stat">
          <span>Sessions completed</span>
          <strong>{progress.sessions.length}</strong>
        </div>
        <div className="stat">
          <span>Suggested next level</span>
          <strong>{unlockedLevel(progress)}</strong>
        </div>
      </div>
      <div className="trainer-layout">
        <section className="content-panel">
          <h2>Find your next useful rep.</h2>
          <p>
            Scores include repeated attempts and accepted alternatives. They
            describe this exercise set, not the quality of your live-game
            decisions.
          </p>
          <table className="topic-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Accepted / attempts</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(stats) as Topic[]).map((t) => (
                <tr key={t}>
                  <td>{TOPIC_LABELS[t]}</td>
                  <td>
                    {stats[t].correct} / {stats[t].total}
                  </td>
                  <td>{percent(stats[t].total, stats[t].correct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Decision mistakes by category</h3>
          <p>
            One incorrect decision appears in each relevant category below.
            Pot-odds calculation errors are counted separately by topic above.
          </p>
          <div className="mistake-groups">
            {(["position", "strength", "action"] as const).map((d) => (
              <div key={d}>
                <h4>
                  {d === "strength"
                    ? "Hand strength"
                    : d === "position"
                      ? "Position"
                      : "Chosen action"}
                </h4>
                {Object.entries(mistakesBy(progress, d)).length ? (
                  Object.entries(mistakesBy(progress, d))
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, count]) => (
                      <div className="mistake-count" key={key}>
                        <span>{key}</span>
                        <b>{count}</b>
                      </div>
                    ))
                ) : (
                  <p>No mistakes recorded.</p>
                )}
              </div>
            ))}
          </div>
        </section>
        <aside className="content-panel drill-sidebar">
          <span className="eyebrow">TARGETED PRACTICE</span>
          <h2>{TOPIC_LABELS[topic]}</h2>
          <p>
            {overall.total === 0
              ? "Start with opening decisions to build a foundation."
              : overall.correct === overall.total
                ? "Your recorded answers match the teaching lines. Keep exploring with another set of opening decisions."
                : `This topic has the lowest accuracy among topics with recorded mistakes. Practice a few more ${TOPIC_LABELS[topic].toLowerCase()} exercises, then revisit the explanations.`}
          </p>
          <button className="primary" onClick={() => focus(topic)}>
            Practice {TOPIC_LABELS[topic].toLowerCase()} →
          </button>
          <h3>Recent decisions</h3>
          <ul className="attempt-list">
            {progress.attempts
              .slice(-8)
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  <span>{attemptCorrect(a) ? "✓" : "↺"}</span>
                  <div>
                    {a.kind === "decision"
                      ? `${scenarioById(a.target).hand} · ${scenarioById(a.target).position}`
                      : "Pot odds"}
                    <small>
                      {a.kind === "decision" ? a.choice : `${a.choice}%`} ·{" "}
                      {a.source === "daily" ? "daily session" : "practice"}
                    </small>
                  </div>
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
function Daily({
  progress,
  update,
}: {
  progress: TrainingProgress;
  update: Update;
}) {
  const [reviewing, setReviewing] = useState<number | null>(null);
  const d = progress.daily;
  const completed = d ? progress.sessions.some((s) => s.id === d.id) : false;
  const reviewed = reviewing !== null;
  const exerciseIndex = reviewing ?? d?.answers.length ?? 0;
  const prior =
    reviewed && d
      ? progress.attempts.find((a) => a.id === d.answers[reviewing])
      : undefined;
  function start() {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    update((p) => startDaily(p, date));
    setReviewing(null);
  }
  return (
    <div className="trainer-layout">
      <section className="content-panel daily-main">
        <span className="eyebrow">ABOUT TEN MINUTES. AT YOUR OWN PACE.</span>
        <h2>A little practice for today.</h2>
        <p>
          Three minutes of concepts, five minutes of decisions, two minutes of
          reflection. These are pacing suggestions, not a countdown. Missed days
          never reduce your progress.
        </p>
        {!d ? (
          <div className="empty-state">
            <p>Make room for five thoughtful decisions.</p>
            <button className="primary" onClick={start}>
              Start guided session →
            </button>
          </div>
        ) : !d.started ? (
          <>
            <div className="daily-date">
              Session {d.id} · {d.date} · Local device date
            </div>
            <div className="daily-lessons">
              <article>
                <b>01 · Position changes the story</b>
                <p>
                  In 6-max, action begins with UTG, then HJ, CO, BTN, SB and BB.
                  The button acts last after the flop. Open more selectively
                  when more players remain behind you.
                </p>
              </article>
              <article>
                <b>02 · Read the action before your cards</b>
                <p>
                  An unopened pot, a raise, and a three-bet call for different
                  plans. A playable opening hand is not automatically a playable
                  calling hand. Stack depth matters too.
                </p>
              </article>
              <article>
                <b>03 · Price is only one part</b>
                <p>
                  Pot odds compare the call with the final pot including your
                  call. A good-looking price does not measure your equity or
                  guarantee you can realize it.
                </p>
              </article>
            </div>
            <p>
              Your five exercises include two foundations, two facing-raise
              decisions and one stretch question. A stretch question can appear
              before its suggested practice level.
            </p>
            <button className="primary" onClick={() => update(beginDaily)}>
              Begin five scenarios →
            </button>
          </>
        ) : exerciseIndex < 5 ? (
          <>
            <div className="exercise-counter">
              Daily decision {exerciseIndex + 1} of 5 · {d.date}
            </div>
            <div
              className="daily-progress"
              aria-label={`${d.answers.length} of 5 answered`}
            >
              {d.plan.map((_, i) => (
                <span key={i} className={i < d.answers.length ? "done" : ""} />
              ))}
            </div>
            <DecisionScenario
              scenario={scenarioById(d.plan[exerciseIndex])}
              answer={prior ? (prior.choice as Choice) : null}
              onAnswer={(choice) => {
                if (reviewed) return;
                setReviewing(exerciseIndex);
                update((p) => answerDaily(p, choice));
              }}
            />
            {reviewed && (
              <button
                className="primary next-exercise"
                onClick={() => setReviewing(null)}
              >
                {d.answers.length === 5
                  ? "See session review"
                  : "Next daily decision"}{" "}
                →
              </button>
            )}
          </>
        ) : (
          <>
            <h3>Your five-decision review</h3>
            <p>
              {
                accuracy(
                  d.answers.map((id) =>
                    progress.attempts.find((a) => a.id === id)!,
                  ),
                ).correct
              }{" "}
              of 5 matched an accepted teaching line. Focus on the reasoning,
              rather than the score alone.
            </p>
            <ul className="daily-review">
              {d.answers.map((id, i) => {
                const a = progress.attempts.find((a) => a.id === id)!,
                  s = scenarioById(a.target);
                return (
                  <li key={id}>
                    <b>
                      {attemptCorrect(a) ? "✓" : "↺"} {i + 1}. {s.hand} ·{" "}
                      {s.position}
                    </b>
                    <p>
                      You chose {a.choice}. Preferred: {s.preferred}.{" "}
                      {s.explanations[a.choice as Choice]}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p>
              Reflection: Which position or prior action changed your plan?
              Choose one explanation to use during your next practice hand.
            </p>
            <button
              className="primary"
              disabled={completed}
              onClick={() => update(finishDaily)}
            >
              {completed ? "✓ Session completed" : "Complete session"}
            </button>
            {completed && (
              <button className="subtle-button" onClick={start}>
                Practice another session
              </button>
            )}
          </>
        )}
      </section>
      <aside className="content-panel drill-sidebar">
        <h2>Consistency, without pressure.</h2>
        <p>
          Completed sessions accumulate. There are no streak resets or
          penalties, and you can resume an unfinished session even on a later
          day.
        </p>
        <div className="accuracy-summary">
          <strong>{progress.sessions.length}</strong>
          <span>Completed sessions on this device</span>
        </div>
        <h3>Session history</h3>
        {progress.sessions.length ? (
          <ul className="attempt-list">
            {progress.sessions
              .slice(-10)
              .reverse()
              .map((s) => (
                <li key={s.id}>
                  <span>✓</span>
                  <div>
                    {s.date}
                    <small>
                      Session {s.id} · {s.correct} / 5 accepted
                    </small>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p>
            No completed sessions yet. Start whenever you have a little space to
            think.
          </p>
        )}
      </aside>
    </div>
  );
}
