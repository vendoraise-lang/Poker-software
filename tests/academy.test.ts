import { describe, it, expect } from "vitest";
import {
  QUESTIONS,
  MODULES,
  getQuestion,
  gradeQuestion,
  priceKey,
  optionOrder,
} from "../lib/academy/content";
import {
  ACADEMY_KEY,
  emptyAcademy,
  academyState,
  validateAcademy,
  assessmentPlan,
  practiceAnswer,
  completeLesson,
  beginAssessment,
  answerAssessment,
  finishAssessment,
  moduleCompleted,
  conceptResults,
  recommendedModule,
  recommendedLesson,
  legacyAcademyKeys,
  type AcademyData,
} from "../lib/academy/progress";
import { auditTeachingMaterials } from "../lib/academy/audit";
import { collectBackup, validateBackup, applyBackup } from "../lib/backup";
import { emptyTraining } from "../lib/training/progress";
const at = "2026-10-24T12:00:00.000Z";
function run(p: AcademyData, id: number, correct = true) {
  p = beginAssessment(p, id, at);
  for (let n = 0; n < 4; n++) {
    const s = academyState(p).active!,
      q = getQuestion(s.questions[n]);
    p = answerAssessment(
      p,
      correct
        ? q.accepted[0]
        : q.options.find((o) => !q.accepted.includes(o.id))!.id,
      at,
    );
  }
  return finishAssessment(p, at);
}
function acceptedLabel(id: string) {
  const q = getQuestion(id);
  return q.options.find((o) => o.id === q.accepted[0])!.label;
}
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}
describe("Academy curriculum and factual oracles", () => {
  it("has seven complete modules, fourteen concepts and separate practice/assessment banks", () => {
    expect(MODULES).toHaveLength(7);
    expect(QUESTIONS).toHaveLength(98);
    expect(QUESTIONS.filter((q) => q.purpose === "assessment")).toHaveLength(
      84,
    );
    for (const m of MODULES) {
      expect(m.objectives).toHaveLength(3);
      expect(m.lessons).toHaveLength(2);
      for (const c of m.concepts) {
        expect(
          QUESTIONS.filter(
            (q) => q.concept === c && q.purpose === "assessment",
          ),
        ).toHaveLength(6);
      }
    }
  });
  it("audits all new fixtures and existing legal actions, cards and rounded odds", () => {
    expect(auditTeachingMaterials()).toEqual({
      issues: [],
      counts: {
        modules: 7,
        academy: 98,
        preflop: 15,
        postflop: 30,
        odds: 5,
        draws: 5,
        equityExamples: 6,
      },
    });
  });
  it.each([
    ["a6-actions-1", "20 chips"],
    ["a6-actions-2", "100 chips"],
    ["a6-rankings-0", "Straight"],
    ["a6-rankings-1", "Full house"],
    ["a6-rankings-2", "Flush"],
    ["a6-rankings-3", "Four of a kind"],
    ["a6-rankings-6", "Straight flush"],
    ["a6-price-1", "28.57%"],
    ["a6-price-4", "14.29%"],
    ["a6-share-3", "20.00%"],
    ["a6-share-4", "16.67%"],
    ["a6-share-5", "0.00%"],
    ["a6-share-6", "37.50%"],
    ["a6-combinations-4", "1326 combos"],
    ["a6-combinations-5", "10 combos"],
    ["a6-combinations-6", "18 combos"],
    ["a6-blockers-1", "3 combos"],
    ["a6-blockers-2", "1 combos"],
    ["a6-blockers-3", "0 combos"],
    ["a6-blockers-6", "2 combos"],
    ["a6-draw-counting-1", "8 cards"],
    ["a6-draw-counting-2", "7 cards"],
    ["a6-draw-counting-3", "7 cards"],
    ["a6-draw-counting-4", "2 cards"],
    ["a6-draw-counting-5", "13 cards"],
    ["a6-draw-counting-6", "7 cards"],
  ])("independent expected answer %s", (id, label) => {
    expect(acceptedLabel(id)).toBe(label);
  });
  it("grades all known options and rejects invented ones", () => {
    for (const q of QUESTIONS) {
      for (const o of q.options)
        expect(gradeQuestion(q.id, o.id).accepted).toBe(
          q.accepted.includes(o.id),
        );
      expect(() => gradeQuestion(q.id, "made-up")).toThrow();
      expect(
        optionOrder(q, 4)
          .map((o) => o.id)
          .sort(),
      ).toEqual(q.options.map((o) => o.id).sort());
    }
    expect(() => getQuestion("missing")).toThrow();
  });
  it("keeps conditional strategy separate and permits multiple defensible lines", () => {
    for (const q of QUESTIONS.filter((q) => q.kind === "judgment")) {
      expect(q.basis).toContain("external");
      expect(q.explanation).toBeTruthy();
    }
    expect(getQuestion("a6-selection-1").accepted).toHaveLength(2);
    expect(getQuestion("a6-defence-reasoning-1").accepted).toHaveLength(2);
    expect(getQuestion("a6-defence-reasoning-5").kind).toBe("fact");
  });
  it("does not credit scaled maths or rank-only pair-count duplicates as novel", () => {
    expect(priceKey(100, 50)).toBe(priceKey(200, 100));
    expect(getQuestion("a6-combinations-0").key).toBe(
      getQuestion("a6-combinations-1").key,
    );
    expect(getQuestion("a6-blockers-0").key).toBe(
      getQuestion("a6-blockers-1").key,
    );
  });
});
describe("distinct evidence and learning recommendations", () => {
  it("prioritizes unseen scenarios on reassessment", () => {
    let p = emptyAcademy();
    const first = assessmentPlan(p, 1).map((q) => q.key);
    p = run(p, 1);
    const next = assessmentPlan(p, 1).map((q) => q.key);
    expect(next.some((k) => first.includes(k))).toBe(false);
    expect(academyState(p).evidence).toHaveLength(4);
  });
  it("caps independent evidence when the bank is exhausted and preserves first errors", () => {
    let p = run(emptyAcademy(), 1, false);
    p = run(p, 1);
    p = run(p, 1);
    expect(academyState(p).evidence).toHaveLength(12);
    p = run(p, 1);
    const s = academyState(p);
    expect(s.evidence).toHaveLength(12);
    expect(s.sessions.at(-1)!.answers.every((a) => !a.fresh)).toBe(true);
    expect(s.evidence.filter((e) => !e.accepted)).toHaveLength(4);
  });
  it("reserves questions across reloads and disallows restart, skipped and duplicate answers", () => {
    let p = beginAssessment(emptyAcademy(), 2, at);
    expect(academyState(p).exposed.size).toBe(4);
    expect(() => beginAssessment(p, 2, at)).toThrow();
    p = validateAcademy(JSON.parse(JSON.stringify(p)));
    const q = getQuestion(academyState(p).active!.questions[0]);
    p = answerAssessment(p, q.accepted[0], at);
    const bad = {
      ...p,
      events: [
        ...p.events,
        {
          seq: 3,
          at,
          type: "answer",
          session: 1,
          question: q.id,
          choice: q.accepted[0],
        },
      ],
    };
    expect(() => validateAcademy(bad)).toThrow();
    expect(() => finishAssessment(p, at)).toThrow();
    expect(academyState(p).active?.answers).toHaveLength(1);
  });
  it("practice creates no assessment credit and exposes equivalent pair exercises", () => {
    let p = practiceAnswer(
      emptyAcademy(),
      "a6-combinations-0",
      getQuestion("a6-combinations-0").accepted[0],
      at,
    );
    expect(academyState(p).evidence).toHaveLength(0);
    expect(assessmentPlan(p, 6).some((q) => q.id === "a6-combinations-1")).toBe(
      false,
    );
    p = completeLesson(p, "lesson-combinations", at);
    expect(completeLesson(p, "lesson-combinations", at)).toEqual(p);
    expect(() => completeLesson(p, "lesson-blockers", at)).toThrow();
  });
  it("requires lessons, exercises and finished assessment for activity completion, independently of mastery", () => {
    let p = run(emptyAcademy(), 1, false);
    expect(moduleCompleted(academyState(p), 1)).toBe(false);
    for (const l of MODULES[0].lessons) {
      p = practiceAnswer(
        p,
        l.practiceId,
        getQuestion(l.practiceId).accepted[0],
        at,
      );
      p = completeLesson(p, l.id, at);
    }
    const s = academyState(p);
    expect(moduleCompleted(s, 1)).toBe(true);
    expect(conceptResults(s).actions.needsStudy).toBe(true);
    expect(recommendedModule(s).id).toBe(1);
  });
  it("recommends study after multiple mistakes and keeps concepts separately assessed", () => {
    const s = academyState(run(emptyAcademy(), 4, false)),
      r = conceptResults(s);
    expect(r["value-control"].distinct).toBe(2);
    expect(r["value-control"].judgments).toBe(2);
    expect(r["value-control"].factual).toBe(0);
    expect(r.actions.distinct).toBe(0);
    expect(recommendedModule(s).id).toBe(4);
  });
  it("recommends the specific weak lesson rather than a stronger neighboring concept", () => {
    let p = beginAssessment(emptyAcademy(), 1, at);
    for (let i = 0; i < 4; i++) {
      const q = getQuestion(academyState(p).active!.questions[i]);
      p = answerAssessment(
        p,
        q.concept === "rankings"
          ? q.options.find((o) => !q.accepted.includes(o.id))!.id
          : q.accepted[0],
        at,
      );
    }
    p = finishAssessment(p, at);
    expect(recommendedLesson(academyState(p)).lesson.id).toBe(
      "lesson-rankings",
    );
    expect(recommendedLesson(academyState(emptyAcademy())).lesson.id).toBe(
      "lesson-actions",
    );
  });
  it("reports early/recent evidence only after enough distinct contexts", () => {
    let p = run(emptyAcademy(), 1, false);
    expect(conceptResults(academyState(p)).actions.early).toBeNull();
    p = run(p, 1, true);
    const r = conceptResults(academyState(p)).actions;
    expect(r.early).toBe(0);
    expect(r.recent).toBe(1);
  });
  it("carries known older exposure forward without inventing prior assessment success", () => {
    const training = {
      ...emptyTraining(),
      attempts: [
        {
          id: 1,
          kind: "odds" as const,
          target: "odds-half",
          choice: "25",
          source: "practice" as const,
        },
      ],
    };
    const p = { ...emptyAcademy(), priorKeys: legacyAcademyKeys(training) };
    expect(p.priorKeys).toContain(priceKey(100, 50));
    expect(academyState(p).evidence).toHaveLength(0);
  });
});
describe("versioned replay validation and backup compatibility", () => {
  it("roundtrips partial and completed history and recalculates grades", () => {
    const p = run(emptyAcademy(), 1);
    const raw = JSON.parse(JSON.stringify(p));
    raw.events[1].accepted = false;
    raw.events[1].fresh = false;
    const restored = validateAcademy(raw);
    expect(restored).toEqual(p);
    expect(academyState(restored).evidence.every((e) => e.accepted)).toBe(true);
  });
  it.each([
    null,
    {},
    { version: 2, events: [], priorKeys: [] },
    { version: 1, events: [], priorKeys: ["invented"] },
    { version: 1, events: [], priorKeys: ["combo:pair", "combo:pair"] },
    {
      version: 1,
      events: [{ seq: 2, at, type: "finish", session: 1 }],
      priorKeys: [],
    },
    {
      version: 1,
      events: [
        { seq: 1, at: "2026-02-30T12:00:00.000Z", type: "finish", session: 1 },
      ],
      priorKeys: [],
    },
    { version: 1, events: [{ seq: 1, at, type: "mystery" }], priorKeys: [] },
  ])("rejects malformed Academy data %#", (bad) => {
    expect(() => validateAcademy(bad)).toThrow();
  });
  it("rejects mixed modules, insufficient questions, repeated keys and invalid options", () => {
    const p = beginAssessment(emptyAcademy(), 1, at);
    for (const qs of [
      ["a6-actions-1"],
      Array(4).fill("a6-actions-1"),
      ["a6-actions-1", "a6-actions-2", "a6-position-1", "a6-position-2"],
    ]) {
      expect(() =>
        validateAcademy({ ...p, events: [{ ...p.events[0], questions: qs }] }),
      ).toThrow();
    }
    expect(() => answerAssessment(p, "not-an-option", at)).toThrow();
    expect(() => practiceAnswer(p, "a6-actions-1", "o0", at)).toThrow();
  });
  it("exports version 5 only when Academy data exists and requires confirmation before overwrite", () => {
    const s = memory();
    expect(collectBackup(s).version).toBe(3);
    const p = run(emptyAcademy(), 2);
    s.setItem(ACADEMY_KEY, JSON.stringify(p));
    const b = collectBackup(s);
    expect(b.version).toBe(5);
    expect(b.academy).toEqual(p);
    const dest = memory();
    expect(() => applyBackup(dest, b, false)).toThrow();
    expect(dest.getItem(ACADEMY_KEY)).toBeNull();
    applyBackup(dest, b, true);
    expect(JSON.parse(dest.getItem(ACADEMY_KEY)!)).toEqual(p);
  });
  it.each([2, 3, 4])(
    "older version %i imports preserve Academy data",
    (version) => {
      const s = memory(),
        old = collectBackup(s);
      s.setItem(ACADEMY_KEY, JSON.stringify(run(emptyAcademy(), 1)));
      const before = s.getItem(ACADEMY_KEY);
      const b = validateBackup(
        JSON.stringify({
          ...old,
          version,
          ...(version === 4
            ? {
                review: {
                  version: 1,
                  observations: [],
                  ranges: [null, null, null],
                },
              }
            : {}),
        }),
      );
      applyBackup(s, b, true);
      expect(s.getItem(ACADEMY_KEY)).toBe(before);
    },
  );
  it("rejects malformed and incompatible Academy backups before writing any data", () => {
    const s = memory();
    s.setItem(ACADEMY_KEY, JSON.stringify(emptyAcademy()));
    const b = collectBackup(s);
    for (const bad of [
      { ...b, academy: { version: 2 } },
      { ...b, academy: undefined },
      { ...b, version: 6 },
    ])
      expect(() => validateBackup(JSON.stringify(bad))).toThrow();
    expect(s.getItem(ACADEMY_KEY)).toBe(JSON.stringify(emptyAcademy()));
  });
  it("rolls back all included sections when an Academy storage write fails", () => {
    const source = memory();
    source.setItem(ACADEMY_KEY, JSON.stringify(run(emptyAcademy(), 1)));
    const b = collectBackup(source),
      dest = memory();
    dest.setItem("pokerlab-progress", JSON.stringify(b.game));
    const old = dest.getItem("pokerlab-progress");
    let failed = false;
    const storage = {
      ...dest,
      setItem: (k: string, v: string) => {
        if (k === ACADEMY_KEY && !failed) {
          failed = true;
          throw Error("quota");
        }
        dest.setItem(k, v);
      },
    };
    expect(() => applyBackup(storage, b, true)).toThrow("restored");
    expect(dest.getItem("pokerlab-progress")).toBe(old);
    expect(dest.getItem(ACADEMY_KEY)).toBeNull();
  });
});
