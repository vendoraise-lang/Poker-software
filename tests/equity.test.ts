import { describe, it, expect } from "vitest";
import {
  combinations,
  createEquityJob,
  fullDeck,
  outcomeSpace,
  runEquity,
  sampleWithoutReplacement,
  seededIntegers,
  showdownShares,
  validateEquity,
  wilson,
  type EquityInput,
} from "../lib/equity/engine";
import { baseInput, EQUITY_EXAMPLES } from "../lib/equity/examples";
import {
  DRAW_EXERCISES,
  drawReport,
  fixedOutsProbability,
} from "../lib/equity/draws";
import { parseCards, validateCards } from "../lib/postflop/texture";
const noWait = { yieldControl: () => Promise.resolve() };
function sync(input: EquityInput, batch = 500) {
  const job = createEquityJob(input);
  while (job.progress().completed < job.progress().total) job.step(batch);
  return job.result();
}
const turn = () => baseInput("As Qs", "Js 7s 2d 9c", ["9h 9d"]);
describe("equity input and legal card sampling", () => {
  it("contains all 52 unique cards and draws every card once without mutating the deck", () => {
    const deck = fullDeck(),
      original = structuredClone(deck),
      draw = sampleWithoutReplacement(deck, 52, seededIntegers(42));
    expect(draw).toHaveLength(52);
    expect(new Set(draw.map((c) => `${c.rank}:${c.suit}`)).size).toBe(52);
    expect(deck).toEqual(original);
    expect(draw).toEqual(
      sampleWithoutReplacement(deck, 52, seededIntegers(42)),
    );
  });
  it("draws only from the supplied available pool, supports empty/full draws and seeds 0/max", () => {
    const pool = fullDeck().slice(12);
    for (const seed of [0, 1, 2026, 4294967295]) {
      const rng = seededIntegers(seed);
      expect(sampleWithoutReplacement(pool, 0, rng)).toEqual([]);
      const d = sampleWithoutReplacement(pool, pool.length, rng);
      expect(new Set(d.map((c) => `${c.rank}:${c.suit}`)).size).toBe(
        pool.length,
      );
      expect(d.every((c) => pool.includes(c))).toBe(true);
    }
    expect(() =>
      sampleWithoutReplacement(pool, 41, seededIntegers(1)),
    ).toThrow();
    expect(() => seededIntegers(1)(0)).toThrow();
  });
  it("does not systematically prefer low cards or deck prefixes across fixed seeds", () => {
    const counts = Array(52).fill(0);
    for (let seed = 0; seed < 5200; seed++) {
      const [c] = sampleWithoutReplacement(fullDeck(), 1, seededIntegers(seed));
      counts[c.suit * 13 + c.rank - 2]++;
    }
    expect(Math.min(...counts)).toBeGreaterThan(60);
    expect(Math.max(...counts)).toBeLessThan(145);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])(
    "validates total-player boundaries with %i opponents",
    (count) => {
      const input = baseInput("As Ah", "", Array(count).fill(null));
      if (count >= 1 && count <= 5)
        expect(validateEquity(input).opponents).toHaveLength(count);
      else expect(() => validateEquity(input)).toThrow();
    },
  );
  it.each([0, 1, 2, 3, 4, 5, 6])(
    "accepts only legal board lengths, testing %i",
    (n) => {
      const s = baseInput("As Ah", "", [null]);
      s.board = parseCards("2s 3s 4s 5s 6s 7s").slice(0, n);
      if ([0, 3, 4, 5].includes(n))
        expect(validateEquity(s).board).toHaveLength(n);
      else expect(() => validateEquity(s)).toThrow();
    },
  );
  it("rejects duplicate ranks/suits represented as the same physical card, not merely equal ranks", () => {
    const s = turn();
    const bad = [
      { ...s, hero: [s.hero[0], s.hero[0]] },
      { ...s, opponents: [s.hero] },
      { ...s, board: [s.hero[0], ...s.board.slice(1)] },
      { ...s, hero: [{ rank: 15, suit: 0 }, s.hero[1]] },
      { ...s, hero: [{ rank: 2, suit: 4 }, s.hero[1]] },
      { ...s, opponents: [[s.hero[0]]] },
      { ...s, opponents: [undefined] },
    ];
    for (const value of bad)
      expect(() => validateEquity(value as EquityInput)).toThrow();
    expect(validateEquity(baseInput("As Ah", "", ["Ks Kh"]))).toBeTruthy();
  });
  it("rejects unsafe seeds, sample counts and method names; caps six-player work", () => {
    const s = turn();
    for (const seed of [-1, 1.5, NaN, Infinity, 4294967296])
      expect(() => validateEquity({ ...s, seed })).toThrow();
    for (const samples of [0, -1, NaN, Infinity, 50001, 1.1])
      expect(() => validateEquity({ ...s, samples })).toThrow();
    expect(() => validateEquity({ ...s, mode: "fake" as never })).toThrow();
    expect(() =>
      createEquityJob({
        ...baseInput("As Ah", "", Array(5).fill(null)),
        samples: 50000,
      }),
    ).toThrow(/20,000/);
  });
  it("copies input cards rather than mutating the caller’s state", () => {
    const s = turn(),
      copy = structuredClone(s);
    sync(s);
    expect(s).toEqual(copy);
    const job = createEquityJob(s);
    s.hero[0].rank = 2;
    expect(job.input.hero[0].rank).toBe(14);
  });
});
describe("exact outcome space and fractional pot shares", () => {
  it("counts unordered boards and labeled unknown hands using exact integers", () => {
    expect(combinations(45, 2)).toBe(990n);
    expect(combinations(48, 5)).toBe(1712304n);
    expect(combinations(4, 0)).toBe(1n);
    expect(combinations(4, 5)).toBe(0n);
    expect(outcomeSpace(turn())).toBe(44n);
    expect(outcomeSpace(baseInput("As Ah", "Qs 7d 2c", ["Ks Kh"]))).toBe(990n);
    expect(outcomeSpace(baseInput("As Ah", "", [null]))).toBe(2097572400n);
    expect(
      outcomeSpace(baseInput("As Ah", "", Array(5).fill(null))),
    ).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  });
  it.each([2, 3, 4, 5, 6])(
    "awards a %i-way tie as 1 / winners, not tie probability as equity",
    (players) => {
      const hands = ["2d 3d", "4d 5d", "6d 7d", "8d 9d", "Tc Jc", "Qd Kd"]
          .slice(0, players)
          .map(parseCards),
        board = parseCards("As Ks Qs Js Ts");
      const shares = showdownShares(hands, board);
      shares.forEach((share) => expect(share).toBe(1 / players));
      const r = sync({
        hero: hands[0],
        board,
        opponents: hands.slice(1),
        seed: 1,
        samples: 1,
      });
      expect(r.method).toBe("exact");
      expect(r.samples).toBe(1);
      r.players.forEach((p) => {
        expect(p.tie).toBe(1);
        expect(p.win).toBe(0);
        expect(p.loss).toBe(0);
        expect(p.equity).toBe(1 / players);
      });
    },
  );
  it("handles tied opponents beating hero without counting that as a hero tie", () => {
    const s = baseInput("2c 3d", "9c Th Js Qc Kd", ["Ah 4d", "As 5c"]),
      r = sync(s);
    expect(r.players[0]).toMatchObject({ win: 0, tie: 0, loss: 1, equity: 0 });
    expect(r.players[1].equity).toBe(0.5);
    expect(r.players[2].equity).toBe(0.5);
  });
  it("returns a known exact river win and its complementary loss", () => {
    const r = sync(baseInput("As Ah", "Ac Ad 2s 3s 4s", ["Ks Kh"]));
    expect(r.players[0].equity).toBe(1);
    expect(r.players[1].loss).toBe(1);
    expect(r.confidence).toBeNull();
    expect(r.players[0].equityInterval).toEqual({ low: 1, high: 1 });
  });
  it("enumerates the known 7/44 clean flush completion case exactly", () => {
    const r = sync(turn());
    expect(r.method).toBe("exact");
    expect(r.samples).toBe(44);
    expect(r.players[0].win).toBe(7 / 44);
    expect(r.players[0].tie).toBe(0);
    expect(r.players[0].equity).toBe(7 / 44);
    expect(r.players[1].win).toBe(37 / 44);
  });
  it("counts all 990 flop runouts with an unbeatable made hand", () => {
    const r = sync(baseInput("As Ah", "Ac Ad 2c", ["Ks Kh"]));
    expect(r.samples).toBe(990);
    expect(r.players[0].equity).toBe(1);
  });
  it("enumerates unknown river hands and blocks all known cards", () => {
    const r = sync(baseInput("2d 3c", "As Ks Qs Js Ts", [null]));
    expect(r.samples).toBe(990);
    expect(r.players[0].tie).toBe(1);
    expect(r.players[0].equity).toBe(0.5);
    const mixed = sync(baseInput("2d 3c", "As Ks Qs Js Ts", ["4d 5c", null]));
    expect(mixed.samples).toBe(903);
    mixed.players.forEach((p) => expect(p.equity).toBeCloseTo(1 / 3, 12));
  });
  it("chooses exact only inside both budgets and rejects forced exhaustive preflop work", () => {
    const small = createEquityJob(baseInput("As Ah", "2s 3d 4c 5h", [null]));
    expect(small.progress()).toMatchObject({ method: "exact", total: 45540 });
    const large = baseInput("As Ah", "", ["Ks Kh"]);
    expect(createEquityJob(large).progress().method).toBe("monte-carlo");
    expect(() => createEquityJob({ ...large, mode: "exact" })).toThrow(
      /capped/,
    );
  });
  it("checks all educational examples for valid, disjoint cards and conserved total equity", () => {
    for (const e of EQUITY_EXAMPLES) {
      const s = validateEquity({ ...e.input, samples: 37 });
      validateCards([
        ...s.hero,
        ...s.board,
        ...s.opponents.flatMap((h) => h ?? []),
      ]);
      const r = sync({ ...s, mode: "monte-carlo" });
      expect(r.players.reduce((sum, p) => sum + p.equity, 0)).toBeCloseTo(
        1,
        12,
      );
      r.players.forEach((p) =>
        expect(p.win + p.tie + p.loss).toBeCloseTo(1, 12),
      );
    }
  });
});
describe("seeded estimates, uncertainty and cancellation", () => {
  it("is reproducible across seeds, batch sizes and asynchronous scheduling", async () => {
    const s = { ...turn(), mode: "monte-carlo" as const, samples: 307 };
    const a = sync(s, 1),
      b = sync(s, 137);
    expect(a).toEqual(b);
    expect(await runEquity(s, { ...noWait, batch: 43 })).toEqual(a);
    expect(sync({ ...s, seed: 2027 }).players).not.toEqual(a.players);
    expect(a.method).toBe("monte-carlo");
    expect(a.confidence).toBe(0.95);
  });
  it.each([0, 42, 2026])(
    "tracks the known exact turn probability with seed %i",
    (seed) => {
      const exact = sync(turn()).players[0].equity,
        r = sync({ ...turn(), seed, samples: 3000, mode: "monte-carlo" });
      expect(Math.abs(r.players[0].equity - exact)).toBeLessThan(0.035);
      expect(r.players[0].equityInterval.low).toBeLessThanOrEqual(exact);
      expect(r.players[0].equityInterval.high).toBeGreaterThanOrEqual(exact);
    },
  );
  it("preserves uncertainty at extreme observed counts and narrows with sample size", () => {
    const s = baseInput("As Ah", "Ac Ad 2s 3s 4s", ["Ks Kh"]);
    const one = sync({ ...s, samples: 1, mode: "monte-carlo" }),
      many = sync({ ...s, samples: 100, mode: "monte-carlo" });
    expect(one.players[0].equityInterval).toEqual({ low: 0, high: 1 });
    expect(many.players[0].equityInterval.low).toBeGreaterThan(
      one.players[0].equityInterval.low,
    );
    expect(many.players[0].lossInterval.high).toBeGreaterThan(0);
    expect(wilson(0, 100).high).toBeGreaterThan(0);
    expect(wilson(100, 100).low).toBeLessThan(1);
  });
  it("reports monotonic progress with the actual target count", async () => {
    const events: number[] = [];
    await runEquity(
      { ...turn(), samples: 37, mode: "monte-carlo" },
      { ...noWait, batch: 10, onProgress: (p) => events.push(p.completed) },
    );
    expect(events).toEqual([0, 10, 20, 30, 37]);
  });
  it("cancels before work and during batched exact enumeration without returning partial equity", async () => {
    const before = new AbortController();
    before.abort();
    await expect(
      runEquity(turn(), { signal: before.signal, ...noWait }),
    ).rejects.toMatchObject({ name: "AbortError" });
    const active = new AbortController();
    let max = 0;
    await expect(
      runEquity(turn(), {
        ...noWait,
        signal: active.signal,
        batch: 5,
        onProgress: (p) => {
          max = p.completed;
          if (p.completed >= 5) active.abort();
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(max).toBe(5);
    const job = createEquityJob(turn());
    job.step(5);
    expect(() => job.result()).toThrow(/prefix/);
    expect(() => job.step(0)).toThrow();
  });
});
describe("outs, overlap and approximation boundaries", () => {
  it.each(DRAW_EXERCISES.map((e) => [e.id, e] as const))(
    "counts the %s fixture exactly",
    (_, e) => {
      const r = drawReport(e.hero, e.board);
      expect(r.total).toBe(e.answer);
      expect(r.total).toBe(r.flushCount + r.straightCount - r.overlap);
      expect(
        new Set(r.outs.map((o) => `${o.card.rank}:${o.card.suit}`)).size,
      ).toBe(r.total);
      expect(r.clean).toHaveLength(0);
      expect(r.canCertify).toBe(false);
    },
  );
  it("distinguishes open-ended draws, single gutshots and double gutshots", () => {
    expect(
      drawReport(DRAW_EXERCISES[1].hero, DRAW_EXERCISES[1].board).straightKind,
    ).toBe("Open-ended");
    expect(
      drawReport(DRAW_EXERCISES[2].hero, DRAW_EXERCISES[2].board).straightKind,
    ).toBe("Gutshot / one-rank completion");
    expect(
      drawReport(DRAW_EXERCISES[4].hero, DRAW_EXERCISES[4].board).straightKind,
    ).toBe("Double gutshot");
  });
  it("finds 9 nominal spades but only 7 clean winners against the known turn set", () => {
    const s = turn(),
      r = drawReport(s.hero, s.board, s.opponents);
    expect(r.total).toBe(9);
    expect(r.canCertify).toBe(true);
    expect(r.clean).toHaveLength(7);
    expect(r.uncertain.map((o) => o.card.rank).sort((a, b) => a - b)).toEqual([
      2, 9,
    ]);
    expect(r.uncertain.every((o) => o.status === "loses")).toBe(true);
    expect(drawReport(s.hero, s.board, [null]).clean).toHaveLength(0);
  });
  it("does not call made flushes or backdoor possibilities immediate flush outs", () => {
    expect(
      drawReport(parseCards("As Qs"), parseCards("Ks 9s 3s")).flushCount,
    ).toBe(0);
    expect(
      drawReport(parseCards("As Qs"), parseCards("Kd 7s 2c")).flushCount,
    ).toBe(0);
    expect(() =>
      drawReport(parseCards("As Qs"), parseCards("Kd 7s 2c 9h Jd")),
    ).toThrow();
  });
  it("uses hypergeometric probability for the identified fixed set, not 4x as an exact result", () => {
    expect(fixedOutsProbability(9, 47, 1)).toBe(9 / 47);
    expect(fixedOutsProbability(9, 47, 2)).toBeCloseTo(
      1 - (38 * 37) / (47 * 46),
      14,
    );
    expect(fixedOutsProbability(0, 47, 2)).toBe(0);
    expect(fixedOutsProbability(47, 47, 2)).toBe(1);
    expect(() => fixedOutsProbability(48, 47, 2)).toThrow();
  });
});

describe("nontrivial exact unknown-hand enumeration", () => {
  it("counts the single legal straight-flush hand that beats four aces", () => {
    const result = sync(baseInput("As Ah", "Ac Ad 2s 3s 4s", [null]));
    expect(result.method).toBe("exact");
    expect(result.samples).toBe(990);
    expect(result.players[0].win).toBe(989 / 990);
    expect(result.players[0].loss).toBe(1 / 990);
    expect(result.players[0].tie).toBe(0);
    expect(result.players[1].win).toBe(1 / 990);
  });
});
