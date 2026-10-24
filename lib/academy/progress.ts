import {
  getModule,
  getQuestion,
  gradeQuestion,
  MODULES,
  QUESTIONS,
  type Concept,
  type Kind,
  type Question,
} from "./content";
import { priceKey } from "./content";
import { ODDS_QUIZZES } from "../training/odds";
import { SCENARIOS } from "../training/fixtures";
import type { TrainingProgress } from "../training/progress";
export const ACADEMY_KEY = "pokerlab-academy-v1";
export type AcademyEvent = { seq: number; at: string } & (
  | { type: "practice"; question: string; choice: string }
  | { type: "lesson"; lesson: string }
  | { type: "start"; module: number; questions: string[] }
  | { type: "answer"; session: number; question: string; choice: string }
  | { type: "finish"; session: number }
);
export type AcademyData = {
  version: 1;
  priorKeys: string[];
  events: AcademyEvent[];
};
export type Evidence = {
  question: string;
  concept: Concept;
  kind: Kind;
  accepted: boolean;
  session: number;
  seq: number;
  key: string;
};
export type AssessmentSession = {
  id: number;
  module: number;
  questions: string[];
  answers: {
    question: string;
    choice: string;
    accepted: boolean;
    fresh: boolean;
  }[];
  freshKeys: string[];
  finished: boolean;
};
export type AcademyState = {
  exposed: Set<string>;
  lessons: Set<string>;
  practice: Set<string>;
  active: AssessmentSession | null;
  sessions: AssessmentSession[];
  evidence: Evidence[];
  history: AcademyEvent[];
};
export const emptyAcademy = (): AcademyData => ({
  version: 1,
  priorKeys: [],
  events: [],
});
const keys = new Set(QUESTIONS.map((q) => q.key));
const lessons = new Map(
  MODULES.flatMap((m) => m.lessons.map((l) => [l.id, l] as const)),
);
function dateValid(at: string) {
  return (
    typeof at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at) &&
    Number.isFinite(Date.parse(at)) &&
    new Date(at).toISOString() === at
  );
}
export function academyState(p: AcademyData): AcademyState {
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.priorKeys) ||
    p.priorKeys.length > keys.size ||
    new Set(p.priorKeys).size !== p.priorKeys.length ||
    p.priorKeys.some((k) => !keys.has(k)) ||
    !Array.isArray(p.events) ||
    p.events.length > 5000
  )
    throw Error("Unsupported or malformed Academy history.");
  const state: AcademyState = {
    exposed: new Set(p.priorKeys),
    lessons: new Set(),
    practice: new Set(),
    active: null,
    sessions: [],
    evidence: [],
    history: [],
  };
  let seq = 0;
  const credited = new Set<string>();
  for (const raw of p.events) {
    if (
      !raw ||
      !Number.isSafeInteger(raw.seq) ||
      raw.seq !== seq + 1 ||
      !dateValid(raw.at)
    )
      throw Error("Invalid Academy event order or date.");
    seq = raw.seq;
    let event: AcademyEvent;
    switch (raw.type) {
      case "practice": {
        const q = getQuestion(raw.question);
        if (q.purpose !== "practice")
          throw Error("Assessment items cannot be relabeled as practice.");
        gradeQuestion(q.id, raw.choice);
        state.exposed.add(q.key);
        state.practice.add(q.id);
        event = {
          seq,
          at: raw.at,
          type: "practice",
          question: q.id,
          choice: raw.choice,
        };
        break;
      }
      case "lesson": {
        const lesson = lessons.get(raw.lesson);
        if (!lesson || !state.practice.has(lesson.practiceId))
          throw Error("Try the lesson example before completing it.");
        state.lessons.add(lesson.id);
        event = { seq, at: raw.at, type: "lesson", lesson: lesson.id };
        break;
      }
      case "start": {
        const currentModule = getModule(raw.module);
        if (
          state.active ||
          !Array.isArray(raw.questions) ||
          raw.questions.length !== 4
        )
          throw Error("Finish the active assessment before starting another.");
        const qs = raw.questions.map(getQuestion);
        if (
          qs.some(
            (q) => q.module !== currentModule.id || q.purpose !== "assessment",
          ) ||
          new Set(qs.map((q) => q.key)).size !== 4 ||
          currentModule.concepts.some(
            (c) => qs.filter((q) => q.concept === c).length !== 2,
          )
        )
          throw Error(
            "An assessment needs two distinct items per module concept.",
          );
        const freshKeys = qs
          .filter((q) => !state.exposed.has(q.key))
          .map((q) => q.key);
        qs.forEach((q) => state.exposed.add(q.key));
        state.active = {
          id: seq,
          module: currentModule.id,
          questions: qs.map((q) => q.id),
          answers: [],
          freshKeys,
          finished: false,
        };
        state.sessions.push(state.active);
        event = {
          seq,
          at: raw.at,
          type: "start",
          module: currentModule.id,
          questions: qs.map((q) => q.id),
        };
        break;
      }
      case "answer": {
        const session = state.active;
        if (
          !session ||
          raw.session !== session.id ||
          session.questions[session.answers.length] !== raw.question
        )
          throw Error(
            "Answer the current reserved assessment item once, in order.",
          );
        const q = getQuestion(raw.question),
          grade = gradeQuestion(q.id, raw.choice),
          fresh = session.freshKeys.includes(q.key) && !credited.has(q.key);
        session.answers.push({
          question: q.id,
          choice: raw.choice,
          accepted: grade.accepted,
          fresh,
        });
        if (fresh) {
          credited.add(q.key);
          state.evidence.push({
            question: q.id,
            concept: q.concept,
            kind: q.kind,
            accepted: grade.accepted,
            session: session.id,
            seq,
            key: q.key,
          });
        }
        event = {
          seq,
          at: raw.at,
          type: "answer",
          session: session.id,
          question: q.id,
          choice: raw.choice,
        };
        break;
      }
      case "finish": {
        const session = state.active;
        if (
          !session ||
          session.id !== raw.session ||
          session.answers.length !== 4
        )
          throw Error("Complete four assessment answers before finishing.");
        session.finished = true;
        state.active = null;
        event = { seq, at: raw.at, type: "finish", session: session.id };
        break;
      }
      default:
        throw Error("Unknown Academy event type.");
    }
    state.history.push(event);
  }
  return state;
}
export function validateAcademy(value: unknown): AcademyData {
  const p = value as AcademyData,
    state = academyState(p);
  return { version: 1, priorKeys: [...p.priorKeys], events: state.history };
}
export function conceptResults(state: AcademyState) {
  return Object.fromEntries(
    MODULES.flatMap((m) => m.concepts).map((c) => {
      const e = state.evidence.filter((e) => e.concept === c),
        half = Math.floor(e.length / 2),
        early = e.slice(0, half),
        recent = e.slice(-half),
        accepted = e.filter((e) => e.accepted).length;
      return [
        c,
        {
          distinct: e.length,
          accepted,
          factual: e.filter((e) => e.kind !== "judgment").length,
          factualAccepted: e.filter((e) => e.kind !== "judgment" && e.accepted)
            .length,
          judgments: e.filter((e) => e.kind === "judgment").length,
          judgmentsAccepted: e.filter(
            (e) => e.kind === "judgment" && e.accepted,
          ).length,
          needsStudy: e.length < 2 || accepted / e.length < 0.75,
          early:
            half >= 2 ? early.filter((e) => e.accepted).length / half : null,
          recent:
            half >= 2 ? recent.filter((e) => e.accepted).length / half : null,
        },
      ];
    }),
  ) as Record<
    Concept,
    {
      distinct: number;
      accepted: number;
      factual: number;
      factualAccepted: number;
      judgments: number;
      judgmentsAccepted: number;
      needsStudy: boolean;
      early: number | null;
      recent: number | null;
    }
  >;
}
export function assessmentPlan(p: AcademyData, moduleId: number): Question[] {
  const state = academyState(p);
  if (state.active) throw Error("Resume the reserved assessment first.");
  const currentModule = getModule(moduleId),
    stats = conceptResults(state),
    concepts = [...currentModule.concepts].sort(
      (a, b) =>
        (stats[a].distinct ? stats[a].accepted / stats[a].distinct : -1) -
        (stats[b].distinct ? stats[b].accepted / stats[b].distinct : -1),
    );
  return concepts.flatMap((c) =>
    QUESTIONS.filter((q) => q.concept === c && q.purpose === "assessment")
      .sort(
        (a, b) =>
          Number(state.exposed.has(a.key)) - Number(state.exposed.has(b.key)) ||
          QUESTIONS.indexOf(a) - QUESTIONS.indexOf(b),
      )
      .slice(0, 2),
  );
}
function append(
  p: AcademyData,
  payload: Omit<AcademyEvent, "seq" | "at">,
  at: string,
): AcademyData {
  return validateAcademy({
    ...p,
    events: [
      ...p.events,
      { ...payload, seq: (p.events.at(-1)?.seq ?? 0) + 1, at },
    ],
  });
}
export function practiceAnswer(
  p: AcademyData,
  question: string,
  choice: string,
  at = new Date().toISOString(),
) {
  return append(
    p,
    { type: "practice", question, choice } as Omit<AcademyEvent, "seq" | "at">,
    at,
  );
}
export function completeLesson(
  p: AcademyData,
  lesson: string,
  at = new Date().toISOString(),
) {
  if (academyState(p).lessons.has(lesson)) return p;
  return append(
    p,
    { type: "lesson", lesson } as Omit<AcademyEvent, "seq" | "at">,
    at,
  );
}
export function beginAssessment(
  p: AcademyData,
  module: number,
  at = new Date().toISOString(),
) {
  const questions = assessmentPlan(p, module).map((q) => q.id);
  return append(
    p,
    { type: "start", module, questions } as Omit<AcademyEvent, "seq" | "at">,
    at,
  );
}
export function answerAssessment(
  p: AcademyData,
  choice: string,
  at = new Date().toISOString(),
) {
  const active = academyState(p).active;
  if (!active) throw Error("No active assessment.");
  return append(
    p,
    {
      type: "answer",
      session: active.id,
      question: active.questions[active.answers.length],
      choice,
    } as Omit<AcademyEvent, "seq" | "at">,
    at,
  );
}
export function finishAssessment(
  p: AcademyData,
  at = new Date().toISOString(),
) {
  const active = academyState(p).active;
  if (!active) throw Error("No active assessment.");
  return append(
    p,
    { type: "finish", session: active.id } as Omit<AcademyEvent, "seq" | "at">,
    at,
  );
}
export function moduleCompleted(state: AcademyState, id: number) {
  const m = getModule(id);
  return (
    m.lessons.every(
      (l) => state.lessons.has(l.id) && state.practice.has(l.practiceId),
    ) && state.sessions.some((s) => s.module === id && s.finished)
  );
}
export function recommendedModule(state: AcademyState) {
  const stats = conceptResults(state),
    unfinished = MODULES.filter((m) => !moduleCompleted(state, m.id));
  const weak = MODULES.filter((m) =>
    m.concepts.some((c) => stats[c].distinct >= 2 && stats[c].needsStudy),
  );
  if (weak.length)
    return weak.sort(
      (a, b) =>
        Math.min(
          ...a.concepts.map((c) =>
            stats[c].distinct >= 2 ? stats[c].accepted / stats[c].distinct : 1,
          ),
        ) -
        Math.min(
          ...b.concepts.map((c) =>
            stats[c].distinct >= 2 ? stats[c].accepted / stats[c].distinct : 1,
          ),
        ),
    )[0];
  if (unfinished.length) return unfinished[0];
  return [...MODULES].sort((a, b) => {
    const score = (id: number) =>
      getModule(id).concepts.reduce(
        (n, c) =>
          n + (stats[c].distinct ? stats[c].accepted / stats[c].distinct : 0),
        0,
      );
    return score(a.id) - score(b.id) || a.id - b.id;
  })[0];
}
export function recommendedLesson(state: AcademyState) {
  const currentModule = recommendedModule(state),
    stats = conceptResults(state);
  const weak = currentModule.lessons
    .filter(
      (l) => stats[l.concept].distinct >= 2 && stats[l.concept].needsStudy,
    )
    .sort(
      (a, b) =>
        stats[a.concept].accepted / stats[a.concept].distinct -
        stats[b.concept].accepted / stats[b.concept].distinct,
    );
  return {
    currentModule,
    lesson:
      weak[0] ??
      currentModule.lessons.find((l) => !state.lessons.has(l.id)) ??
      currentModule.lessons[0],
  };
}
export function legacyAcademyKeys(training: TrainingProgress) {
  const seen = new Set<string>();
  for (const a of training.attempts) {
    if (a.kind === "odds") {
      const q = ODDS_QUIZZES.find((q) => q.id === a.target);
      if (q) {
        const key = priceKey(q.potBeforeBet, q.bet);
        if (keys.has(key)) seen.add(key);
      }
    } else {
      const s = SCENARIOS.find((s) => s.id === a.target);
      if (s?.topic === "opening") {
        const key = `selection:${s.position}:${s.hand}:${s.stackBB}:first-in`;
        if (keys.has(key)) seen.add(key);
      }
    }
  }
  return [...seen];
}
