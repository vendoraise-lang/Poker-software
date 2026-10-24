import { describe, it, expect } from "vitest";
import {
  expandRange,
  validateRange,
  uniformRange,
  scanJoint,
  jointSampler,
  type WeightedRange,
} from "../lib/equity/ranges";
import {
  createEquityJob,
  runEquity,
  seededIntegers,
  validateEquity,
} from "../lib/equity/engine";
import { baseInput } from "../lib/equity/examples";
import { parseCards } from "../lib/postflop/texture";
import { legal, newHand } from "../lib/poker";
import { freshSession, tableAction } from "../lib/hand-session";
import {
  buildReview,
  decisionEquity,
  reviewJournals,
  teachingFindings,
} from "../lib/review/model";
import {
  emptyReview,
  observeReview,
  reviewSummary,
  practiceEvidence,
  validateReview,
  REVIEW_KEY,
} from "../lib/review/progress";
import { emptyTraining, recordAttempt } from "../lib/training/progress";
import { emptyPost, recordPost } from "../lib/postflop/progress";
import { applyBackup, collectBackup, validateBackup } from "../lib/backup";
const range = (weights: Record<string, number>): WeightedRange => ({
  version: 1,
  weights,
});
const finish = () => {
  let game = newHand(2026),
    session = freshSession(game);
  while (game.street !== "Showdown") {
    const n = tableAction(session, game, legal(game).call ? "call" : "check");
    game = n.game;
    session = n.session;
  }
  return { game, session };
};
function result(input: Parameters<typeof createEquityJob>[0], batch = 500) {
  const job = createEquityJob(input);
  while (job.progress().completed < job.progress().total) job.step(batch);
  return job.result();
}
const jointCase = () => ({
  ...baseInput("Qh Qd", "Ah 2c 3d 4h 9s", [null, null]),
  ranges: [range({ AA: 1, KK: 1 }), range({ AA: 1, KK: 3 })],
});
describe("weighted physical combinations and normalization", () => {
  it("expands all 169 classes to 1326 physical combos and normalizes positive mass", () => {
    const combos = expandRange(uniformRange(), []);
    expect(combos).toHaveLength(1326);
    expect(new Set(combos.map((c) => JSON.stringify(c.cards))).size).toBe(1326);
    expect(combos.reduce((n, c) => n + c.probability, 0)).toBeCloseTo(1, 12);
    expect(combos.filter((c) => c.hand === "AA")).toHaveLength(6);
    expect(combos.filter((c) => c.hand === "AKs")).toHaveLength(4);
    expect(combos.filter((c) => c.hand === "AKo")).toHaveLength(12);
  });
  it("blocks exact cards and weights combos rather than classes equally", () => {
    const r = range({ AA: 100, AKs: 50 }),
      combos = expandRange(r, parseCards("As Ad"));
    expect(combos.filter((c) => c.hand === "AA")).toHaveLength(1);
    expect(combos.filter((c) => c.hand === "AKs")).toHaveLength(2);
    expect(
      combos
        .filter((c) => c.hand === "AA")
        .reduce((s, c) => s + c.probability, 0),
    ).toBe(0.5);
    expect(
      combos.some((c) =>
        c.cards.some((card) => card.rank === 14 && [0, 2].includes(card.suit)),
      ),
    ).toBe(false);
  });
  it("renormalizes after blockers and rejects empty or malformed range definitions", () => {
    expect(expandRange(range({ AA: 100 }), parseCards("As Ad Ah"))).toEqual([]);
    for (const v of [
      { version: 2, weights: { AA: 100 } },
      range({}),
      range({ AA: 0 }),
      range({ AA: -1 }),
      range({ AA: 101 }),
      range({ AA: 0.5 }),
      range({ XX: 50 }),
      range({ AA: NaN }),
    ])
      expect(() => validateRange(v)).toThrow();
    expect(validateRange(range({ AA: 10, KK: 0 }))).toEqual(range({ AA: 10 }));
  });
  it("removes all known cards before unknown ranges and rejects ambiguous known-plus-range seats", () => {
    const s = {
      ...baseInput("Qh Qd", "Ah 2c 3d 4h 9s", [null, "As Ad"]),
      ranges: [range({ AA: 100 }), null],
    };
    expect(() => createEquityJob(s)).toThrow(/no legal/);
    expect(() =>
      validateEquity({ ...s, ranges: [null, range({ AA: 100 })] }),
    ).toThrow(/known hand/);
    expect(() => validateEquity({ ...s, ranges: [null] })).toThrow();
  });
  it("validates sparse/undefined range arrays instead of silently treating them as uniform", () => {
    expect(() =>
      validateEquity({ ...jointCase(), ranges: Array(2) }),
    ).toThrow();
  });
});
describe("joint card-removal conditioning", () => {
  it("enumerates exact asymmetric multiway mass: 42 assignments, equities 0, 0.7, 0.3", () => {
    const r = result(jointCase());
    expect(r.method).toBe("exact");
    expect(r.samples).toBe(42);
    expect(r.players[0].equity).toBe(0);
    expect(r.players[1].equity).toBe(0.7);
    expect(r.players[2].equity).toBe(0.3);
  });
  it("samples the same joint distribution instead of the biased sequential 0.5 result", () => {
    const r = result({
      ...jointCase(),
      samples: 10000,
      seed: 2026,
      mode: "monte-carlo",
    });
    expect(r.method).toBe("monte-carlo");
    expect(r.players[1].equity).toBeCloseTo(0.7, 1);
    expect(Math.abs(r.players[1].equity - 0.7)).toBeLessThan(0.025);
    expect(r.players.reduce((s, p) => s + p.equity, 0)).toBeCloseTo(1, 12);
  });
  it("reproduces weighted simulations across chunk sizes and seeds affect samples", () => {
    const s = { ...jointCase(), samples: 300, mode: "monte-carlo" as const };
    expect(result(s, 1)).toEqual(result(s, 117));
    expect(result({ ...s, seed: 123 }).players).not.toEqual(result(s).players);
  });
  it("computes a nonuniform heads-up river exactly and is invariant to common weight scaling", () => {
    const s = {
      ...baseInput("As Ad", "Ah 2c 3d 4h 9s", [null]),
      ranges: [range({ KK: 1, "55": 3 })],
    };
    const r = result(s);
    expect(r.samples).toBe(12);
    expect(r.players[0].equity).toBe(0.25);
    expect(
      result({ ...s, ranges: [range({ KK: 25, "55": 75 })] }).players,
    ).toEqual(r.players);
  });
  it("includes every legal future board with unrenormalized raw range mass", () => {
    const s = {
      ...baseInput("As Ad", "Ah 2c 3d 4h", [null]),
      ranges: [range({ KK: 1, "55": 3 })],
    };
    const r = result(s);
    expect(r.method).toBe("exact");
    expect(r.samples).toBe(12 * 44);
    expect(r.players.reduce((n, p) => n + p.equity, 0)).toBeCloseTo(1, 12);
    const mc = result({ ...s, mode: "monte-carlo", samples: 5000 });
    expect(Math.abs(mc.players[0].equity - r.players[0].equity)).toBeLessThan(
      0.03,
    );
  });
  it("rejects jointly impossible overlapping ranges even though each has individual support", () => {
    const s = {
      ...baseInput("Qh Qd", "Ah 2c 3d 4h 9s", [null, null]),
      ranges: [range({ AA: 100 }), range({ AA: 100 })],
    };
    expect(
      expandRange(s.ranges[0], parseCards("Qh Qd Ah 2c 3d 4h 9s")),
    ).toHaveLength(3);
    expect(() => createEquityJob(s)).toThrow(/jointly compatible/);
  });
  it("never emits colliding joint draws and exposes a bounded failure instead of biased fallback", () => {
    const blocked = parseCards("Qh Qd Ah 2c 3d 4h 9s"),
      candidates = jointCase().ranges.map((r) => expandRange(r, blocked)),
      sampler = jointSampler(candidates, seededIntegers(8));
    for (let i = 0; i < 200; i++) {
      const a = sampler.draw();
      expect(
        new Set(a.hands.flat().map((c) => `${c.rank}:${c.suit}`)).size,
      ).toBe(4);
    }
    const aa = expandRange(range({ AA: 100 }), blocked);
    expect(scanJoint([aa, aa], 100).assignments).toHaveLength(0);
    expect(() => jointSampler([aa, aa], seededIntegers(1), 5).draw()).toThrow(
      /budget/,
    );
  });
  it("supports weighted cancellation and rejects incomplete exact results", async () => {
    const controller = new AbortController();
    await expect(
      runEquity(jointCase(), {
        signal: controller.signal,
        batch: 5,
        onProgress: (p) => {
          if (p.completed >= 5) controller.abort();
        },
        yieldControl: () => Promise.resolve(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    const job = createEquityJob(jointCase());
    job.step(1);
    expect(() => job.result()).toThrow(/Incomplete/);
  });
});
describe("review reconstruction and hidden information boundaries", () => {
  it("highlights every hero action and reconstructs only public facts before it", () => {
    const { session } = finish(),
      r = buildReview(session.active);
    expect(r.decisions).toHaveLength(4);
    for (const p of r.decisions) {
      expect(r.frames[p.frameIndex].actor).toBe(0);
      expect(
        r.frames[p.frameIndex].players.slice(1).every((o) => o.cards === null),
      ).toBe(true);
      expect(p).not.toHaveProperty("seed");
      expect(p).not.toHaveProperty("deck");
      expect(p.opponents.every((o) => !Object.hasOwn(o, "cards"))).toBe(true);
      expect(p.history.some((t) => t.includes("receives"))).toBe(false);
      expect(p.actions).toContain(p.chosen.action);
      const input = decisionEquity(p, [null, null, null]);
      expect(input.opponents.every((h) => h === null)).toBe(true);
      expect(input.board).toEqual(p.board);
      expect(input.hero).toEqual(p.hero);
      expect(input.seed).toBe(2026);
    }
  });
  it("does not include later community cards in earlier decision inputs", () => {
    const { session } = finish(),
      r = buildReview(session.active);
    expect(r.decisions.map((p) => p.board.length)).toEqual([0, 3, 4, 5]);
    expect(decisionEquity(r.decisions[0], [null, null, null]).board).toEqual(
      [],
    );
    expect(
      decisionEquity(r.decisions[1], [null, null, null]).board,
    ).toHaveLength(3);
  });
  it("never includes folded opponents’ true hole cards as dead cards or known hands", () => {
    let g = newHand(),
      s = freshSession(g);
    const first = tableAction(s, g, "fold");
    g = first.game;
    s = first.session;
    while (g.street !== "Showdown") {
      const n = tableAction(s, g, legal(g).call ? "call" : "check");
      g = n.game;
      s = n.session;
    }
    const p = buildReview(s.active).decisions[0];
    expect(p.opponents.filter((o) => o.folded)).toHaveLength(1);
    const input = decisionEquity(p, [null, null, null]);
    expect(input.opponents).toHaveLength(2);
    expect(Object.keys(input).sort()).toEqual([
      "board",
      "hero",
      "mode",
      "opponents",
      "ranges",
      "samples",
      "seed",
    ]);
  });
  it("handles missing and incomplete old hand histories without fabricated playbacks", () => {
    expect(reviewJournals({ hands: 9 }).hands).toEqual([]);
    const { session } = finish(),
      r = reviewJournals({
        table: {
          version: 1,
          completed: [session.active, freshSession().active, { broken: true }],
        },
      });
    expect(r.hands).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(() => buildReview(freshSession().active)).toThrow(/completed/);
  });
  it("calculates factual pot odds with contribution eligibility and documents heuristic judgments", () => {
    const { session } = finish(),
      p = buildReview(session.active).decisions[0];
    expect(p.requiredShare).toBe(p.call / p.eligibleAfterCall);
    expect(p.eligibleAfterCall).toBe(p.pot + p.call);
    const aa = {
      ...p,
      hero: parseCards("As Ad"),
      chosen: { action: "fold" as const },
    };
    expect(teachingFindings(aa).find((f) => f.rule === "OPEN-1")).toMatchObject(
      { kind: "heuristic", topic: "opening" },
    );
    const river = {
      ...p,
      street: "River" as const,
      hero: parseCards("8s 7d"),
      board: parseCards("Ac Kh 9d 3s 2c"),
      call: 100,
      eligibleAfterCall: 200,
      requiredShare: 0.5,
      chosen: { action: "call" as const },
    };
    expect(
      teachingFindings(river).some(
        (f) => f.rule === "RIVER-1" && f.kind === "fact",
      ),
    ).toBe(true);
    expect(
      teachingFindings(river).some(
        (f) => f.rule === "CALL-1" && f.kind === "heuristic",
      ),
    ).toBe(true);
  });
});
describe("local review integrity and compatible backups", () => {
  const context = () =>
    buildReview(finish().session.active).decisions[0].context;
  it("does not treat repeat review as independent concept evidence", () => {
    let p = emptyReview();
    for (let i = 0; i < 10; i++)
      p = observeReview(
        p,
        context(),
        "draws",
        i === 0 ? "practice" : "understood",
        "2026-10-24",
      );
    expect(p.observations).toHaveLength(1);
    expect(reviewSummary(p).draws).toMatchObject({
      distinct: 1,
      initialUnderstood: 0,
      needsPractice: 0,
      earlyRate: null,
    });
  });
  it("requires four distinct contexts for a comparison and uses their first observations", () => {
    const points = buildReview(finish().session.active).decisions;
    let p = emptyReview();
    points.forEach((point, i) => {
      p = observeReview(
        p,
        point.context,
        "draws",
        i < 2 ? "practice" : "understood",
        "2026-10-24",
      );
    });
    expect(reviewSummary(p).draws).toMatchObject({
      distinct: 4,
      earlyRate: 0,
      recentRate: 1,
    });
  });
  it("rejects malformed observations, dates, unknown topics, duplicate contexts and invalid ranges", () => {
    const p = observeReview(
      emptyReview(),
      context(),
      "draws",
      "practice",
      "2026-10-24",
    );
    for (const v of [
      { ...p, version: 2 },
      { ...p, observations: [...p.observations, ...p.observations] },
      { ...p, observations: [{ ...p.observations[0], topic: "fake" }] },
      { ...p, observations: [{ ...p.observations[0], day: "2026-02-30" }] },
      { ...p, ranges: [range({ AA: -1 }), null, null] },
    ])
      expect(() => validateReview(v)).toThrow();
    expect(validateReview(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("exports v4 when review data exists, and old backups preserve that newer key", () => {
    const data = new Map<string, string>([
        [REVIEW_KEY, JSON.stringify(emptyReview())],
      ]),
      storage = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          data.set(k, v);
        },
        removeItem: (k: string) => {
          data.delete(k);
        },
      };
    const backup = collectBackup(storage);
    expect(backup.version).toBe(4);
    expect(validateBackup(JSON.stringify(backup)).review).toEqual(
      emptyReview(),
    );
    for (const version of [2, 3]) {
      const legacy = {
        ...backup,
        version,
        review: undefined,
        ...(version === 2 ? { postflop: undefined } : {}),
      };
      data.set(REVIEW_KEY, "preserve me");
      applyBackup(storage, validateBackup(JSON.stringify(legacy)), true);
      expect(data.get(REVIEW_KEY)).toBe("preserve me");
    }
    const invalid = {
      ...backup,
      review: { ...emptyReview(), ranges: [range({ XX: 100 }), null, null] },
    };
    expect(() => validateBackup(JSON.stringify(invalid))).toThrow();
  });
  it("requires explicit confirmation before replacing review data", () => {
    let writes = 0;
    const storage = {
        getItem: () => null,
        setItem: () => {
          writes++;
        },
        removeItem: () => {
          writes++;
        },
      },
      backup = validateBackup(
        JSON.stringify({
          ...collectBackup({ getItem: () => null }),
          version: 4,
          review: emptyReview(),
        }),
      );
    expect(() => applyBackup(storage, backup, false)).toThrow(/confirmation/);
    expect(writes).toBe(0);
  });
});

describe("additional compatibility and learning evidence", () => {
  it("a full equal-weight range reproduces the original uniform exact model", () => {
    const s = baseInput("As Ah", "Ac Ad 2s 3s 4s", [null]);
    expect(result({ ...s, ranges: [uniformRange()] }).players).toEqual(
      result(s).players,
    );
  });
});

it("learning evidence collapses repeated preflop and postflop fixtures", () => {
  let pre = emptyTraining();
  pre = recordAttempt(pre, {
    kind: "decision",
    target: "open-utg-aa",
    choice: "Fold",
    source: "practice",
  });
  for (let i = 0; i < 10; i++)
    pre = recordAttempt(pre, {
      kind: "decision",
      target: "open-utg-aa",
      choice: "Raise",
      source: "practice",
    });
  let post = emptyPost();
  for (let i = 0; i < 10; i++)
    post = recordPost(post, "f-draw-straight", "call", 100);
  const evidence = practiceEvidence(pre, post);
  expect(evidence.opening).toEqual({ seen: 1, correct: 0 });
  expect(evidence.draws).toEqual({ seen: 1, correct: 1 });
});

it("identical public decisions with different recorded choices count as the same context", () => {
  const callContext = buildReview(finish().session.active).decisions[0].context;
  let game = newHand(2026),
    session = freshSession(game);
  while (game.street !== "Showdown") {
    const n = tableAction(
      session,
      game,
      game.actor === 0 ? "fold" : legal(game).call ? "call" : "check",
    );
    game = n.game;
    session = n.session;
  }
  const foldContext = buildReview(session.active).decisions[0].context;
  expect(foldContext).toBe(callContext);
  const p = observeReview(
    observeReview(
      emptyReview(),
      callContext,
      "opening",
      "practice",
      "2026-10-24",
    ),
    foldContext,
    "opening",
    "understood",
    "2026-10-25",
  );
  expect(p.observations).toHaveLength(1);
});

it("weighted six-player sampling respects shared-card removal and six-way pot shares", () => {
  const s = {
    ...baseInput("2d 3c", "As Ks Qs Js Ts", [null, null, null, null, null]),
    ranges: Array.from({ length: 5 }, () => uniformRange()),
    mode: "monte-carlo" as const,
    samples: 37,
  };
  const r = result(s);
  expect(r.players).toHaveLength(6);
  r.players.forEach((p) => {
    expect(p.tie).toBe(1);
    expect(p.equity).toBeCloseTo(1 / 6, 12);
  });
});
