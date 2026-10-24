import { describe, it, expect } from "vitest";
import {
  combinations,
  exampleCards,
  handClass,
  HAND_CLASSES,
  inOpeningRange,
  matrixClass,
  OPENING_RANGES,
  POSITIONS,
  rangeCombinations,
} from "../lib/training/ranges";
import {
  gradeDecision,
  legalChoices,
  SCENARIOS,
  scenarioById,
  scenarioCards,
} from "../lib/training/fixtures";
import { gradeOdds, ODDS_QUIZZES, potOdds } from "../lib/training/odds";
import {
  accuracy,
  answerDaily,
  attemptCorrect,
  beginDaily,
  dailyPlan,
  emptyTraining,
  finishDaily,
  mistakesBy,
  parseTraining,
  readTraining,
  recordAttempt,
  recommendedTopic,
  saveTraining,
  startDaily,
  topicStats,
  TRAINING_KEY,
  unlockedLevel,
  type TrainingProgress,
} from "../lib/training/progress";
describe("starting-hand mapping", () => {
  it("covers 13 pairs, 78 suited and 78 offsuit classes exactly once", () => {
    expect(HAND_CLASSES).toHaveLength(169);
    expect(new Set(HAND_CLASSES).size).toBe(169);
    expect(HAND_CLASSES.filter((h) => h.length === 2)).toHaveLength(13);
    expect(HAND_CLASSES.filter((h) => h.endsWith("s"))).toHaveLength(78);
    expect(HAND_CLASSES.filter((h) => h.endsWith("o"))).toHaveLength(78);
    expect(HAND_CLASSES.reduce((n, h) => n + combinations(h), 0)).toBe(1326);
  });
  it("maps above/below diagonal to suited/offsuit and roundtrips every class", () => {
    expect(matrixClass(0, 1)).toBe("AKs");
    expect(matrixClass(1, 0)).toBe("AKo");
    expect(matrixClass(12, 12)).toBe("22");
    for (const h of HAND_CLASSES) {
      expect(handClass(exampleCards(h))).toBe(h);
      expect(handClass(exampleCards(h).reverse())).toBe(h);
    }
  });
  it("rejects malformed cards and coordinates", () => {
    expect(() =>
      handClass([
        { rank: 14, suit: 0 },
        { rank: 14, suit: 0 },
      ]),
    ).toThrow();
    expect(() =>
      handClass([
        { rank: 1, suit: 0 },
        { rank: 14, suit: 0 },
      ]),
    ).toThrow();
    expect(() => handClass([])).toThrow();
    expect(() => matrixClass(13, 0)).toThrow();
    expect(() => matrixClass(0.5, 2)).toThrow();
    expect(() => exampleCards("KAo")).toThrow();
  });
  it("uses valid unique classes, broadens late positions, and has no unopened BB chart", () => {
    for (const position of POSITIONS) {
      const range = OPENING_RANGES[position];
      expect(new Set(range).size).toBe(range.length);
      expect(range.every((h) => HAND_CLASSES.includes(h))).toBe(true);
      expect(rangeCombinations(position)).toBe(
        range.reduce((n, h) => n + combinations(h), 0),
      );
    }
    for (const [early, late] of [
      ["UTG", "HJ"],
      ["HJ", "CO"],
      ["CO", "BTN"],
    ] as const) {
      expect(OPENING_RANGES[early].every((h) => inOpeningRange(late, h))).toBe(
        true,
      );
      expect(OPENING_RANGES[late].length).toBeGreaterThan(
        OPENING_RANGES[early].length,
      );
    }
    expect(OPENING_RANGES.BB).toEqual([]);
    expect(inOpeningRange("UTG", "A5s")).toBe(false);
    expect(inOpeningRange("BTN", "A5s")).toBe(true);
  });
});
describe("documented scenario fixtures and strategy scoring", () => {
  it("has 15 unique fixtures with five per difficulty and realistic ordered actions", () => {
    expect(SCENARIOS).toHaveLength(15);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(15);
    for (const level of [1, 2, 3])
      expect(SCENARIOS.filter((s) => s.level === level)).toHaveLength(5);
    for (const s of SCENARIOS) {
      expect(handClass(scenarioCards(s))).toBe(s.hand);
      expect(legalChoices(s)).toEqual(["Fold", "Call", "Raise"]);
      expect(s.accepted).toContain(s.preferred);
      expect(s.raiseToBB).toBeLessThanOrEqual(s.stackBB);
      let bet = 1,
        raise = 1;
      for (const a of s.prior) {
        if (a.action === "Raise") {
          expect(a.toBB).toBeGreaterThanOrEqual(bet + raise);
          raise = a.toBB! - bet;
          bet = a.toBB!;
        }
      }
      expect(s.currentBetBB).toBe(bet);
      expect(s.raiseToBB === s.stackBB || s.raiseToBB >= bet + raise).toBe(
        true,
      );
      const folded = new Set<string>();
      let actor = 0;
      for (const action of s.prior) {
        expect(action.position).toBe(POSITIONS[actor]);
        if (action.action === "Fold") folded.add(action.position);
        do {
          actor = (actor + 1) % 6;
        } while (folded.has(POSITIONS[actor]));
      }
      expect(POSITIONS[actor]).toBe(s.position);
    }
  });
  it("opening fixtures agree with their labeled sample charts and limping remains legal", () => {
    for (const s of SCENARIOS.filter((s) => s.topic === "opening")) {
      expect(s.preferred).toBe(
        inOpeningRange(s.position, s.hand) ? "Raise" : "Fold",
      );
      expect(legalChoices(s)).toContain("Call");
    }
  });
  it("accepts sensible alternatives without calling every legal action correct", () => {
    const s = scenarioById("defend-bb-kqs");
    expect(gradeDecision(s, "Call").correct).toBe(true);
    expect(gradeDecision(s, "Raise").correct).toBe(true);
    expect(gradeDecision(s, "Fold").correct).toBe(false);
    expect(() => gradeDecision(s, "Check" as never)).toThrow();
    expect(() => scenarioById("missing")).toThrow();
  });
  it("gives an explanation for every choice and consistent pure grades", () => {
    for (const s of SCENARIOS)
      for (const choice of legalChoices(s)) {
        const copy = structuredClone(s);
        expect(gradeDecision(s, choice).explanation.length).toBeGreaterThan(40);
        expect(gradeDecision(s, choice).correct).toBe(
          s.accepted.includes(choice),
        );
        expect(s).toEqual(copy);
      }
  });
});
describe("pot odds math", () => {
  it.each([
    [100, 50, 0.25],
    [100, 100, 1 / 3],
    [120, 40, 0.2],
    [100, 150, 0.375],
    [200, 50, 1 / 6],
  ])("uses the final pot including the call (%i/%i)", (pot, bet, required) => {
    const result = potOdds(pot, bet);
    expect(result.potNow).toBe(pot + bet);
    expect(result.finalPot).toBe(pot + 2 * bet);
    expect(result.required).toBeCloseTo(required, 12);
  });
  it("handles decimal chip inputs without claiming exact equity", () =>
    expect(potOdds(1.5, 0.5).required).toBe(0.2));
  it.each([
    [0, 10],
    [-1, 10],
    [100, 0],
    [Infinity, 10],
    [10, NaN],
  ])("rejects invalid inputs %s %s", (pot, bet) =>
    expect(() => potOdds(pot, bet)).toThrow(),
  );
  it("has exactly one accepted rounded answer in each quiz", () => {
    for (const q of ODDS_QUIZZES)
      expect(q.options.filter((a) => gradeOdds(q, a).correct)).toHaveLength(1);
    expect(() => gradeOdds(ODDS_QUIZZES[0], 99)).toThrow();
  });
});
function add(
  p: TrainingProgress,
  target: string,
  choice: string,
  kind: "decision" | "odds" = "decision",
) {
  return recordAttempt(p, { kind, target, choice, source: "practice" });
}
describe("accuracy, categories and progression", () => {
  it("records immutably and aggregates actual choices by position, strength, action and topic", () => {
    const initial = emptyTraining();
    let p = add(initial, "open-utg-j4o", "Call");
    p = add(p, "open-utg-aa", "Raise");
    p = add(p, "defend-bb-kqs", "Raise");
    p = add(p, "odds-half", "50", "odds");
    expect(initial.attempts).toEqual([]);
    expect(accuracy(p.attempts)).toEqual({ total: 4, correct: 2 });
    expect(topicStats(p).opening).toEqual({ total: 2, correct: 1 });
    expect(topicStats(p).defending).toEqual({ total: 1, correct: 1 });
    expect(topicStats(p)["pot-odds"]).toEqual({ total: 1, correct: 0 });
    expect(mistakesBy(p, "position")).toEqual({ UTG: 1 });
    expect(mistakesBy(p, "strength")).toEqual({ Weak: 1 });
    expect(mistakesBy(p, "action")).toEqual({ Call: 1 });
    expect(recommendedTopic(p)).toBe("pot-odds");
  });
  it("suggests progression after five attempts per foundation level, including learning from errors", () => {
    let p = emptyTraining();
    expect(unlockedLevel(p)).toBe(1);
    for (let i = 0; i < 5; i++) p = add(p, "open-utg-aa", "Fold");
    expect(unlockedLevel(p)).toBe(2);
    for (let i = 0; i < 5; i++) p = add(p, "defend-bb-kqs", "Call");
    expect(unlockedLevel(p)).toBe(3);
    expect(new Set(p.attempts.map((a) => a.id)).size).toBe(10);
  });
  it("rejects unknown fixtures, invalid choices and fake quiz options", () => {
    expect(() => add(emptyTraining(), "missing", "Fold")).toThrow();
    expect(() => add(emptyTraining(), "open-utg-aa", "Check")).toThrow();
    expect(() => add(emptyTraining(), "odds-half", "999", "odds")).toThrow();
  });
  it("recommends foundations with no history or all correct history", () => {
    expect(recommendedTopic(emptyTraining())).toBe("opening");
    expect(
      recommendedTopic(add(emptyTraining(), "defend-bb-kqs", "Call")),
    ).toBe("opening");
  });
});
describe("daily training and persistence", () => {
  it("generates stable, unique plans with 2 foundations, 2 defence and 1 stretch question", () => {
    const plan = dailyPlan("2026-10-24");
    expect(plan).toEqual(dailyPlan("2026-10-24"));
    expect(plan).toEqual([
      "open-utg-aa",
      "open-utg-j4o",
      "defend-bb-kqs",
      "defend-btn-72o",
      "short-bb-ako",
    ]);
    expect(new Set(plan).size).toBe(5);
    expect(plan.map((id) => scenarioById(id).level)).toEqual([1, 1, 2, 2, 3]);
    expect(dailyPlan("2026-10-25")).not.toEqual(plan);
    expect(() => dailyPlan("2026-02-30")).toThrow();
  });
  it("resumes, requires five answers, completes once, and never penalizes missed days", () => {
    let p = startDaily(emptyTraining(), "2026-10-24");
    expect(() => answerDaily(p, "Fold")).toThrow();
    expect(() => finishDaily(p)).toThrow();
    p = beginDaily(p);
    for (let i = 0; i < 5; i++) {
      p = parseTraining(JSON.stringify(p));
      p = answerDaily(p, scenarioById(p.daily!.plan[i]).preferred);
    }
    expect(() => answerDaily(p, "Fold")).toThrow();
    p = finishDaily(p);
    expect(p.sessions).toEqual([{ id: 1, date: "2026-10-24", correct: 5 }]);
    expect(finishDaily(p)).toBe(p);
    p = startDaily(p, "2026-11-28");
    expect(p.sessions).toHaveLength(1);
    expect(p.attempts).toHaveLength(5);
    expect(p.daily?.id).toBe(2);
  });
  it("roundtrips all progress without touching the Phase 1 storage key", () => {
    const writes: Record<string, string> = { "pokerlab-progress": "keep me" };
    const storage = {
      getItem: (key: string) => writes[key] ?? null,
      setItem: (key: string, value: string) => {
        writes[key] = value;
      },
    };
    const p = add(emptyTraining(), "open-utg-aa", "Raise");
    expect(saveTraining(storage, p)).toBe(true);
    expect(writes[TRAINING_KEY]).toBeTruthy();
    expect(writes["pokerlab-progress"]).toBe("keep me");
    expect(readTraining(storage)).toEqual({ progress: p, available: true });
  });
  it.each([
    "no json",
    "null",
    "{}",
    '{"version":2}',
    '{"version":1,"attempts":[null],"sessions":[],"daily":null}',
  ])("handles corrupt or unsupported records %s", (raw) =>
    expect(parseTraining(raw)).toEqual(emptyTraining()),
  );
  it("rejects duplicate IDs, unknown targets, illegal choices, invalid session links and impossible scores", () => {
    const p = add(emptyTraining(), "open-utg-aa", "Raise");
    const variants = [
      { ...p, attempts: [p.attempts[0], p.attempts[0]] },
      { ...p, attempts: [{ ...p.attempts[0], target: "missing" }] },
      { ...p, attempts: [{ ...p.attempts[0], choice: "Check" }] },
      { ...p, sessions: [{ id: 1, date: "2026-10-24", correct: 6 }] },
      {
        ...startDaily(p, "2026-10-24"),
        daily: {
          id: 1,
          date: "2026-10-24",
          plan: dailyPlan("2026-10-24"),
          answers: [999],
          started: true,
        },
      },
    ];
    for (const v of variants)
      expect(parseTraining(JSON.stringify(v))).toEqual(emptyTraining());
  });
  it("handles unavailable and full browser storage safely", () => {
    const storage = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("full");
      },
    };
    expect(readTraining(storage)).toEqual({
      progress: emptyTraining(),
      available: false,
    });
    expect(saveTraining(storage, emptyTraining())).toBe(false);
  });
  it("derives scoring from fixtures rather than saved correctness claims", () => {
    const p = add(emptyTraining(), "open-utg-aa", "Fold");
    const raw = JSON.stringify({
      ...p,
      attempts: [{ ...p.attempts[0], correct: true }],
      secret: "ignored",
    });
    const loaded = parseTraining(raw);
    expect(attemptCorrect(loaded.attempts[0])).toBe(false);
    expect(loaded).not.toHaveProperty("secret");
    expect(loaded.attempts[0]).not.toHaveProperty("correct");
  });
});
