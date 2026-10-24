"use client";
import WorkspaceLinks from "./WorkspaceLinks";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";
import RangeBuilder from "./RangeBuilder";
import ReviewEquity from "./ReviewEquity";
import {
  buildReview,
  reviewJournals,
  REVIEW_TOPICS,
  type DecisionPoint,
  type ReviewTopic,
} from "@/lib/review/model";
import {
  emptyReview,
  practiceEvidence,
  observeReview,
  reviewSummary,
  validateReview,
  REVIEW_KEY,
  type ReviewData,
} from "@/lib/review/progress";
import { emptyTraining, parseTraining } from "@/lib/training/progress";
import { emptyPost, validatePost } from "@/lib/postflop/progress";
import type { Journal } from "@/lib/hand-session";
export default function ReviewStudio() {
  const [evidence, setEvidence] = useState(() =>
    practiceEvidence(emptyTraining(), emptyPost()),
  );
  const [hands, setHands] = useState<Journal[]>([]),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [data, setData] = useState(emptyReview),
    [blocked, setBlocked] = useState(false),
    [storageError, setStorageError] = useState(""),
    [hand, setHand] = useState(-1),
    [step, setStep] = useState(0);
  const snapshot = useRef<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const found = reviewJournals(
          JSON.parse(localStorage.getItem("pokerlab-progress") ?? "null"),
        );
        setHands(found.hands);
        setNotice(found.message);
      } catch {
        setNotice("Saved hands could not be read. Nothing has been changed.");
      }
      try {
        const raw = localStorage.getItem(REVIEW_KEY);
        snapshot.current = raw;
        if (raw) setData(validateReview(JSON.parse(raw)));
      } catch {
        setBlocked(true);
        setStorageError(
          "Review progress could not be loaded or validated. It is left untouched; new review notes remain in memory. Use a valid backup to restore it.",
        );
      }
      try {
        setEvidence(
          practiceEvidence(
            parseTraining(localStorage.getItem("pokerlab-training-v1")),
            validatePost(
              JSON.parse(
                localStorage.getItem("pokerlab-postflop-v1") ??
                  '{"version":1,"attempts":[]}',
              ),
            ),
          ),
        );
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready && !blocked)
      try {
        if (localStorage.getItem(REVIEW_KEY) !== snapshot.current)
          throw Error("conflict");
        const serialized = JSON.stringify(data);
        localStorage.setItem(REVIEW_KEY, serialized);
        snapshot.current = serialized;
      } catch {
        queueMicrotask(
          () => (
            setBlocked(true),
            setStorageError(
              "Browser storage could not save new review notes, or the record changed in another tab. Existing data stays untouched; new notes are in memory only. Reload to load the latest saved notes.",
            )
          ),
        );
      }
  }, [data, ready, blocked]);
  const index = hand < 0 ? hands.length - 1 : Math.min(hand, hands.length - 1),
    review = useMemo(
      () => (index >= 0 ? buildReview(hands[index]) : null),
      [hands, index],
    ),
    frame = review?.frames[Math.min(step, review.frames.length - 1)],
    point = review?.decisions.find((p) => p.frameIndex === step),
    summary = reviewSummary(data);
  return (
    <div className="review-page">
      <header className="studio-header">
        <Link className="brand" href="/">
          ♧{" "}
          <span>
            Poker<span className="brand-light">Lab</span>
          </span>
        </Link>
        <nav aria-label="Studio navigation">
          <Link href="/">Practice room</Link>
          <Link href="/practice/draws">Training</Link>
          <Link href="/review" aria-current="page">
            Review
          </Link>
        </nav>
      </header>
      <main className="studio-main" id="main-content" tabIndex={-1}>
        <WorkspaceLinks current="Review" />
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              INTELLIGENT HAND REVIEW · LOCAL-FIRST
            </span>
            <h1>Understand the decision you had.</h1>
            <p>
              Completed PokerLab simulations only. Facts, range assumptions and
              teaching prompts stay separate.
            </p>
          </div>
          <span className="chip-tag">PLAY CHIPS ONLY</span>
        </div>
        {!ready ? (
          <p role="status">Loading recorded hands…</p>
        ) : (
          <>
            {notice && <p className="range-notice">{notice}</p>}
            {storageError && (
              <p role="alert" className="error">
                {storageError}
              </p>
            )}
            {review && frame ? (
              <>
                <section className="content-panel studio-playback">
                  <div className="drill-topline">
                    <h2>Hand Review Studio</h2>
                    <label>
                      Recorded completed hand
                      <select
                        aria-label="Review completed hand"
                        value={index}
                        onChange={(e) => {
                          setHand(Number(e.target.value));
                          setStep(0);
                        }}
                      >
                        {hands.map((_, i) => (
                          <option key={i} value={i}>
                            Recorded hand {i + 1} · hand #{hands[i].origin.hand}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p>
                    Frame {step + 1} of {review.frames.length} ·{" "}
                    <b>{frame.street}</b> · {frame.label}
                  </p>
                  <div
                    className="drill-cards replay-board"
                    aria-label="Review community cards"
                  >
                    {frame.board.map((c, i) => (
                      <Card key={i} card={c} />
                    ))}
                  </div>
                  <div className="replay-seats">
                    {frame.players.map((p, i) => (
                      <div
                        key={i}
                        className={frame.actor === i ? "replay-actor" : ""}
                      >
                        <b>
                          {p.name}
                          {p.folded ? " · folded" : ""}
                        </b>
                        <div className="drill-cards">
                          {p.cards ? (
                            p.cards.map((c, j) => (
                              <Card key={j} card={c} small />
                            ))
                          ) : (
                            <>
                              <Card hidden small />
                              <Card hidden small />
                            </>
                          )}
                        </div>
                        <small>
                          {p.chips} chips remaining · {p.bet} street bet
                        </small>
                      </div>
                    ))}
                  </div>
                  <p>
                    Public pot: {frame.pot} play chips.{" "}
                    {frame.actor >= 0
                      ? `${frame.players[frame.actor].name} to act; legal actions: ${frame.actions.join(", ")}.`
                      : "No pending decision in this frame."}
                  </p>
                  <div className="replay-controls">
                    <button
                      disabled={step === 0}
                      onClick={() => setStep((s) => s - 1)}
                    >
                      Previous review frame
                    </button>
                    <label>
                      Review playback
                      <input
                        aria-label="Review playback"
                        type="range"
                        min={0}
                        max={review.frames.length - 1}
                        value={step}
                        onChange={(e) => setStep(Number(e.target.value))}
                      />
                    </label>
                    <button
                      disabled={step >= review.frames.length - 1}
                      onClick={() => setStep((s) => s + 1)}
                    >
                      Next review frame
                    </button>
                  </div>
                  <div className="street-jumps">
                    {(
                      ["Preflop", "Flop", "Turn", "River", "Showdown"] as const
                    ).map((street) => (
                      <button
                        key={street}
                        disabled={
                          !review.frames.some((f) => f.street === street)
                        }
                        onClick={() =>
                          setStep(
                            review.frames.findIndex((f) => f.street === street),
                          )
                        }
                      >
                        {street}
                      </button>
                    ))}
                  </div>
                  <h3>Your recorded decisions · {review.decisions.length}</h3>
                  <div className="hero-decisions">
                    {review.decisions.map((p, i) => (
                      <button
                        key={p.commandIndex}
                        aria-pressed={step === p.frameIndex}
                        onClick={() => setStep(p.frameIndex)}
                      >
                        Decision {i + 1} · {p.street} · {p.chosen.action}
                        {p.chosen.amount !== undefined
                          ? ` to ${p.chosen.amount}`
                          : ""}
                      </button>
                    ))}
                  </div>
                  <p className="teaching-note">
                    Choose a highlighted player decision for facts, review and
                    equity. Opponent cards are concealed until a contested
                    showdown; folded hands remain concealed. Returning to an
                    earlier frame removes later information again.
                  </p>
                </section>
                {point ? (
                  <DecisionReview
                    key={point.context}
                    point={point}
                    earlier={review.decisions.filter(
                      (p) =>
                        p.commandIndex < point.commandIndex &&
                        p.board.length < point.board.length,
                    )}
                    data={data}
                    update={setData}
                  />
                ) : (
                  <section className="content-panel">
                    <h2>
                      {frame.street === "Showdown"
                        ? "The outcome is not the decision."
                        : "Select one of your decisions."}
                    </h2>
                    <p>
                      Use the decision buttons above to inspect only the
                      information known before your recorded action. Equity
                      analysis is intentionally limited to those decision
                      points.
                    </p>
                  </section>
                )}
              </>
            ) : (
              <section className="content-panel">
                <h2>No completed hand available to review.</h2>
                <p>
                  Finish a simulated hand in the practice room. Earlier
                  aggregate statistics and incomplete journals cannot be
                  reconstructed into complete hands.
                </p>
                <Link className="primary practice-link" href="/">
                  Open the practice room →
                </Link>
              </section>
            )}
            <section className="content-panel review-learning">
              <h2>Your concept practice plan</h2>
              <p>
                These are your reflections across distinct public decision
                contexts, not solver grades or a mastery certificate. Reopening
                an identical decision updates its resolution without creating
                independent evidence.
              </p>
              <div className="review-topic-grid">
                {(Object.keys(summary) as ReviewTopic[]).map((topic) => {
                  const s = summary[topic];
                  return (
                    <article key={topic}>
                      <h3>{REVIEW_TOPICS[topic]}</h3>
                      <p>
                        {evidence[topic].correct} / {evidence[topic].seen}{" "}
                        distinct practice exercises accepted. Repeats do not add
                        independent coverage.
                      </p>
                      <p>
                        {s.distinct} distinct contexts · {s.needsPractice}{" "}
                        marked for practice.
                      </p>
                      {s.earlyRate !== null && s.recentRate !== null ? (
                        <p>
                          Self-reported understanding at first review: early
                          distinct contexts {(s.earlyRate * 100).toFixed(0)}% →
                          recent distinct contexts{" "}
                          {(s.recentRate * 100).toFixed(0)}%. This compares
                          different decisions, not repeated flips of one answer.
                        </p>
                      ) : (
                        <p className="teaching-note">
                          At least four distinct contexts are needed for an
                          early/recent comparison.
                        </p>
                      )}
                      <Link
                        href={`/practice/${topic}`}
                        className="subtle-button"
                      >
                        Practice {REVIEW_TOPICS[topic].toLowerCase()} →
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
            <footer>
              <Link href="/">♧ Back to PokerLab</Link>
              <span>
                Retrospective education only · no live assistance or automated
                betting
              </span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
function DecisionReview({
  point: p,
  earlier,
  data,
  update,
}: {
  point: DecisionPoint;
  earlier: DecisionPoint[];
  data: ReviewData;
  update: (fn: (p: ReviewData) => ReviewData) => void;
}) {
  const [seat, setSeat] = useState(
      p.opponents.find((o) => !o.folded)?.seat ?? 1,
    ),
    [needs, setNeeds] = useState<ReviewTopic[]>(
      data.observations.some((o) => o.context === p.context)
        ? data.observations
            .filter((o) => o.context === p.context && o.latest === "practice")
            .map((o) => o.topic)
        : [
            ...new Set(
              p.findings
                .filter((f) => f.kind === "heuristic")
                .map((f) => f.topic),
            ),
          ],
    ),
    [understood, setUnderstood] = useState<ReviewTopic[]>(
      data.observations
        .filter((o) => o.context === p.context && o.latest === "understood")
        .map((o) => o.topic),
    ),
    [message, setMessage] = useState("");
  return (
    <div className="decision-review">
      <section className="content-panel">
        <span className="eyebrow">YOUR DECISION · INFORMATION CUTOFF</span>
        <h2>
          {p.street} · You chose {p.chosen.action}
          {p.chosen.amount !== undefined ? ` to ${p.chosen.amount}` : ""}
        </h2>
        <div className="drill-cards">
          {p.hero.map((c, i) => (
            <Card key={i} card={c} />
          ))}
        </div>
        <dl className="scenario-facts">
          <div>
            <dt>Position</dt>
            <dd>{p.position}</dd>
          </div>
          <div>
            <dt>Stack remaining</dt>
            <dd>{p.stack}</dd>
          </div>
          <div>
            <dt>Effective behind, deepest opponent</dt>
            <dd>{p.effectiveBehind}</dd>
          </div>
          <div>
            <dt>Pot before your action</dt>
            <dd>{p.pot}</dd>
          </div>
          <div>
            <dt>Immediate call</dt>
            <dd>{p.call}</dd>
          </div>
          <div>
            <dt>Hero-eligible pot after call</dt>
            <dd>{p.eligibleAfterCall}</dd>
          </div>
        </dl>
        <h3>Factual calculations</h3>
        <p>
          Legal actions at this point: <b>{p.actions.join(", ")}</b>.{" "}
          {p.actions.includes("raise") || p.actions.includes("bet")
            ? `Minimum full raise/bet total ${p.minRaiseTo}; maximum total ${p.maxRaiseTo}. A shorter all-in may be legal.`
            : ""}
        </p>
        <p>
          Your recorded action committed {p.committed} additional play chips.{" "}
          {p.call > 0
            ? `Immediate break-even pot share: ${p.call} ÷ ${p.eligibleAfterCall} = ${(p.requiredShare * 100).toFixed(2)}%, if there were no further costs.`
            : "No chips were owed; checking was free."}
        </p>
        <p className="teaching-note">
          The effective-behind figure is the lesser of your remaining stack and
          the deepest live opponent’s remaining stack; it excludes chips already
          in the pot. Short stacks, side pots and future raises make strategic
          use of the call price more complicated.
        </p>
        <details open>
          <summary>Action history available before this decision</summary>
          <ol className="post-prior">
            {p.history.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </details>
        <h3>Documented teaching rules · not numerical EV</h3>
        {p.findings.length ? (
          p.findings.map((f) => (
            <article className={`teaching-finding ${f.kind}`} key={f.rule}>
              <span>
                {f.rule} ·{" "}
                {f.kind === "fact"
                  ? "Factual reminder"
                  : "Heuristic review prompt"}
              </span>
              <h3>{f.title}</h3>
              <p>{f.evidence}</p>
              <p>{f.guidance}</p>
              <p className="teaching-note">{f.uncertainty}</p>
            </article>
          ))
        ) : (
          <p>
            No documented warning rule fired here. That does not prove your line
            was optimal. Explain the range assumptions and purpose of the
            decision before grading it yourself.
          </p>
        )}
        <div className="review-reflection">
          <h3>Choose concepts you want to practice</h3>
          <p>
            Suggested boxes come from heuristic prompts. You decide which
            reflect a learning gap; accepted alternatives are not automatically
            mistakes.
          </p>
          <div className="reflection-topics">
            {(Object.keys(REVIEW_TOPICS) as ReviewTopic[]).map((topic) => (
              <label key={topic}>
                {REVIEW_TOPICS[topic]}
                <select
                  aria-label={`Reflection: ${REVIEW_TOPICS[topic]}`}
                  value={
                    needs.includes(topic)
                      ? "practice"
                      : understood.includes(topic)
                        ? "understood"
                        : "unassessed"
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setNeeds((v) =>
                      value === "practice"
                        ? [...v.filter((t) => t !== topic), topic]
                        : v.filter((t) => t !== topic),
                    );
                    setUnderstood((v) =>
                      value === "understood"
                        ? [...v.filter((t) => t !== topic), topic]
                        : v.filter((t) => t !== topic),
                    );
                  }}
                >
                  <option value="unassessed">Not assessed</option>
                  <option value="practice">Needs practice</option>
                  <option value="understood">I can explain it</option>
                </select>
              </label>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => {
              try {
                if (!needs.length && !understood.length) {
                  setMessage(
                    "Choose at least one concept to assess. Unassessed topics are not graded.",
                  );
                  return;
                }
                const date = new Date(),
                  day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                const next = [...new Set([...needs, ...understood])].reduce(
                  (d, topic) =>
                    observeReview(
                      d,
                      p.context,
                      topic,
                      needs.includes(topic) ? "practice" : "understood",
                      day,
                    ),
                  data,
                );
                update(() => next);
                setMessage(
                  "Review saved in local history. Identical contexts count only once.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Save review & practice plan
          </button>
          <p role="status">{message}</p>
        </div>
      </section>
      <section className="content-panel">
        <label>
          Opponent to model
          <select
            aria-label="Review range opponent"
            value={seat}
            onChange={(e) => setSeat(Number(e.target.value))}
          >
            {p.opponents
              .filter((o) => !o.folded)
              .map((o) => (
                <option key={o.seat} value={o.seat}>
                  {o.name} · {o.profile} · {o.chips} chips behind
                </option>
              ))}
          </select>
        </label>
        <RangeBuilder
          key={p.context + seat}
          value={data.ranges[seat - 1]}
          blocked={[...p.hero, ...p.board]}
          onChange={(range) =>
            update((d) => ({
              ...d,
              ranges: d.ranges.map((r, i) => (i === seat - 1 ? range : r)),
            }))
          }
        />
        <ReviewEquity point={p} earlier={earlier} ranges={data.ranges} />
      </section>
    </div>
  );
}
