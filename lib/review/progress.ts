import { validateCards } from "../postflop/texture";
import { REVIEW_TOPICS, type ReviewTopic } from "./model";
import { validateRange, type WeightedRange } from "../equity/ranges";
export const REVIEW_KEY = "pokerlab-review-v1";
export type Observation = {
  context: string;
  topic: ReviewTopic;
  first: "practice" | "understood";
  latest: "practice" | "understood";
  day: string;
};
export type ReviewData = {
  version: 1;
  observations: Observation[];
  ranges: (WeightedRange | null)[];
};
export const emptyReview = (): ReviewData => ({
  version: 1,
  observations: [],
  ranges: [null, null, null],
});
export function validateReview(value: unknown): ReviewData {
  const p = value as ReviewData;
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.observations) ||
    p.observations.length > 2000 ||
    !Array.isArray(p.ranges) ||
    p.ranges.length !== 3
  )
    throw Error("Invalid or unsupported hand-review data.");
  const seen = new Set<string>();
  const observations = p.observations.map((o) => {
    if (
      !o ||
      typeof o.context !== "string" ||
      o.context.length < 2 ||
      o.context.length > 20000 ||
      !Object.hasOwn(REVIEW_TOPICS, o.topic) ||
      !["practice", "understood"].includes(o.first) ||
      !["practice", "understood"].includes(o.latest) ||
      typeof o.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(o.day) ||
      seen.has(o.context + "|" + o.topic)
    )
      throw Error("Invalid review observation.");
    const date = new Date(o.day + "T12:00:00Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== o.day
    )
      throw Error("Invalid review date.");
    let context;
    try {
      context = JSON.parse(o.context);
    } catch {
      throw Error("Review context is not valid JSON.");
    }
    if (
      !context ||
      !["Preflop", "Flop", "Turn", "River"].includes(context.street) ||
      !Array.isArray(context.hero) ||
      context.hero.length !== 2 ||
      !Array.isArray(context.board) ||
      context.board.length !==
        ({ Preflop: 0, Flop: 3, Turn: 4, River: 5 } as Record<string, number>)[
          context.street
        ] ||
      typeof context.position !== "string" ||
      !Number.isSafeInteger(context.stack) ||
      context.stack < 0 ||
      !Number.isSafeInteger(context.pot) ||
      context.pot < 0 ||
      !Array.isArray(context.history) ||
      !context.history.every((s: unknown) => typeof s === "string") ||
      (context.chosen &&
        !["fold", "call", "check", "bet", "raise"].includes(
          context.chosen.action,
        ))
    )
      throw Error("Invalid public review context.");
    validateCards([...context.hero, ...context.board]);
    seen.add(o.context + "|" + o.topic);
    return {
      context: o.context,
      topic: o.topic,
      first: o.first,
      latest: o.latest,
      day: o.day,
    };
  });
  return {
    version: 1,
    observations,
    ranges: p.ranges.map((r) => (r === null ? null : validateRange(r))),
  };
}
export function observeReview(
  p: ReviewData,
  context: string,
  topic: ReviewTopic,
  status: "practice" | "understood",
  day: string,
): ReviewData {
  const existing = p.observations.find(
      (o) => o.context === context && o.topic === topic,
    ),
    observations = existing
      ? p.observations.map((o) =>
          o === existing ? { ...o, latest: status } : o,
        )
      : [
          ...p.observations,
          { context, topic, first: status, latest: status, day },
        ];
  return validateReview({ ...p, observations });
}
export function reviewSummary(p: ReviewData) {
  return Object.fromEntries(
    (Object.keys(REVIEW_TOPICS) as ReviewTopic[]).map((topic) => {
      const obs = p.observations.filter((o) => o.topic === topic),
        half = Math.floor(obs.length / 2),
        early = obs.slice(0, half),
        recent = obs.slice(-half),
        rate = (v: Observation[]) =>
          v.length
            ? v.filter((o) => o.first === "understood").length / v.length
            : null;
      return [
        topic,
        {
          distinct: obs.length,
          needsPractice: obs.filter((o) => o.latest === "practice").length,
          initialUnderstood: obs.filter((o) => o.first === "understood").length,
          earlyRate: half >= 2 ? rate(early) : null,
          recentRate: half >= 2 ? rate(recent) : null,
        },
      ];
    }),
  ) as Record<
    ReviewTopic,
    {
      distinct: number;
      needsPractice: number;
      initialUnderstood: number;
      earlyRate: number | null;
      recentRate: number | null;
    }
  >;
}

import { conceptStats, type PostProgress } from "../postflop/progress";
import {
  attemptCorrect,
  topicOf,
  type TrainingProgress,
} from "../training/progress";
export function practiceEvidence(pre: TrainingProgress, post: PostProgress) {
  const stats = conceptStats(post);
  return Object.fromEntries(
    (Object.keys(REVIEW_TOPICS) as ReviewTopic[]).map((topic) => {
      if (topic === "opening" || topic === "pot-odds") {
        const seen = new Map<string, (typeof pre.attempts)[number]>();
        for (const a of pre.attempts)
          if (topicOf(a) === topic && !seen.has(a.target))
            seen.set(a.target, a);
        return [
          topic,
          {
            seen: seen.size,
            correct: [...seen.values()].filter(attemptCorrect).length,
          },
        ];
      }
      return [
        topic,
        { seen: stats[topic].seen, correct: stats[topic].correct },
      ];
    }),
  ) as Record<ReviewTopic, { seen: number; correct: number }>;
}
