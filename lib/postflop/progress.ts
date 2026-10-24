import { gradePost, POSTFLOP, postById, type Concept } from "./scenarios";
import type { Action } from "../poker";
export const POST_KEY = "pokerlab-postflop-v1";
export type PostAttempt = {
  id: number;
  exercise: string;
  action: Action;
  day: number;
};
export type PostProgress = { version: 1; attempts: PostAttempt[] };
export const emptyPost = (): PostProgress => ({ version: 1, attempts: [] });
export function dayNumber(date = new Date()) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
}
export function validatePost(value: unknown): PostProgress {
  const p = value as PostProgress;
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.attempts) ||
    p.attempts.length > 20000
  )
    throw Error("Unsupported or malformed postflop progress.");
  let last = 0;
  const attempts = p.attempts.map((a) => {
    if (
      !a ||
      !Number.isSafeInteger(a.id) ||
      a.id <= last ||
      !Number.isSafeInteger(a.day) ||
      a.day < 0 ||
      typeof a.exercise !== "string" ||
      typeof a.action !== "string"
    )
      throw Error("Invalid postflop attempt.");
    gradePost(postById(a.exercise), a.action);
    last = a.id;
    return { id: a.id, exercise: a.exercise, action: a.action, day: a.day };
  });
  return { version: 1, attempts };
}
export function recordPost(
  p: PostProgress,
  exercise: string,
  action: Action,
  day: number,
) {
  gradePost(postById(exercise), action);
  return validatePost({
    ...p,
    attempts: [
      ...p.attempts,
      { id: (p.attempts.at(-1)?.id ?? 0) + 1, exercise, action, day },
    ],
  });
}
/** A first answer per exercise per calendar day is a retrieval observation.
 * Same-day corrections do not erase a miss or multiply evidence. Multiple days
 * can lengthen that exercise's interval, but topic coverage counts unique IDs.
 */
export function reviewState(p: PostProgress, id: string) {
  const observations = new Map<number, PostAttempt>();
  for (const a of p.attempts)
    if (a.exercise === id && !observations.has(a.day))
      observations.set(a.day, a);
  const sorted = [...observations.values()].sort((a, b) => a.day - b.day);
  let streak = 0;
  for (const a of sorted)
    streak = gradePost(postById(id), a.action).correct ? streak + 1 : 0;
  const last = sorted.at(-1),
    lastCorrect = last ? gradePost(postById(id), last.action).correct : false;
  const interval = lastCorrect
    ? [1, 3, 7, 14][Math.min(Math.max(streak - 1, 0), 3)]
    : 1;
  return {
    seen: !!last,
    streak,
    due: last ? last.day + interval : 0,
    missed: p.attempts.some(
      (a) => a.exercise === id && !gradePost(postById(id), a.action).correct,
    ),
    correct: lastCorrect,
  };
}
export function conceptStats(p: PostProgress) {
  return Object.fromEntries(
    (
      ["value", "bluff", "control", "draws", "defence", "sizing"] as Concept[]
    ).map((concept) => {
      const fixtures = POSTFLOP.filter((s) => s.concept === concept),
        seen = fixtures.filter((s) => reviewState(p, s.id).seen),
        correct = seen.filter((s) => reviewState(p, s.id).correct);
      return [
        concept,
        { seen: seen.length, correct: correct.length, total: fixtures.length },
      ];
    }),
  ) as Record<Concept, { seen: number; correct: number; total: number }>;
}
export function practiceQueue(
  p: PostProgress,
  day: number,
  missedOnly = false,
) {
  const stats = conceptStats(p);
  return POSTFLOP.filter((s) => !missedOnly || reviewState(p, s.id).missed)
    .sort((a, b) => {
      const ar = reviewState(p, a.id),
        br = reviewState(p, b.id);
      const priority = (r: ReturnType<typeof reviewState>) =>
        r.seen && !r.correct && r.due <= day
          ? 0
          : r.seen && r.due <= day
            ? 1
            : !r.seen
              ? 2
              : 3;
      const weakness = (c: Concept) =>
        stats[c].seen ? stats[c].correct / stats[c].seen : 1;
      return (
        priority(ar) - priority(br) ||
        weakness(a.concept) - weakness(b.concept) ||
        ar.due - br.due ||
        POSTFLOP.indexOf(a) - POSTFLOP.indexOf(b)
      );
    })
    .map((s) => s.id);
}
