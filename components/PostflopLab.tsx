"use client";
import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import {
  CONCEPTS,
  POSTFLOP,
  gradePost,
  postById,
  postLegal,
  type Concept,
} from "@/lib/postflop/scenarios";
import {
  POST_KEY,
  conceptStats,
  dayNumber,
  emptyPost,
  practiceQueue,
  recordPost,
  reviewState,
  validatePost,
} from "@/lib/postflop/progress";
import { analyzeTexture } from "@/lib/postflop/texture";
import type { Action, Card as PlayingCard } from "@/lib/poker";
export function cardText(cards: PlayingCard[]) {
  return cards
    .map((c) => "23456789TJQKA"[c.rank - 2] + "shdc"[c.suit])
    .join(" ");
}
export default function PostflopLab({
  analyze,
  initialConcept,
}: {
  analyze: (board: string, hole: string) => void;
  initialConcept?: Concept;
}) {
  const [progress, setProgress] = useState(emptyPost),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [mode, setMode] = useState("adaptive"),
    [street, setStreet] = useState("all"),
    [concept, setConcept] = useState<string>(initialConcept ?? "all"),
    [selection, setSelection] = useState<string | null>(null),
    [answer, setAnswer] = useState<Action | null>(null);
  const snapshot = useRef<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(POST_KEY);
        snapshot.current = raw;
        if (raw) setProgress(validatePost(JSON.parse(raw)));
      } catch {
        setBlocked(true);
        setStorageError(
          "Saved postflop data could not be read or validated. It has been left untouched. You can practice in memory or import a valid backup from Data.",
        );
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready && !blocked)
      try {
        if (localStorage.getItem(POST_KEY) !== snapshot.current)
          throw Error("conflict");
        const serialized = JSON.stringify(progress);
        localStorage.setItem(POST_KEY, serialized);
        snapshot.current = serialized;
      } catch {
        queueMicrotask(
          () => (
            setBlocked(true),
            setStorageError(
              "Storage is unavailable or changed in another tab. Existing data stays untouched. New practice remains in memory; reload before continuing on this device.",
            )
          ),
        );
      }
  }, [ready, blocked, progress]);
  const day = dayNumber(),
    queue = practiceQueue(progress, day, mode === "missed").filter((id) => {
      const s = postById(id);
      return (
        (street === "all" || s.street === street) &&
        (concept === "all" || s.concept === concept)
      );
    }),
    ids =
      mode === "catalogue"
        ? POSTFLOP.filter((s) => queue.includes(s.id)).map((s) => s.id)
        : queue,
    s = selection ? postById(selection) : ids.length ? postById(ids[0]) : null,
    stats = conceptStats(progress),
    review = s ? reviewState(progress, s.id) : null,
    grade = s && answer ? gradePost(s, answer) : null;
  function reset() {
    setSelection(null);
    setAnswer(null);
  }
  if (!ready) return <p role="status">Loading postflop practice…</p>;
  return (
    <>
      <div className="trainer-layout">
        <section className="content-panel">
          <span className="eyebrow">
            POSTFLOP INTELLIGENCE · 30 CURATED SPOTS
          </span>
          <h2>Think beyond your two cards.</h2>
          <div className="training-controls">
            <label>
              Practice mode
              <select
                aria-label="Postflop practice mode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  reset();
                }}
              >
                <option value="adaptive">
                  Adaptive: due & weak topics first
                </option>
                <option value="missed">Previously missed exercises</option>
                <option value="catalogue">Browse all exercises</option>
              </select>
            </label>
            <label>
              Street
              <select
                aria-label="Postflop street"
                value={street}
                onChange={(e) => {
                  setStreet(e.target.value);
                  reset();
                }}
              >
                <option value="all">All streets</option>
                {["Flop", "Turn", "River"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Concept
              <select
                aria-label="Postflop concept"
                value={concept}
                onChange={(e) => {
                  setConcept(e.target.value);
                  reset();
                }}
              >
                <option value="all">All concepts</option>
                {Object.entries(CONCEPTS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {storageError && (
            <p role="alert" className="error">
              {storageError}
            </p>
          )}
          {!s ? (
            <p>
              No missed exercises in this selection. Try the catalogue or
              another topic.
            </p>
          ) : (
            <>
              <label className="exercise-picker">
                Exercise
                <select
                  aria-label="Postflop exercise"
                  value={s.id}
                  onChange={(e) => {
                    setSelection(e.target.value);
                    setAnswer(null);
                  }}
                >
                  {[...new Set([s.id, ...ids])].map((id) => {
                    const f = postById(id);
                    return (
                      <option key={id} value={id}>
                        {POSTFLOP.indexOf(f) + 1}. {f.street} ·{" "}
                        {CONCEPTS[f.concept]} · {cardText(f.hole)}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="drill-topline">
                <h3>
                  {s.street} · {CONCEPTS[s.concept]}
                </h3>
                <span className="training-pill">
                  {s.judgment
                    ? "Judgment-dependent · alternatives accepted"
                    : "Simplified teaching baseline"}
                </span>
              </div>
              <div className="postflop-board">
                <div>
                  <span className="eyebrow">YOUR HAND</span>
                  <div className="drill-cards">
                    {s.hole.map((c, i) => (
                      <Card card={c} key={i} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="eyebrow">
                    {s.street.toUpperCase()} BOARD
                  </span>
                  <div className="drill-cards">
                    {s.board.map((c, i) => (
                      <Card card={c} key={i} />
                    ))}
                  </div>
                </div>
              </div>
              <dl className="scenario-facts">
                <div>
                  <dt>Position</dt>
                  <dd>
                    {s.position} ·{" "}
                    {s.position === "BTN" ? "in position" : "out of position"}
                  </dd>
                </div>
                <div>
                  <dt>Stack remaining</dt>
                  <dd>{s.stack} BB</dd>
                </div>
                <div>
                  <dt>Pot now</dt>
                  <dd>{s.pot} BB</dd>
                </div>
                <div>
                  <dt>Cost to call</dt>
                  <dd>{Math.min(s.facingBet, s.stack)} BB</dd>
                </div>
              </dl>
              <p>
                Opponent: <b>{s.opponent}</b> · opponent stack remaining{" "}
                {s.opponentStack} BB. Initial effective stacks 100 BB; blinds
                0.5 / 1 BB.
              </p>
              <details open>
                <summary>Prior betting actions</summary>
                <ol className="post-prior">
                  {s.prior.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </details>
              <div className="post-actions">
                {postLegal(s).map((a) => (
                  <button
                    key={a}
                    disabled={!!answer}
                    className={`${a === "bet" || a === "raise" ? "primary" : ""} ${answer === a ? "chosen" : ""}`}
                    onClick={() => {
                      if (answer) return;
                      try {
                        const next = recordPost(progress, s.id, a, day);
                        setProgress(next);
                        setSelection(s.id);
                        setAnswer(a);
                      } catch (error) {
                        setStorageError(
                          (error as Error).message +
                            " Existing saved practice has not been replaced. Export your history before starting a fresh record.",
                        );
                      }
                    }}
                  >
                    {a}
                    {a === "bet" || a === "raise"
                      ? ` ${a === "raise" ? "to " : ""}${s.size} BB`
                      : a === "call"
                        ? ` ${Math.min(s.facingBet, s.stack)} BB`
                        : ""}
                  </button>
                ))}
              </div>
              {grade && (
                <div
                  className={`answer-feedback ${grade.correct ? "correct" : "reconsider"}`}
                  role="status"
                >
                  <h3>
                    {grade.correct
                      ? "✓ Defensible teaching line"
                      : "A concept to revisit"}
                  </h3>
                  <p>{grade.explanation}</p>
                  <p>{s.lesson}</p>
                  <details>
                    <summary>Why accepted decisions make sense</summary>
                    {Object.entries(s.accepted).map(([a, text]) => (
                      <p key={a}>
                        <b>{a}: </b>
                        {text}
                      </p>
                    ))}
                  </details>
                  <button
                    className="primary"
                    onClick={() => {
                      setSelection(ids.find((id) => id !== s.id) ?? s.id);
                      setAnswer(null);
                    }}
                  >
                    Next postflop exercise →
                  </button>
                </div>
              )}
              <button
                className="subtle-button"
                onClick={() => analyze(cardText(s.board), cardText(s.hole))}
              >
                Analyze this board →
              </button>
              <p className="teaching-note">
                Amounts are big blinds; no rake or antes. Sizes are
                illustrative. Opponent profiles are tendencies, not proof of
                hidden cards. These judgments are not solver-backed GTO, equity,
                or EV estimates.
              </p>
            </>
          )}
        </section>
        <aside className="content-panel drill-sidebar">
          <h2>Retrieve, reflect, revisit.</h2>
          <p>
            Due misses come first, followed by due reviews and unseen exercises
            in weak concepts. You can browse freely or revisit any previously
            missed exercise.
          </p>
          {review && (
            <div className="accuracy-summary">
              <strong>
                {review.seen
                  ? new Date(review.due * 86400000).toISOString().slice(0, 10)
                  : "New exercise"}
              </strong>
              <span>
                {review.seen
                  ? "Next scheduled review date"
                  : "No retrieval evidence yet"}
              </span>
            </div>
          )}
          <p>
            Only the first answer to an exercise on a local calendar day affects
            its schedule. Same-day corrections cannot erase a miss. Intervals
            progress through 1, 3, 7, and 14 days after successful retrievals;
            an error returns it to 1 day.
          </p>
          <h3>Distinct exercise coverage</h3>
          {Object.entries(stats).map(([id, t]) => (
            <div className="concept-coverage" key={id}>
              <b>{CONCEPTS[id as Concept]}</b>
              <span>
                {t.correct} / {t.seen} accepted latest retrievals · {t.total}{" "}
                available
              </span>
            </div>
          ))}
          <p className="teaching-note">
            Coverage counts each exercise once, regardless of repetition. This
            is retrieval practice evidence, not a claim of strategy mastery or
            profitability. Earlier Phase 2 accuracy remains historical exercise
            accuracy.
          </p>
        </aside>
      </div>
    </>
  );
}
export function TextureSummary({
  board,
  hole,
}: {
  board: PlayingCard[];
  hole: PlayingCard[];
}) {
  const t = analyzeTexture(board, hole);
  return (
    <div className="texture-results">
      <div className="texture-badges">
        <span>{t.paired ? "Paired board" : "Unpaired board"}</span>
        <span>{t.suitLabel}</span>
        <span>
          {t.wet ? "Wet / coordinated" : "Dry / disconnected"} · heuristic
        </span>
      </div>
      <p>
        {t.connected >= 3
          ? "At least three distinct board ranks fit inside a five-rank straight window. Suitable hole cards may complete a straight; this does not identify an opponent’s made hand."
          : "No five-rank straight window contains three distinct board ranks. Straight possibilities are more limited, not impossible on future cards."}
      </p>
      <p>
        {t.possibleFlush
          ? "At least three board cards share a suit. A made flush is possible with suitable hole cards; it is not guaranteed."
          : t.possibleFlushDraw
            ? "A flush draw is possible for some hole cards on this suit texture."
            : t.canDraw
              ? "No immediate flush draw is possible on this board; backdoor possibilities may still exist on the flop."
              : "No made flush is possible using this board and only two hole cards."}
      </p>
      {hole.length > 0 && (
        <>
          <h3>Your actual made hand: {t.made}</h3>
          <p>
            {t.madeFlush
              ? "Your known cards contain a made flush."
              : t.flushDraw
                ? "Your known cards have a flush draw (four of one suit), not a made flush."
                : "Your known cards do not have an immediate flush draw."}
          </p>
          <p>
            {t.madeStraight
              ? "Your known cards contain a made straight."
              : t.straightRanks.length
                ? `Ranks that would complete a straight: ${t.straightRanks.map((r) => "23456789TJQKA"[r - 2]).join(", ")}. These are pattern-completing ranks, not guaranteed winning outs.`
                : "Your known cards do not have a one-card straight completion."}
          </p>
        </>
      )}
      {!t.canDraw && (
        <p className="range-notice">
          River: draws are closed. There are no future cards or drawing outs. A
          missed draw is not a made hand.
        </p>
      )}
      <p className="teaching-note">
        Wet/dry is a transparent teaching heuristic: a two-card suit on the flop
        or turn, a three-card suit on the river, or three ranks within a
        five-rank window makes this texture coordinated. Board possibilities
        describe compatible holdings, not a hand you or your opponent
        necessarily have.
      </p>
    </div>
  );
}
