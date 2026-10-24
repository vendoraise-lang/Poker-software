"use client";
import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { parseCards } from "@/lib/postflop/texture";
import {
  createEquityJob,
  fullDeck,
  validateEquity,
  type EquityInput,
  type EquityProgress,
  type EquityResult,
  type Interval,
} from "@/lib/equity/engine";
import { EQUITY_EXAMPLES } from "@/lib/equity/examples";
import {
  DRAW_EXERCISES,
  drawReport,
  fixedOutsProbability,
} from "@/lib/equity/draws";
import type { Card as PokerCard } from "@/lib/poker";
import type { WorkerResponse } from "@/workers/equity.worker";
const text = (cards: readonly PokerCard[]) =>
  cards.map((c) => "23456789TJQKA"[c.rank - 2] + "shdc"[c.suit]).join(" ");
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const interval = (i: Interval) => `${pct(i.low)}–${pct(i.high)}`;
function safeCards(s: string) {
  try {
    return parseCards(s);
  } catch {
    return [];
  }
}
function cardId(c: PokerCard) {
  return `${c.rank}-${c.suit}`;
}
export default function EquityLab() {
  const [section, setSection] = useState("Explorer");
  return (
    <div className="equity-lab">
      <div className="drill-topline">
        <div>
          <span className="eyebrow">EQUITY & PROBABILITY LAB</span>
          <h2>Calculate the cards. Understand the limits.</h2>
        </div>
        <span className="training-pill">
          Local computation · Play chips only
        </span>
      </div>
      <div className="equity-sections" aria-label="Probability lab sections">
        {["Explorer", "Outs trainer", "Multiway lessons"].map((s) => (
          <button
            key={s}
            aria-pressed={section === s}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {section === "Explorer" ? (
        <Explorer />
      ) : section === "Outs trainer" ? (
        <OutsTrainer />
      ) : (
        <MultiwayLessons />
      )}
    </div>
  );
}
function Explorer() {
  const [hero, setHero] = useState("As Ah"),
    [board, setBoard] = useState("Qs 7d 2c"),
    [count, setCount] = useState(1),
    [opponents, setOpponents] = useState(
      Array.from({ length: 5 }, (_, i) => ({
        known: i === 0,
        hand: i === 0 ? "Ks Kh" : "",
      })),
    ),
    [seed, setSeed] = useState("2026"),
    [samples, setSamples] = useState("5000"),
    [target, setTarget] = useState("hero"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [progress, setProgress] = useState<EquityProgress | null>(null),
    [result, setResult] = useState<EquityResult | null>(null),
    [baseline, setBaseline] = useState<EquityResult | null>(null),
    [lesson, setLesson] = useState(EQUITY_EXAMPLES[0].lesson as string);
  const worker = useRef<Worker | null>(null),
    requestId = useRef(0);
  useEffect(() => () => worker.current?.terminate(), []);
  const rawSignature = JSON.stringify({
    hero,
    board,
    opponents: opponents.slice(0, count),
    seed,
    samples,
  });
  const [signature, setSignature] = useState("");
  const stale = result !== null && rawSignature !== signature;
  function input(): EquityInput {
    if (!seed.trim()) throw Error("Enter an integer simulation seed.");
    return validateEquity({
      hero: parseCards(hero),
      board: parseCards(board),
      opponents: opponents
        .slice(0, count)
        .map((o) => (o.known ? parseCards(o.hand) : null)),
      seed: Number(seed),
      samples: Number(samples),
      mode: "auto",
    });
  }
  function loadExample(id: string) {
    const example = EQUITY_EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    const s = example.input;
    setHero(text(s.hero));
    setBoard(text(s.board));
    setCount(s.opponents.length);
    setOpponents(
      Array.from({ length: 5 }, (_, i) => ({
        known: !!s.opponents[i],
        hand: text(s.opponents[i] ?? []),
      })),
    );
    setSeed(String(s.seed));
    setSamples(String(s.samples));
    setTarget("hero");
    setLesson(example.lesson);
    setError("");
  }
  function calculate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const request = input(),
        plan = createEquityJob(request).progress();
      worker.current?.terminate();
      worker.current = null;
      setResult(null);
      const current = ++requestId.current;
      const w = new Worker(
        new URL("../workers/equity.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      setBusy(true);
      setProgress(plan);
      setStatus("Calculating in a background worker…");

      w.onmessage = ({ data }: { data: WorkerResponse }) => {
        if (current !== requestId.current || data.id !== current) return;
        if (data.type === "progress") setProgress(data.progress);
        else {
          setBusy(false);
          w.terminate();
          worker.current = null;
          if (data.type === "result") {
            setResult(data.result);
            setSignature(rawSignature);
            setStatus("Calculation complete.");
          } else {
            setError(data.message);
            setStatus("Calculation failed.");
          }
        }
      };
      w.onmessageerror = () => {
        if (current !== requestId.current) return;
        requestId.current++;
        w.terminate();
        worker.current = null;
        setBusy(false);
        setProgress(null);
        setError(
          "The browser could not read the background result. No result was accepted. Retry the calculation.",
        );
        setStatus("Calculation failed.");
      };
      w.onerror = () => {
        if (current !== requestId.current) return;
        setBusy(false);
        setError(
          "The background worker could not complete. Reduce the workload or retry in a browser supporting Web Workers.",
        );
        setStatus("Calculation failed.");
        w.terminate();
        worker.current = null;
      };
      w.postMessage({ id: current, input: request });
    } catch (err) {
      requestId.current++;
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      setProgress(null);
      setStatus("Calculation failed.");
      setError(
        (err as Error).message +
          " Check the card inputs, then retry. A browser that supports Web Workers is required.",
      );
    }
  }
  function cancel() {
    requestId.current++;
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setProgress(null);
    setStatus(
      "Calculation cancelled. No partial enumeration is presented as an equity result.",
    );
  }
  const activeValue =
      target === "hero"
        ? hero
        : target === "board"
          ? board
          : opponents[Number(target)].hand,
    selected = safeCards(activeValue),
    limit = target === "board" ? 5 : 2;
  const groups = [
      { id: "hero", cards: safeCards(hero) },
      { id: "board", cards: safeCards(board) },
      ...opponents.slice(0, count).map((o, i) => ({
        id: String(i),
        cards: o.known ? safeCards(o.hand) : [],
      })),
    ],
    blocked = new Set(
      groups.filter((g) => g.id !== target).flatMap((g) => g.cards.map(cardId)),
    );
  function setCards(cards: PokerCard[]) {
    const value = text(cards);
    if (target === "hero") setHero(value);
    else if (target === "board") setBoard(value);
    else
      setOpponents((o) =>
        o.map((v, i) =>
          i === Number(target) ? { known: true, hand: value } : v,
        ),
      );
  }
  return (
    <>
      <div className="trainer-layout equity-layout">
        <section className="content-panel">
          <form onSubmit={calculate}>
            <fieldset disabled={busy} className="equity-fieldset">
              <legend className="sr-only">Equity inputs</legend>
              <label>
                Teaching example
                <select
                  aria-label="Equity example"
                  defaultValue="overpair"
                  onChange={(e) => loadExample(e.target.value)}
                >
                  {EQUITY_EXAMPLES.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="equity-lesson">{lesson}</p>
              <div className="equity-inputs">
                <label>
                  Hero hand
                  <input
                    aria-label="Equity hero hand"
                    value={hero}
                    onChange={(e) => setHero(e.target.value)}
                    placeholder="As Ah"
                  />
                </label>
                <label>
                  Community cards
                  <input
                    aria-label="Equity board"
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    placeholder="Empty, or 3 / 4 / 5 cards"
                  />
                </label>
                <label>
                  Total players
                  <select
                    aria-label="Equity total players"
                    value={count + 1}
                    onChange={(e) => {
                      const n = Number(e.target.value) - 1;
                      setCount(n);
                      if (
                        target !== "hero" &&
                        target !== "board" &&
                        Number(target) >= n
                      )
                        setTarget("hero");
                    }}
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} players
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="equity-opponents">
                {opponents.slice(0, count).map((o, i) => (
                  <div key={i}>
                    <label>
                      Opponent {i + 1}
                      <select
                        aria-label={`Opponent ${i + 1} mode`}
                        value={o.known ? "known" : "random"}
                        onChange={(e) => {
                          setOpponents((os) =>
                            os.map((p, j) =>
                              j === i
                                ? { ...p, known: e.target.value === "known" }
                                : p,
                            ),
                          );
                          if (
                            e.target.value === "random" &&
                            target === String(i)
                          )
                            setTarget("hero");
                        }}
                      >
                        <option value="random">
                          Uniform random legal hand
                        </option>
                        <option value="known">Known two-card hand</option>
                      </select>
                    </label>
                    {o.known && (
                      <label>
                        Known cards
                        <input
                          aria-label={`Opponent ${i + 1} cards`}
                          value={o.hand}
                          onChange={(e) =>
                            setOpponents((os) =>
                              os.map((p, j) =>
                                j === i ? { ...p, hand: e.target.value } : p,
                              ),
                            )
                          }
                          placeholder="Ks Kh"
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div className="card-picker">
                <div className="drill-topline">
                  <label>
                    Card picker target
                    <select
                      aria-label="Card picker target"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="hero">Hero hand · 2 cards</option>
                      <option value="board">Board · up to 5 cards</option>
                      {opponents.slice(0, count).map(
                        (o, i) =>
                          o.known && (
                            <option key={i} value={i}>
                              Opponent {i + 1}
                            </option>
                          ),
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="subtle-button"
                    onClick={() => setCards([])}
                  >
                    Clear selected group
                  </button>
                </div>
                <div
                  className="selected-picker-cards"
                  aria-label="Selected card picker cards"
                >
                  {selected.length ? (
                    selected.map((c, i) => <Card key={i} card={c} small />)
                  ) : (
                    <span>No cards selected</span>
                  )}
                </div>
                <div className="deck-picker" aria-label="52-card picker">
                  {fullDeck()
                    .sort((a, b) => a.suit - b.suit || b.rank - a.rank)
                    .map((c) => {
                      const on = selected.some((s) => cardId(s) === cardId(c));
                      return (
                        <button
                          key={cardId(c)}
                          type="button"
                          aria-label={`Pick ${text([c])}`}
                          aria-pressed={on}
                          disabled={
                            blocked.has(cardId(c)) ||
                            (!on && selected.length >= limit)
                          }
                          className={`${on ? "picked" : ""} ${c.suit === 1 || c.suit === 2 ? "red" : ""}`}
                          onClick={() =>
                            setCards(
                              on
                                ? selected.filter(
                                    (s) => cardId(s) !== cardId(c),
                                  )
                                : [...selected, c],
                            )
                          }
                        >
                          {"23456789TJQKA"[c.rank - 2]}
                          {["♠", "♥", "♦", "♣"][c.suit]}
                        </button>
                      );
                    })}
                </div>
                <p className="teaching-note">
                  Notation uses s/h/d/c suits. Used cards are blocked across
                  groups. Click a selected card to remove it, or clear the group
                  first. A board may temporarily have one or two cards while
                  editing; calculation requires 0, 3, 4 or 5.
                </p>
              </div>
              <div className="equity-inputs">
                <label>
                  Monte Carlo samples
                  <select
                    aria-label="Monte Carlo samples"
                    value={samples}
                    onChange={(e) => setSamples(e.target.value)}
                  >
                    {[1000, 5000, 10000, 20000, 50000].map((n) => (
                      <option key={n} value={n}>
                        {n.toLocaleString("en-US")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Simulation seed
                  <input
                    aria-label="Simulation seed"
                    type="number"
                    min={0}
                    max={4294967295}
                    step={1}
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
              </div>
              <button className="primary" type="submit">
                Calculate equity
              </button>
            </fieldset>
          </form>
          {busy && (
            <div className="calculation-progress" role="status">
              <p>
                {progress?.method === "exact"
                  ? "Enumerating exact outcomes"
                  : "Sampling legal deals"}
                : {progress?.completed.toLocaleString("en-US")} /{" "}
                {progress?.total.toLocaleString("en-US")}
              </p>
              <progress
                aria-label="Equity calculation progress"
                max={progress?.total ?? 1}
                value={progress?.completed ?? 0}
              />
              <button type="button" onClick={cancel}>
                Cancel calculation
              </button>
            </div>
          )}
          <p role="status" className="calculation-status">
            {status}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
        <aside className="content-panel drill-sidebar">
          <h2>Equity is a share, not a strategy.</h2>
          <p>
            Each deal is taken to showdown with one equal pot. An outright win
            earns 1; a three-way tie earns ⅓ for each winner; a loss earns 0.
            Pot equity averages those shares.
          </p>
          <p>
            Automatic mode enumerates small, tractable outcome spaces exactly.
            Larger spaces use a seeded Monte Carlo estimate in a background
            worker. Cancelling discards an incomplete calculation.
          </p>
          <p>
            Unknown opponents are uniform over legal hands, jointly dealt
            without replacement after all known cards are excluded. They are not
            realistic calling ranges.
          </p>
          <p className="teaching-note">
            Weighted ranges are available for completed hands in the Review
            Studio. This explorer retains known or uniform-random opponents. No
            betting, folds, side pots, rake, implied odds or equity realization
            are modeled here. A favorable equity number alone does not establish
            a profitable call, raise, or bluff.
          </p>
          <h3>Compare a runout</h3>
          <p>
            Pin a completed result, change the turn or river, then calculate
            again. A new card can complete draws, change the winning hand, or
            remove cards from unknown opponents’ possibilities.
          </p>
          <p className="teaching-note">
            At most 50,000 trials and 120,000 player evaluations are allowed.
            With six players the simulation cap is 20,000 trials. Inputs and
            calculations are temporary; existing saved progress is unchanged.
          </p>
        </aside>
      </div>
      {result && (
        <section
          className="content-panel equity-result"
          aria-label="Equity results"
        >
          <div className="drill-topline">
            <div>
              <span className="eyebrow">
                {result.method === "exact"
                  ? "EXACT ENUMERATION"
                  : "MONTE CARLO ESTIMATE"}
              </span>
              <h2>
                {result.method === "exact"
                  ? "Every legal outcome counted."
                  : "An estimate, with visible uncertainty."}
              </h2>
            </div>
            <button
              disabled={busy || stale}
              className="subtle-button"
              onClick={() => setBaseline(result)}
            >
              Pin result for comparison
            </button>
          </div>
          {stale && (
            <p className="range-notice">
              Previous result — inputs changed. Calculate again to analyze the
              current cards.
            </p>
          )}
          <p>
            {result.samples.toLocaleString("en-US")}{" "}
            {result.method === "exact"
              ? "equally likely outcomes enumerated"
              : "samples drawn with replacement across trials"}{" "}
            · possible outcome space {result.possibleOutcomes} · seed{" "}
            {result.seed}. {result.input.opponents.length + 1} total players.
          </p>
          <ResultCards input={result.input} />
          <OutcomeBars result={result} />
          <div className="equity-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Win outright</th>
                  <th>Tie for best</th>
                  <th>Lose</th>
                  <th>Pot-share equity</th>
                </tr>
              </thead>
              <tbody>
                {result.players.map((p, i) => (
                  <tr key={i}>
                    <th scope="row">{i === 0 ? "Hero" : `Opponent ${i}`}</th>
                    <td>{pct(p.win)}</td>
                    <td>{pct(p.tie)}</td>
                    <td>{pct(p.loss)}</td>
                    <td>
                      <b>{pct(p.equity)}</b>
                      {result.method === "monte-carlo" && (
                        <small className="table-equity-interval">
                          95%: {interval(p.equityInterval)}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.method === "monte-carlo" ? (
            <div className="uncertainty-note">
              <h3>95% uncertainty intervals · Hero</h3>
              <p>
                Win: {interval(result.players[0].winInterval)} · Tie:{" "}
                {interval(result.players[0].tieInterval)} · Loss:{" "}
                {interval(result.players[0].lossInterval)} (Wilson intervals).
              </p>
              <p>
                Pot equity: <b>{interval(result.players[0].equityInterval)}</b>{" "}
                (conservative Hoeffding bound for a share between 0 and 1).
                These are individual intervals, not a joint guarantee. They
                measure sampling uncertainty under the model, not uncertainty
                about an opponent’s true range.
              </p>
              <p className="teaching-note">
                Same seed, cards, player count and sample count reproduce the
                same estimate. Zero observed losses does not imply losses are
                impossible. More samples reduce sampling error but cannot
                correct a wrong opponent model.
              </p>
            </div>
          ) : (
            <p className="teaching-note">
              Exact conditional on the supplied cards and uniform unknown-hand
              model. There is no sampling uncertainty; displayed percentages are
              rounded. This is not an EV or GTO calculation.
            </p>
          )}
          {baseline && (
            <div className="equity-comparison">
              <h3>Pinned comparison</h3>
              <ResultCards input={baseline.input} />
              <p>
                Pinned: {pct(baseline.players[0].equity)} (
                {baseline.method === "exact" ? "exact" : "estimated"}) → Current
                result: {pct(result.players[0].equity)} (
                {result.method === "exact" ? "exact" : "estimated"}).
              </p>
              <p>
                Change in hero pot equity:{" "}
                <b>
                  {(
                    (result.players[0].equity - baseline.players[0].equity) *
                    100
                  ).toFixed(2)}{" "}
                  percentage points
                </b>
                .{" "}
                {baseline.method !== "exact" || result.method !== "exact"
                  ? "This comparison includes Monte Carlo noise; small changes may be within the displayed uncertainty."
                  : "Both values enumerate their respective conditional outcome spaces."}
              </p>
              <p className="teaching-note">
                This is a scenario comparison, not proof of a causal strategic
                edge. Changing cards, players or known hands also changes the
                distribution being evaluated.
              </p>
              <button
                className="subtle-button"
                onClick={() => setBaseline(null)}
              >
                Clear comparison
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function ResultCards({ input }: { input: EquityInput }) {
  return (
    <div className="result-card-summary">
      <span>
        Hero: {text(input.hero)} · Board:{" "}
        {input.board.length ? text(input.board) : "preflop"}
      </span>
      <span>
        {input.opponents
          .map((h, i) => `Opponent ${i + 1}: ${h ? text(h) : "uniform random"}`)
          .join(" · ")}
      </span>
    </div>
  );
}
function OutcomeBars({ result }: { result: EquityResult }) {
  const p = result.players[0];
  return (
    <div className="outcome-bars">
      <div
        className="outcome-stack"
        aria-label={`Hero wins ${pct(p.win)}, ties ${pct(p.tie)}, loses ${pct(p.loss)}`}
      >
        <i className="outcome-win" style={{ width: `${p.win * 100}%` }} />
        <i className="outcome-tie" style={{ width: `${p.tie * 100}%` }} />
        <i className="outcome-loss" style={{ width: `${p.loss * 100}%` }} />
      </div>
      <div className="outcome-legend">
        <span>● Win {pct(p.win)}</span>
        <span>● Tie {pct(p.tie)}</span>
        <span>● Loss {pct(p.loss)}</span>
      </div>
      <div className="equity-share">
        <strong>{pct(p.equity)}</strong>
        <span>Hero’s expected share of one equal pot at showdown</span>
        <progress aria-label="Hero pot-share equity" max={1} value={p.equity} />
      </div>
    </div>
  );
}
function OutsTrainer() {
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState<number | null>(null),
    [showKnown, setShowKnown] = useState(false);
  const q = DRAW_EXERCISES[index],
    report = drawReport(q.hero, q.board),
    known = EQUITY_EXAMPLES.find((e) => e.id === "dirty-flush")!.input,
    certified = drawReport(known.hero, known.board, known.opponents);
  return (
    <div className="trainer-layout">
      <section className="content-panel">
        <span className="eyebrow">OUTS & DRAW TRAINER</span>
        <h2>Improvement is not the same as winning.</h2>
        <label>
          Draw exercise
          <select
            aria-label="Draw exercise"
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              setAnswer(null);
            }}
          >
            {DRAW_EXERCISES.map((e, i) => (
              <option key={e.id} value={i}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="postflop-board">
          <div>
            <span className="eyebrow">HERO</span>
            <div className="drill-cards">
              {q.hero.map((c, i) => (
                <Card key={i} card={c} />
              ))}
            </div>
          </div>
          <div>
            <span className="eyebrow">FLOP</span>
            <div className="drill-cards">
              {q.board.map((c, i) => (
                <Card key={i} card={c} />
              ))}
            </div>
          </div>
        </div>
        <p>
          How many distinct unseen next cards complete a flush or straight with
          these known cards? Count overlap only once. Do not count pairs or
          assume every completion wins.
        </p>
        <div className="quiz-options">
          {q.options.map((n) => (
            <button
              key={n}
              disabled={answer !== null}
              className={answer === n ? "chosen" : ""}
              onClick={() => setAnswer(n)}
            >
              {n} cards
            </button>
          ))}
        </div>
        {answer !== null && (
          <div
            className={`answer-feedback ${answer === q.answer ? "correct" : "reconsider"}`}
            role="status"
          >
            <h3>
              {answer === q.answer
                ? "✓ Correct pattern count"
                : "Count the distinct cards carefully"}
            </h3>
            <p>{q.why}</p>
            <p>
              Flush candidates: {report.flushCount}. Straight candidates:{" "}
              {report.straightCount}. Overlap: {report.overlap}. Distinct total:{" "}
              <b>{report.total}</b>. Straight draw: {report.straightKind}.
            </p>
            <p>
              All {report.uncertain.length} are uncertain as winning outs on
              this flop: an unknown opponent or the river can change who wins.
            </p>
            <div className="outs-card-list">
              {report.outs.map((o) => (
                <span key={cardId(o.card)}>
                  {text([o.card])}
                  {o.flush && o.straight ? " · both" : ""}
                </span>
              ))}
            </div>
            <h3>Rule of 2 and 4 · approximate</h3>
            <p>
              One card: {report.total} × 2 ≈ {report.total * 2}%. Two cards:{" "}
              {report.total} × 4 ≈ {Math.min(100, report.total * 4)}%.
            </p>
            <p>
              For this fixed set of {report.total} identified cards among{" "}
              {report.unseen} unseen cards, exact hit probability is{" "}
              {pct(fixedOutsProbability(report.total, report.unseen, 1))} on the
              next card and{" "}
              {pct(fixedOutsProbability(report.total, report.unseen, 2))} by the
              river if both cards are seen.
            </p>
            <p className="teaching-note">
              The exact figure concerns seeing at least one currently identified
              card, not winning the hand. It excludes other ways to improve and
              future changes in outs. The rule is a rough shortcut and gets less
              reliable with many outs; the two-card version assumes you will see
              both cards without another decision or cost.
            </p>
            <button
              className="primary"
              onClick={() => {
                setIndex((index + 1) % DRAW_EXERCISES.length);
                setAnswer(null);
              }}
            >
              Next draw exercise →
            </button>
          </div>
        )}
        <button
          className="subtle-button"
          onClick={() => setShowKnown(!showKnown)}
        >
          {showKnown ? "Hide" : "Explore"} clean versus uncertain outs
        </button>
        {showKnown && (
          <div className="clean-outs-demo">
            <h3>Known turn hand: verify the river</h3>
            <ResultCards input={known} />
            <p>
              {certified.total} spades complete the flush, but only{" "}
              <b>{certified.clean.length}</b> also win this fully specified
              showdown.{" "}
              {certified.uncertain.map((o) => text([o.card])).join(", ")}{" "}
              complete the flush but lose to a full house or quads.
            </p>
            <p>
              Conditionally clean river completions:{" "}
              {certified.clean.map((o) => text([o.card])).join(", ")}. This can
              be certified only because every opponent hand is specified and the
              next card is the river.
            </p>
            <p className="teaching-note">
              In actual play you usually do not know every opponent’s cards. Do
              not call all nominal draw cards clean, and do not add overlapping
              draw lists twice.
            </p>
          </div>
        )}
      </section>
      <aside className="content-panel drill-sidebar">
        <h2>Four ideas to keep separate.</h2>
        <p>
          <b>Flush draw:</b> four cards of one suit, with another card still to
          come. A backdoor draw needs two future cards.
        </p>
        <p>
          <b>Open-ended:</b> four consecutive ranks with two completing end
          ranks. A gutshot has one completing rank. Two inside gaps can form a
          double gutshot.
        </p>
        <p>
          <b>Combination draw:</b> several ways to improve, with overlapping
          physical cards counted once.
        </p>
        <p>
          <b>Clean versus uncertain:</b> a card that completes a pattern may
          simultaneously improve an opponent more. Never equate hit probability
          with showdown equity.
        </p>
        <p className="teaching-note">
          These exercises teach counting, not calls or bets. Price, ranges,
          future betting, position and equity realization still matter. Quiz
          feedback is session-only and does not alter prior training progress.
        </p>
      </aside>
    </div>
  );
}
function MultiwayLessons() {
  return (
    <section className="content-panel">
      <span className="eyebrow">MULTIWAY THINKING</span>
      <h2>Beat the field, not just one hand.</h2>
      <p>
        These authored examples are checked for card legality and mathematical
        consistency in tests. They are not externally expert-reviewed strategy
        recommendations. Load them from the Explorer’s teaching-example menu to
        calculate their actual outcomes.
      </p>
      {EQUITY_EXAMPLES.filter((e) => e.input.opponents.length >= 2).map((e) => (
        <article className="multiway-lesson" key={e.id}>
          <h3>{e.name}</h3>
          <ResultCards input={e.input} />
          <p>{e.lesson}</p>
        </article>
      ))}
      <p className="teaching-note">
        Players’ hands and outcomes are dependent because cards are removed from
        a shared deck. Do not multiply independent heads-up probabilities.
        Equity assumes all players see showdown with equal claims to one pot;
        actual decisions also depend on pot odds, future betting, fold equity,
        side pots and opponent ranges. None of those strategic values is
        inferred by this lab.
      </p>
    </section>
  );
}
