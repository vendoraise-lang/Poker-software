"use client";
import { useMemo, useState } from "react";
import Card from "./Card";
import { replayFrames, type Journal } from "@/lib/hand-session";
export default function HandReplay({ completed }: { completed: Journal[] }) {
  const [selected, setSelected] = useState(-1),
    [step, setStep] = useState(0);
  const index =
    selected < 0
      ? completed.length - 1
      : Math.min(selected, completed.length - 1);
  const frames = useMemo(
    () => (index >= 0 ? replayFrames(completed[index]) : []),
    [completed, index],
  );
  const f = frames[Math.min(step, frames.length - 1)];
  return (
    <section className="content-panel replay-panel">
      <div className="drill-topline">
        <div>
          <span className="eyebrow">HAND REPLAY</span>
          <h2>Review the information you had.</h2>
        </div>
        {completed.length > 0 && (
          <label>
            Completed hand
            <select
              aria-label="Replay hand"
              value={index}
              onChange={(e) => {
                setSelected(Number(e.target.value));
                setStep(0);
              }}
            >
              {completed.map((j, i) => (
                <option key={i} value={i}>
                  Hand #{j.origin.hand} · seed {j.origin.seed}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!f ? (
        <p>
          Finish a simulated hand to unlock replay. Up to 20 completed hands
          recorded from this phase are retained.
        </p>
      ) : (
        <>
          <p>
            Step {Math.min(step, frames.length - 1) + 1} / {frames.length} ·{" "}
            <b>{f.street}</b> · {f.label}
          </p>
          <div className="drill-cards replay-board" aria-label="Replay board">
            {f.board.map((c, i) => (
              <Card key={i} card={c} />
            ))}
          </div>
          <div className="replay-seats">
            {f.players.map((p, i) => (
              <div key={i} className={f.actor === i ? "replay-actor" : ""}>
                <b>
                  {p.name}
                  {p.folded ? " · folded" : ""}
                </b>
                <div className="drill-cards">
                  {p.cards ? (
                    p.cards.map((c, j) => <Card key={j} card={c} small />)
                  ) : (
                    <>
                      <Card small hidden />
                      <Card small hidden />
                    </>
                  )}
                </div>
                <small>
                  {p.chips} chips · street bet {p.bet}
                </small>
              </div>
            ))}
          </div>
          <p>
            Pot: {f.pot} play chips.{" "}
            {f.actor >= 0
              ? `${f.players[f.actor].name} to act. Legal options: ${f.actions.join(", ")}.`
              : "No decision at this frame."}
          </p>
          <div className="replay-controls">
            <button disabled={step <= 0} onClick={() => setStep((s) => s - 1)}>
              Previous step
            </button>
            <label>
              Replay step
              <input
                aria-label="Replay step"
                type="range"
                min={0}
                max={frames.length - 1}
                value={Math.min(step, frames.length - 1)}
                onChange={(e) => setStep(Number(e.target.value))}
              />
            </label>
            <button
              disabled={step >= frames.length - 1}
              onClick={() => setStep((s) => s + 1)}
            >
              Next step
            </button>
          </div>
          <div className="street-jumps">
            {(["Preflop", "Flop", "Turn", "River", "Showdown"] as const).map(
              (street) => (
                <button
                  key={street}
                  disabled={!frames.some((f) => f.street === street)}
                  onClick={() =>
                    setStep(frames.findIndex((f) => f.street === street))
                  }
                >
                  {street}
                </button>
              ),
            )}
          </div>
          <p className="teaching-note">
            Opponent cards stay concealed until a contested showdown reveals
            eligible hands. Folded hands remain hidden. Streets not reached
            cannot be replayed. Earlier phases did not record reconstructable
            histories.
          </p>
        </>
      )}
    </section>
  );
}
