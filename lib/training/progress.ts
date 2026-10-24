import {
  gradeDecision,
  scenarioById,
  SCENARIOS,
  type Choice,
  type Topic,
} from "./fixtures";
import { gradeOdds, quizById } from "./odds";
export const TRAINING_KEY = "pokerlab-training-v1";
export type Attempt = {
  id: number;
  kind: "decision" | "odds";
  target: string;
  choice: string;
  source: "practice" | "daily";
};
export type DailySession = {
  id: number;
  date: string;
  plan: string[];
  answers: number[];
  started: boolean;
};
export type CompletedSession = { id: number; date: string; correct: number };
export type TrainingProgress = {
  version: 1;
  attempts: Attempt[];
  sessions: CompletedSession[];
  daily: DailySession | null;
};
export function emptyTraining(): TrainingProgress {
  return { version: 1, attempts: [], sessions: [], daily: null };
}
export function attemptCorrect(a: Attempt) {
  return a.kind === "decision"
    ? gradeDecision(scenarioById(a.target), a.choice as Choice).correct
    : gradeOdds(quizById(a.target), Number(a.choice)).correct;
}
function validAttempt(a: Attempt) {
  return (
    a &&
    Number.isSafeInteger(a.id) &&
    a.id > 0 &&
    ["decision", "odds"].includes(a.kind) &&
    ["practice", "daily"].includes(a.source) &&
    typeof a.target === "string" &&
    typeof a.choice === "string" &&
    (a.kind === "decision"
      ? scenarioById(a.target) && ["Fold", "Call", "Raise"].includes(a.choice)
      : quizById(a.target).options.some((n) => String(n) === a.choice)) &&
    typeof attemptCorrect(a) === "boolean"
  );
}
function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function parseTraining(raw: string | null): TrainingProgress {
  try {
    const p = JSON.parse(raw ?? "null") as TrainingProgress;
    if (
      !p ||
      p.version !== 1 ||
      !Array.isArray(p.attempts) ||
      !p.attempts.every(validAttempt) ||
      new Set(p.attempts.map((a) => a.id)).size !== p.attempts.length ||
      !Array.isArray(p.sessions) ||
      !p.sessions.every(
        (s) =>
          s &&
          Number.isSafeInteger(s.id) &&
          s.id > 0 &&
          validDate(s.date) &&
          Number.isInteger(s.correct) &&
          s.correct >= 0 &&
          s.correct <= 5,
      ) ||
      new Set(p.sessions.map((s) => s.id)).size !== p.sessions.length
    )
      return emptyTraining();
    if (p.daily) {
      const d = p.daily;
      if (
        !Number.isSafeInteger(d.id) ||
        d.id < 1 ||
        !validDate(d.date) ||
        typeof d.started !== "boolean" ||
        !Array.isArray(d.plan) ||
        d.plan.length !== 5 ||
        new Set(d.plan).size !== 5 ||
        !d.plan.every((id) => scenarioById(id)) ||
        !Array.isArray(d.answers) ||
        d.answers.length > 5 ||
        new Set(d.answers).size !== d.answers.length ||
        !d.answers.every((id, i) =>
          p.attempts.some(
            (a) =>
              a.id === id &&
              a.source === "daily" &&
              a.kind === "decision" &&
              a.target === d.plan[i],
          ),
        ) ||
        p.sessions.some((s) => s.id > d.id) ||
        p.sessions.some(
          (s) => s.id === d.id && (s.date !== d.date || d.answers.length !== 5),
        )
      )
        return emptyTraining();
    } else if (p.daily !== null) return emptyTraining();
    // Strip unknown fields rather than carrying arbitrary data into future writes.
    return {
      version: 1,
      attempts: p.attempts.map(({ id, kind, target, choice, source }) => ({
        id,
        kind,
        target,
        choice,
        source,
      })),
      sessions: p.sessions.map(({ id, date, correct }) => ({
        id,
        date,
        correct,
      })),
      daily: p.daily
        ? {
            id: p.daily.id,
            date: p.daily.date,
            plan: [...p.daily.plan],
            answers: [...p.daily.answers],
            started: p.daily.started,
          }
        : null,
    };
  } catch {
    return emptyTraining();
  }
}
export function validateTraining(value: unknown): TrainingProgress {
  try {
    const p = value as TrainingProgress,
      parsed = parseTraining(JSON.stringify(value)),
      projection = {
        version: p.version,
        attempts: p.attempts.map(({ id, kind, target, choice, source }) => ({
          id,
          kind,
          target,
          choice,
          source,
        })),
        sessions: p.sessions.map(({ id, date, correct }) => ({
          id,
          date,
          correct,
        })),
        daily: p.daily
          ? {
              id: p.daily.id,
              date: p.daily.date,
              plan: p.daily.plan,
              answers: p.daily.answers,
              started: p.daily.started,
            }
          : p.daily,
      };
    if (JSON.stringify(parsed) !== JSON.stringify(projection)) throw Error();
    return parsed;
  } catch {
    throw Error("Invalid Phase 2 training data.");
  }
}
export type StoragePort = Pick<Storage, "getItem" | "setItem">;
export function readTraining(storage: StoragePort) {
  try {
    return {
      progress: (() => {
        const raw = storage.getItem(TRAINING_KEY);
        return raw === null
          ? emptyTraining()
          : validateTraining(JSON.parse(raw));
      })(),
      available: true,
    };
  } catch {
    return { progress: emptyTraining(), available: false };
  }
}
export function saveTraining(storage: StoragePort, progress: TrainingProgress) {
  try {
    storage.setItem(TRAINING_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function recordAttempt(
  p: TrainingProgress,
  input: Omit<Attempt, "id">,
): TrainingProgress {
  const a = { ...input, id: Math.max(0, ...p.attempts.map((a) => a.id)) + 1 };
  if (!validAttempt(a)) throw Error("Invalid answer");
  return { ...p, attempts: [...p.attempts, a] };
}
export function unlockedLevel(p: TrainingProgress): 1 | 2 | 3 {
  const count = (level: number) =>
    p.attempts.filter(
      (a) => a.kind === "decision" && scenarioById(a.target).level === level,
    ).length;
  return count(1) < 5 ? 1 : count(2) < 5 ? 2 : 3;
}
export type Accuracy = { total: number; correct: number };
export function accuracy(attempts: Attempt[]): Accuracy {
  return {
    total: attempts.length,
    correct: attempts.filter(attemptCorrect).length,
  };
}
export function topicOf(a: Attempt): Topic {
  return a.kind === "odds" ? "pot-odds" : scenarioById(a.target).topic;
}
export function topicStats(p: TrainingProgress): Record<Topic, Accuracy> {
  return Object.fromEntries(
    (["opening", "defending", "reraising", "pot-odds"] as Topic[]).map((t) => [
      t,
      accuracy(p.attempts.filter((a) => topicOf(a) === t)),
    ]),
  ) as Record<Topic, Accuracy>;
}
export function mistakesBy(
  p: TrainingProgress,
  dimension: "position" | "strength" | "action",
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of p.attempts) {
    if (a.kind !== "decision" || attemptCorrect(a)) continue;
    const s = scenarioById(a.target),
      key = dimension === "action" ? a.choice : s[dimension];
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
export function recommendedTopic(p: TrainingProgress): Topic {
  const stats = topicStats(p);
  const errors = (Object.keys(stats) as Topic[]).filter(
    (t) => stats[t].correct < stats[t].total,
  );
  errors.sort(
    (a, b) =>
      stats[a].correct / stats[a].total - stats[b].correct / stats[b].total,
  );
  return errors[0] ?? "opening";
}
/** Stable date hash chooses 2 foundation, 2 facing-raise and 1 stretch fixture.
 * No random runtime inputs, streaks, or missed-day penalties. Repeats count as practice.
 */
export function dailyPlan(date: string): string[] {
  if (!validDate(date)) throw Error("Invalid date");
  let hash = 0;
  for (const c of date) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return [1, 2, 3].flatMap((level) => {
    const pool = SCENARIOS.filter((s) => s.level === level),
      offset = hash % pool.length;
    return Array.from(
      { length: level === 3 ? 1 : 2 },
      (_, i) => pool[(offset + i) % pool.length].id,
    );
  });
}
export function startDaily(
  p: TrainingProgress,
  date: string,
): TrainingProgress {
  return {
    ...p,
    daily: {
      id: Math.max(0, ...p.sessions.map((s) => s.id), p.daily?.id ?? 0) + 1,
      date,
      plan: dailyPlan(date),
      answers: [],
      started: false,
    },
  };
}
export function beginDaily(p: TrainingProgress): TrainingProgress {
  if (!p.daily || p.daily.started) throw Error("No lesson to begin");
  return { ...p, daily: { ...p.daily, started: true } };
}
export function answerDaily(
  p: TrainingProgress,
  choice: Choice,
): TrainingProgress {
  const d = p.daily;
  if (!d || !d.started || d.answers.length >= 5)
    throw Error("No active daily question");
  const next = recordAttempt(p, {
    kind: "decision",
    target: d.plan[d.answers.length],
    choice,
    source: "daily",
  });
  return {
    ...next,
    daily: {
      ...d,
      answers: [...d.answers, next.attempts[next.attempts.length - 1].id],
    },
  };
}
export function finishDaily(p: TrainingProgress): TrainingProgress {
  const d = p.daily;
  if (!d || d.answers.length !== 5) throw Error("Finish five scenarios first");
  if (p.sessions.some((s) => s.id === d.id)) return p;
  const attempts = d.answers.map((id) => p.attempts.find((a) => a.id === id)!);
  return {
    ...p,
    sessions: [
      ...p.sessions,
      { id: d.id, date: d.date, correct: accuracy(attempts).correct },
    ],
  };
}
