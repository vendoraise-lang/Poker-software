import type { Card } from "../poker";
import { HAND_CLASSES, handClass } from "../training/ranges";
import { validateCards } from "../postflop/texture";
export type WeightedRange = { version: 1; weights: Record<string, number> };
export type WeightedCombo = {
  cards: Card[];
  weight: number;
  probability: number;
  hand: string;
};
export function validateRange(value: unknown): WeightedRange {
  const r = value as WeightedRange;
  if (
    !r ||
    r.version !== 1 ||
    !r.weights ||
    typeof r.weights !== "object" ||
    Array.isArray(r.weights)
  )
    throw Error("Unsupported weighted range.");
  const weights: Record<string, number> = {};
  for (const [hand, weight] of Object.entries(r.weights)) {
    if (
      !HAND_CLASSES.includes(hand) ||
      !Number.isInteger(weight) ||
      weight < 0 ||
      weight > 100
    )
      throw Error(
        "Range weights must be integers 0–100 on valid hand classes.",
      );
    if (weight) weights[hand] = weight;
  }
  if (!Object.keys(weights).length)
    throw Error("Select at least one positive-weight hand class.");
  return { version: 1, weights };
}
export function uniformRange(): WeightedRange {
  return {
    version: 1,
    weights: Object.fromEntries(HAND_CLASSES.map((h) => [h, 100])),
  };
}
export function expandRange(
  value: WeightedRange | null,
  blocked: Card[],
): WeightedCombo[] {
  validateCards(blocked);
  const range = value ? validateRange(value) : null,
    deck = Array.from({ length: 52 }, (_, i) => ({
      rank: (i % 13) + 2,
      suit: Math.floor(i / 13),
    })).filter(
      (c) => !blocked.some((b) => b.rank === c.rank && b.suit === c.suit),
    );
  const combos: WeightedCombo[] = [];
  let mass = 0;
  for (let i = 0; i < deck.length - 1; i++)
    for (let j = i + 1; j < deck.length; j++) {
      const cards = [deck[i], deck[j]],
        hand = handClass(cards),
        weight = range ? (range.weights[hand] ?? 0) : 1;
      if (weight) {
        mass += weight;
        combos.push({ cards, hand, weight, probability: 0 });
      }
    }
  for (const c of combos) c.probability = c.weight / mass;
  return combos;
}
export type JointAssignment = { hands: Card[][]; weight: number };
const code = (c: Card) => c.suit * 13 + c.rank - 2;
export function scanJoint(
  candidates: WeightedCombo[][],
  maxAssignments: number,
  nodeCap = 100000,
) {
  const assignments: JointAssignment[] = [];
  let nodes = 0,
    complete = true;
  function visit(
    i: number,
    used: Set<number>,
    hands: Card[][],
    weight: number,
  ) {
    if (!complete) return;
    if (i === candidates.length) {
      assignments.push({ hands, weight });
      if (assignments.length > maxAssignments) complete = false;
      return;
    }
    for (const combo of candidates[i]) {
      if (++nodes > nodeCap) {
        complete = false;
        return;
      }
      if (combo.cards.some((c) => used.has(code(c)))) continue;
      visit(
        i + 1,
        new Set([...used, ...combo.cards.map(code)]),
        [...hands, combo.cards],
        weight * combo.weight,
      );
      if (!complete) return;
    }
  }
  visit(0, new Set(), [], 1);
  return { assignments, complete, nodes };
}
/** Propose each seat independently from its blocker-normalized range, then
 * reject the ENTIRE assignment on collision. Accepted joint probability is
 * proportional to the product of raw per-combo weights. Never sequentially
 * renormalize later seats and keep earlier choices: that biases joint ranges.
 */
export function jointSampler(
  candidates: WeightedCombo[][],
  nextInt: (bound: number) => number,
  maxProposals = 100000,
) {
  const cumulative = candidates.map((list) => {
    let sum = 0;
    return list.map((c) => (sum += c.weight));
  });
  if (candidates.some((c) => !c.length))
    throw Error("A range has no legal combinations after blockers.");
  let proposals = 0;
  return {
    get proposals() {
      return proposals;
    },
    draw(): JointAssignment {
      for (let attempt = 0; attempt < 256; attempt++) {
        if (++proposals > maxProposals)
          throw Error(
            "Joint range sampling budget exhausted. Simplify the ranges; no partial result is returned.",
          );
        const hands: Card[][] = [],
          used = new Set<number>();
        let weight = 1,
          valid = true;
        for (let seat = 0; seat < candidates.length; seat++) {
          const sums = cumulative[seat],
            ticket = nextInt(sums[sums.length - 1]);
          let low = 0,
            high = sums.length - 1;
          while (low < high) {
            const mid = (low + high) >>> 1;
            if (ticket < sums[mid]) high = mid;
            else low = mid + 1;
          }
          const c = candidates[seat][low];
          if (c.cards.some((card) => used.has(code(card)))) {
            valid = false;
            break;
          }
          c.cards.forEach((card) => used.add(code(card)));
          hands.push(c.cards);
          weight *= c.weight;
        }
        if (valid) return { hands, weight };
      }
      throw Error(
        "Ranges overlap too strongly for the rejection budget. No biased fallback or partial result is used.",
      );
    },
  };
}
