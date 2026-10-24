"use client";
import { useState } from "react";
import {
  HAND_CLASSES,
  RANKS,
  matrixClass,
  OPENING_RANGES,
} from "@/lib/training/ranges";
import {
  expandRange,
  validateRange,
  type WeightedRange,
} from "@/lib/equity/ranges";
import type { Card } from "@/lib/poker";
export default function RangeBuilder({
  value,
  blocked,
  onChange,
}: {
  value: WeightedRange | null;
  blocked: Card[];
  onChange: (range: WeightedRange | null) => void;
}) {
  const [draft, setDraft] = useState<Record<string, number>>(
      value?.weights ?? {},
    ),
    [brush, setBrush] = useState(100),
    [selected, setSelected] = useState("AA"),
    [error, setError] = useState("");
  const support = expandRange(
      Object.values(draft).some(Boolean)
        ? { version: 1, weights: draft }
        : null,
      blocked,
    ),
    selectedCombos = support.filter((c) => c.hand === selected),
    active = Object.values(draft).some(Boolean);
  return (
    <section className="range-builder">
      <h3>Opponent range assumptions</h3>
      <p>
        Each class assigns the same relative integer weight (0–100) to every
        physical combination in that class. These are your hypotheses, not the
        opponent’s revealed cards or a solver range.
      </p>
      <div className="training-controls">
        <label>
          Weight brush
          <input
            aria-label="Range weight brush"
            type="range"
            min={0}
            max={100}
            step={1}
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
          />
          <span>{brush} / 100 per combo</span>
        </label>
        <button
          type="button"
          className="subtle-button"
          onClick={() =>
            setDraft(Object.fromEntries(HAND_CLASSES.map((h) => [h, 100])))
          }
        >
          Fill all hands
        </button>
        <button
          type="button"
          className="subtle-button"
          onClick={() => setDraft({})}
        >
          Clear grid
        </button>
        <button
          type="button"
          className="subtle-button"
          onClick={() =>
            setDraft(
              Object.fromEntries(OPENING_RANGES.BTN.map((h) => [h, 100])),
            )
          }
        >
          Example BTN opening sample
        </button>
      </div>
      <p className="teaching-note">
        The opening sample is only a starting hypothesis. It is not
        automatically a postflop continuing range or a GTO solution.
      </p>
      <p className="teaching-note">
        On narrow screens, scroll the grid horizontally. With a keyboard, focus
        one hand and use the arrow keys to move.
      </p>
      <div className="matrix-scroll">
        <table className="hand-matrix" aria-label="Weighted 169-hand range">
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
                  const hand = matrixClass(i, j),
                    weight = draft[hand] ?? 0;
                  return (
                    <td key={c}>
                      <button
                        type="button"
                        aria-label={`${hand} weight ${weight}`}
                        aria-pressed={weight > 0}
                        id={`weighted-cell-${i}-${j}`}
                        tabIndex={selected === hand ? 0 : -1}
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
                            setSelected(matrixClass(...next));
                            document
                              .getElementById(
                                `weighted-cell-${next[0]}-${next[1]}`,
                              )
                              ?.focus();
                          }
                        }}
                        className={`${i === j ? "pair" : i < j ? "suited" : "offsuit"} ${weight ? "included" : ""} ${selected === hand ? "selected-hand" : ""}`}
                        onClick={() => {
                          setSelected(hand);
                          setDraft((d) => ({
                            ...d,
                            [hand]: d[hand] === brush ? 0 : brush,
                          }));
                        }}
                      >
                        {hand}
                        <small>{weight}</small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p aria-live="polite">
        {active
          ? `${support.length} legal positive-weight physical combos after visible blockers.`
          : "Draft is empty. Add a positive weight before applying."}{" "}
        {selected}: {active ? selectedCombos.length : 0} legal combos;{" "}
        {active
          ? (
              selectedCombos.reduce((n, c) => n + c.probability, 0) * 100
            ).toFixed(2)
          : "0"}
        % of this seat’s normalized mass.
      </p>
      <p className="teaching-note">
        This per-seat normalization uses known hero/board cards only. The equity
        engine additionally conditions the entire joint range assignment on no
        inter-opponent card collisions. It never keeps one hand while
        incorrectly renormalizing the next seat.
      </p>
      <div className="backup-controls">
        <button
          type="button"
          className="primary"
          onClick={() => {
            try {
              const r = validateRange({ version: 1, weights: draft });
              if (!expandRange(r, blocked).length)
                throw Error(
                  "All selected combinations are blocked at this point.",
                );
              onChange(r);
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Apply weighted range
        </button>
        <button
          type="button"
          className="subtle-button"
          onClick={() => {
            onChange(null);
            setError("");
          }}
        >
          Use uniform random hands
        </button>
      </div>
      <p>
        Current model: {value ? "weighted range" : "uniform random legal hand"}.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
