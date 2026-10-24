"use client";
import { useEffect, useRef, useState } from "react";
import { decisionEquity, type DecisionPoint } from "@/lib/review/model";
import type { WeightedRange } from "@/lib/equity/ranges";
import type { EquityResult, EquityProgress } from "@/lib/equity/engine";
import type { WorkerResponse } from "@/workers/equity.worker";
const percent = (n: number) => (n * 100).toFixed(2) + "%";
export default function ReviewEquity({
  point,
  earlier,
  ranges,
}: {
  point: DecisionPoint;
  earlier: DecisionPoint[];
  ranges: (WeightedRange | null)[];
}) {
  const [current, setCurrent] = useState<EquityResult | null>(null),
    [previous, setPrevious] = useState<EquityResult | null>(null),
    [signature, setSignature] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<EquityProgress | null>(null),
    [error, setError] = useState(""),
    [compare, setCompare] = useState("none");
  const worker = useRef<Worker | null>(null),
    request = useRef(0);
  useEffect(() => () => worker.current?.terminate(), []);
  const rawSignature = JSON.stringify({
    context: point.context,
    ranges,
    compare,
  });
  function cancel() {
    request.current++;
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setProgress(null);
    setError("Calculation cancelled; no incomplete result is shown.");
  }
  function calculate() {
    const id = ++request.current;
    worker.current?.terminate();
    setError("");
    setCurrent(null);
    setPrevious(null);
    setBusy(true);
    const prior = earlier.find((p) => p.commandIndex === Number(compare));
    const targets = prior ? [prior, point] : [point];
    let phase = 0;
    function start() {
      try {
        const target = targets[phase],
          input = decisionEquity(target, ranges, 3000),
          w = new Worker(
            new URL("../workers/equity.worker.ts", import.meta.url),
            { type: "module" },
          );
        worker.current = w;
        w.onmessage = ({ data }: { data: WorkerResponse }) => {
          if (request.current !== id || data.id !== id) return;
          if (data.type === "progress") setProgress(data.progress);
          else {
            w.terminate();
            worker.current = null;
            if (data.type === "error") {
              setBusy(false);
              setError(data.message);
              return;
            }
            if (phase < targets.length - 1) {
              setPrevious(data.result);
              phase++;
              start();
            } else {
              setCurrent(data.result);
              setSignature(rawSignature);
              setBusy(false);
            }
          }
        };
        w.onmessageerror = () => {
          if (request.current !== id) return;
          request.current++;
          w.terminate();
          worker.current = null;
          setBusy(false);
          setProgress(null);
          setCurrent(null);
          setPrevious(null);
          setError(
            "The browser could not read the background result. No result was accepted. Retry the calculation.",
          );
        };
        w.onerror = () => {
          if (request.current !== id) return;
          w.terminate();
          worker.current = null;
          setBusy(false);
          setError(
            "The background calculation failed. Simplify ranges or retry.",
          );
        };
        w.postMessage({ id, input });
      } catch (e) {
        request.current++;
        worker.current?.terminate();
        worker.current = null;
        setProgress(null);
        setCurrent(null);
        setPrevious(null);
        setBusy(false);
        setError((e as Error).message);
      }
    }
    start();
  }
  return (
    <section className="review-equity">
      <h3>Equity using only this point’s information</h3>
      <p>
        All actual opponent cards, folded cards and future community cards are
        excluded. Remaining opponents use your assigned ranges or uniform random
        legal hands. Seed 2026 is independent of the recorded deal seed.
      </p>
      <label>
        Earlier known street comparison
        <select
          aria-label="Review equity comparison"
          disabled={busy}
          value={compare}
          onChange={(e) => setCompare(e.target.value)}
        >
          <option value="none">This decision only</option>
          {earlier.map((p) => (
            <option key={p.commandIndex} value={p.commandIndex}>
              {p.street} · your earlier decision {p.commandIndex + 1}
            </option>
          ))}
        </select>
      </label>
      <div className="backup-controls">
        <button className="primary" disabled={busy} onClick={calculate}>
          Calculate decision equity
        </button>
        {busy && (
          <button className="subtle-button" onClick={cancel}>
            Cancel review calculation
          </button>
        )}
      </div>
      {busy && (
        <p role="status">
          {progress?.method === "exact" ? "Enumerating" : "Sampling"}{" "}
          {progress?.completed ?? 0} / {progress?.total ?? "…"} in a background
          worker.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {current && (
        <div
          className="answer-feedback correct"
          aria-label="Decision equity result"
        >
          <h3>
            {current.method === "exact"
              ? "Exact weighted/enumerated equity"
              : "Seeded Monte Carlo estimate"}
          </h3>
          {signature !== rawSignature && (
            <p className="range-notice">
              Range or comparison assumptions changed. Recalculate before using
              this result.
            </p>
          )}
          <p>
            Hero pot-share equity: <b>{percent(current.players[0].equity)}</b>.
            Win {percent(current.players[0].win)} · tie{" "}
            {percent(current.players[0].tie)} · loss{" "}
            {percent(current.players[0].loss)}.
          </p>
          <p>
            {current.samples.toLocaleString("en-US")}{" "}
            {current.method === "exact"
              ? "supported allocations enumerated, weighted by range mass"
              : "accepted Monte Carlo trials"}
            .{" "}
            {current.method === "monte-carlo"
              ? `95% conservative equity interval: ${percent(current.players[0].equityInterval.low)}–${percent(current.players[0].equityInterval.high)}.`
              : "Exact conditional on the supplied range model; no sampling error."}
          </p>
          {previous && (
            <p>
              Earlier{" "}
              {previous.input.board.length === 0
                ? "preflop"
                : previous.input.board.length === 3
                  ? "flop"
                  : "turn"}
              : {percent(previous.players[0].equity)} ({previous.method}).
              Current: {percent(current.players[0].equity)} ({current.method}).
              The earlier calculation uses only its earlier public information;
              changes in active players and sampling noise can also explain a
              difference.
            </p>
          )}
        </div>
      )}
      <p className="teaching-note">
        Equity assumes equal claims to one pot and everyone reaches showdown. It
        does not model side pots, future bets, folding, rake or realization. Do
        not equate it mechanically with the factual call price or label the
        recorded action optimal. Range weights are user assumptions, not
        inferred facts.
      </p>
    </section>
  );
}
