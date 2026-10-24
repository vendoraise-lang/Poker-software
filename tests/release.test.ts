import { describe, it, expect } from "vitest";
import { QUESTIONS } from "../lib/academy/content";
import { ODDS_QUIZZES, gradeOdds } from "../lib/training/odds";
import { DRAW_EXERCISES } from "../lib/equity/draws";
import { EQUITY_EXAMPLES } from "../lib/equity/examples";
import { createEquityJob } from "../lib/equity/engine";
import { evaluate, type Card } from "../lib/poker";
import { POSTFLOP } from "../lib/postflop/scenarios";
import {
  emptyTraining,
  readTraining,
  validateTraining,
} from "../lib/training/progress";

// Test-only reference calculations: no production evaluator, deck, odds,
// ranges, draw classifier or showdown helper is used to construct expectations.
const deck: Card[] = Array.from({ length: 52 }, (_, i) => ({
  rank: 2 + Math.floor(i / 4),
  suit: i % 4,
}));
const id = (c: Card) => c.rank * 4 + c.suit;
function choose<T>(values: T[], n: number): T[][] {
  if (n === 0) return [[]];
  return values.flatMap((v, i) =>
    choose(values.slice(i + 1), n - 1).map((rest) => [v, ...rest]),
  );
}
function straight(cs: Card[]) {
  const rs = new Set(cs.map((c) => c.rank));
  for (let high = 14; high >= 5; high--) {
    const needed =
      high === 5
        ? [14, 2, 3, 4, 5]
        : Array.from({ length: 5 }, (_, i) => high - i);
    if (needed.every((r) => rs.has(r))) return high;
  }
  return 0;
}
function flush(cs: Card[]) {
  return [0, 1, 2, 3].some((s) => cs.filter((c) => c.suit === s).length >= 5);
}
function encoded(v: number[]) {
  return [...v, ...Array(6 - v.length).fill(0)].reduce((a, n) => a * 15 + n, 0);
}
function five(cs: Card[]) {
  const rs = cs.map((c) => c.rank).sort((a, b) => b - a),
    counts = new Map<number, number>();
  for (const r of rs) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]),
    pairs = groups.filter((g) => g[1] === 2).map((g) => g[0]),
    single = groups.filter((g) => g[1] === 1).map((g) => g[0]);
  const f = flush(cs),
    s = straight(cs);
  if (f && s) return encoded([8, s]);
  if (groups[0][1] === 4) return encoded([7, groups[0][0], single[0]]);
  if (groups[0][1] === 3 && pairs.length)
    return encoded([6, groups[0][0], pairs[0]]);
  if (f) return encoded([5, ...rs]);
  if (s) return encoded([4, s]);
  if (groups[0][1] === 3) return encoded([3, groups[0][0], ...single]);
  if (pairs.length === 2) return encoded([2, ...pairs, single[0]]);
  if (pairs.length === 1) return encoded([1, pairs[0], ...single]);
  return encoded([0, ...rs]);
}
const best = (cs: Card[]) => Math.max(...choose(cs, 5).map(five));
function completionCards(
  hero: Card[],
  board: Card[],
  opponents: Card[][] = [],
) {
  const current = [...hero, ...board],
    used = new Set([...current, ...opponents.flat()].map(id));
  return deck.filter(
    (c) =>
      !used.has(id(c)) &&
      ((!flush(current) && flush([...current, c])) ||
        (!straight(current) && straight([...current, c]))),
  );
}
function exactReference(hero: Card[], board: Card[], opponents: Card[][]) {
  const used = new Set([...hero, ...board, ...opponents.flat()].map(id));
  const boards = choose(
    deck.filter((c) => !used.has(id(c))),
    5 - board.length,
  );
  let win = 0,
    tie = 0,
    loss = 0,
    share = 0;
  for (const runout of boards) {
    const values = [hero, ...opponents].map((h) =>
        best([...h, ...board, ...runout]),
      ),
      top = Math.max(...values),
      winners = values.filter((v) => v === top).length;
    if (values[0] !== top) loss++;
    else if (winners === 1) win++;
    else tie++;
    share += values[0] === top ? 1 / winners : 0;
  }
  return {
    samples: boards.length,
    win: win / boards.length,
    tie: tie / boards.length,
    loss: loss / boards.length,
    equity: share / boards.length,
  };
}
const acceptedLabel = (q: (typeof QUESTIONS)[number]) =>
  q.options.find((o) => o.id === q.accepted[0])!.label;
const categoryNames = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
describe("release independent mathematics and card audit", () => {
  it("independently verifies every Academy pot-price answer and every older odds quiz", () => {
    for (const q of QUESTIONS.filter((q) => q.concept === "price")) {
      const amounts = q.prompt.match(/\d+/g)!.map(Number),
        [pot, bet] = amounts;
      expect(acceptedLabel(q)).toBe(
        ((100 * bet) / (pot + 2 * bet)).toFixed(2) + "%",
      );
    }
    for (const q of ODDS_QUIZZES) {
      const required = q.bet / (q.potBeforeBet + 2 * q.bet);
      for (const option of q.options)
        expect(gradeOdds(q, option).correct).toBe(
          Math.abs(option / 100 - required) < 0.002,
        );
    }
  });
  it("independently verifies every Academy split-share answer", () => {
    const shares = [1 / 3, 1 / 2, 1 / 4, 1 / 5, 1 / 6, 0, (1 + 1 / 2) / 4];
    QUESTIONS.filter((q) => q.concept === "share").forEach((q, i) =>
      expect(acceptedLabel(q)).toBe((100 * shares[i]).toFixed(2) + "%"),
    );
  });
  it("counts every Academy physical range and blocker question by enumerating two-card subsets", () => {
    const ranges = [
      ["KK"],
      ["AA"],
      ["AKs"],
      ["AQo"],
      [],
      ["QQ", "AJs"],
      ["TT", "KQo"],
    ];
    const classify = (h: Card[]) => {
      const [a, b] = [...h].sort((a, b) => b.rank - a.rank),
        names = "23456789TJQKA";
      return (
        names[a.rank - 2] +
        names[b.rank - 2] +
        (a.rank === b.rank ? "" : a.suit === b.suit ? "s" : "o")
      );
    };
    QUESTIONS.filter((q) => q.concept === "combinations").forEach((q, i) => {
      const n = choose(deck, 2).filter(
        (h) => i === 4 || ranges[i].includes(classify(h)),
      ).length;
      expect(acceptedLabel(q)).toBe(`${n} combos`);
    });
    for (const q of QUESTIONS.filter((q) => q.concept === "blockers")) {
      const hand = q.prompt.match(/many (\w+) combinations/)![1],
        blocked = new Set(q.hero.map(id));
      const n = choose(
        deck.filter((c) => !blocked.has(id(c))),
        2,
      ).filter((h) => classify(h) === hand).length;
      expect(acceptedLabel(q)).toBe(`${n} combos`);
    }
  });
  it("independently enumerates all Academy and older draw completions, including dirty river cards", () => {
    for (const q of QUESTIONS.filter((q) => q.concept === "draw-counting")) {
      let candidates = completionCards(q.hero, q.board, q.opponents);
      if (q.id === "a6-draw-counting-6")
        candidates = candidates.filter((c) => {
          const b = [...q.board, c],
            hero = best([...q.hero, ...b]);
          return q.opponents.every((o) => hero > best([...o, ...b]));
        });
      expect(acceptedLabel(q)).toBe(`${candidates.length} cards`);
    }
    for (const q of DRAW_EXERCISES)
      expect(completionCards(q.hero, q.board).length).toBe(q.answer);
  });
  it("cross-checks all displayed Academy made hands and all postflop fixture hand categories with a test-only five-card reference", () => {
    for (const q of QUESTIONS.filter(
      (q) => q.concept === "rankings" || q.concept === "texture",
    )) {
      const ref = best([...q.hero, ...q.board]),
        category = Math.floor(ref / 15 ** 5);
      if (q.concept === "rankings")
        expect(acceptedLabel(q)).toBe(categoryNames[category]);
      else
        expect(acceptedLabel(q).toLowerCase()).toContain(
          "hero " + categoryNames[category].toLowerCase(),
        );
      expect(encoded(evaluate([...q.hero, ...q.board]))).toBe(ref);
    }
    for (const s of POSTFLOP)
      expect(encoded(evaluate([...s.hole, ...s.board]))).toBe(
        best([...s.hole, ...s.board]),
      );
  });
  it.each(
    EQUITY_EXAMPLES.filter((e) => e.input.opponents.every((o) => o !== null)),
  )(
    "exhaustively verifies known-hand equity example $id against independent terminal hand comparisons",
    (e) => {
      const input = e.input,
        reference = exactReference(
          input.hero,
          input.board,
          input.opponents as Card[][],
        ),
        job = createEquityJob({ ...input, mode: "exact" });
      while (job.progress().completed < job.progress().total) job.step(500);
      const result = job.result();
      expect(result.method).toBe("exact");
      expect(result.samples).toBe(reference.samples);
      for (const metric of ["win", "tie", "loss", "equity"] as const)
        expect(result.players[0][metric]).toBeCloseTo(reference[metric], 12);
    },
  );
});
describe("release storage regression", () => {
  it.each([
    "not-json",
    "null",
    "{}",
    '{"version":99}',
    JSON.stringify({
      ...emptyTraining(),
      attempts: [{ id: 1, target: "missing" }],
    }),
  ])(
    "marks corrupt training unavailable instead of permitting an empty replacement: %s",
    (raw) => {
      let writes = 0;
      const storage = {
        getItem: () => raw,
        setItem: () => {
          writes++;
        },
      };
      expect(readTraining(storage)).toEqual({
        progress: emptyTraining(),
        available: false,
      });
      expect(writes).toBe(0);
    },
  );
  it("keeps missing data distinct from corrupt data and shares strict validation with backups", () => {
    expect(readTraining({ getItem: () => null, setItem: () => {} })).toEqual({
      progress: emptyTraining(),
      available: true,
    });
    expect(validateTraining(emptyTraining())).toEqual(emptyTraining());
    expect(() =>
      validateTraining({ version: 1, attempts: [], sessions: [], daily: {} }),
    ).toThrow();
  });
});
