import type { Progress } from "./progress";
export function validateGameProgress(value: unknown): Progress {
  const p = value as Progress;
  if (
    !p ||
    p.version !== 1 ||
    !Number.isSafeInteger(p.hands) ||
    p.hands < 0 ||
    !Number.isSafeInteger(p.wins) ||
    p.wins < 0 ||
    p.wins > p.hands ||
    !Array.isArray(p.decisions) ||
    p.decisions.length > 200 ||
    !p.decisions.every(
      (d) =>
        d &&
        Number.isSafeInteger(d.hand) &&
        d.hand > 0 &&
        typeof d.street === "string" &&
        typeof d.action === "string" &&
        typeof d.position === "string",
    ) ||
    !Array.isArray(p.lessons) ||
    !p.lessons.every((l) => typeof l === "string")
  )
    throw Error("Invalid game progress.");
  return {
    version: 1,
    hands: p.hands,
    wins: p.wins,
    decisions: p.decisions.map((d) => ({ ...d })),
    lessons: [...p.lessons],
  };
}
