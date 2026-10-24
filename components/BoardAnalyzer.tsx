"use client";
import { useState } from "react";
import Card from "./Card";
import { parseCards, analyzeTexture } from "@/lib/postflop/texture";
import { TextureSummary } from "./PostflopLab";
export default function BoardAnalyzer({
  initialBoard = "Ks 9s 3d",
  initialHole = "As Qs",
}: {
  initialBoard?: string;
  initialHole?: string;
}) {
  const [board, setBoard] = useState(initialBoard),
    [hole, setHole] = useState(initialHole),
    [result, setResult] = useState(() => ({
      board: parseCards(initialBoard),
      hole: parseCards(initialHole),
    })),
    [error, setError] = useState("");
  return (
    <section className="content-panel">
      <span className="eyebrow">DETERMINISTIC CARD ANALYSIS</span>
      <h2>Read the board, not a guess.</h2>
      <p>
        Use 3–5 board cards and optionally two hole cards. Notation: As = ace of
        spades, Td = ten of diamonds. Suits: s, h, d, c.
      </p>
      <form
        className="texture-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const b = parseCards(board),
              h = parseCards(hole);
            analyzeTexture(b, h);
            setResult({ board: b, hole: h });
            setError("");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label>
          Board cards
          <input
            aria-label="Board cards"
            value={board}
            onChange={(e) => setBoard(e.target.value)}
          />
        </label>
        <label>
          Hole cards (optional)
          <input
            aria-label="Hole cards (optional)"
            value={hole}
            onChange={(e) => setHole(e.target.value)}
          />
        </label>
        <button className="primary" type="submit">
          Analyze cards
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error} The last valid analysis remains below.
        </p>
      )}
      <div className="postflop-board">
        <div>
          <span className="eyebrow">BOARD</span>
          <div className="drill-cards">
            {result.board.map((c, i) => (
              <Card key={i} card={c} />
            ))}
          </div>
        </div>
        {result.hole.length > 0 && (
          <div>
            <span className="eyebrow">YOUR CARDS</span>
            <div className="drill-cards">
              {result.hole.map((c, i) => (
                <Card key={i} card={c} />
              ))}
            </div>
          </div>
        )}
      </div>
      <TextureSummary board={result.board} hole={result.hole} />
    </section>
  );
}
