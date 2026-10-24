import type { Card } from "../poker";
import { analyzeTexture, validateCards, parseCards } from "../postflop/texture";
import { fullDeck, showdownShares } from "./engine";
export type Completion = {
  card: Card;
  flush: boolean;
  straight: boolean;
  status: "unknown" | "wins" | "ties" | "loses";
};
/** Pattern completions, not generic equity outs. A clean showdown result can
 * only be certified for the river with every opponent's cards specified.
 */
export function drawReport(
  hero: Card[],
  board: Card[],
  opponents: (Card[] | null)[] = [],
) {
  if (
    hero.length !== 2 ||
    ![3, 4].includes(board.length) ||
    opponents.length > 5 ||
    opponents.some((h) => h !== null && h.length !== 2)
  )
    throw Error("Use two hole cards and a flop or turn for draw analysis.");
  validateCards([...hero, ...board, ...opponents.flatMap((h) => h ?? [])]);
  const current = analyzeTexture(board, hero),
    known = [...hero, ...board, ...opponents.flatMap((h) => h ?? [])],
    available = fullDeck().filter(
      (c) => !known.some((k) => k.rank === c.rank && k.suit === c.suit),
    ),
    canCertify =
      board.length === 4 &&
      opponents.length > 0 &&
      opponents.every((h) => h !== null);
  const outs: Completion[] = [];
  for (const card of available) {
    const next = analyzeTexture([...board, card], hero),
      flush = !current.madeFlush && next.madeFlush,
      straight = !current.madeStraight && next.madeStraight;
    if (!flush && !straight) continue;
    let status: Completion["status"] = "unknown";
    if (canCertify) {
      const share = showdownShares(
        [hero, ...(opponents as Card[][])],
        [...board, card],
      )[0];
      status = share === 1 ? "wins" : share > 0 ? "ties" : "loses";
    }
    outs.push({ card, flush, straight, status });
  }
  const completingRanks = [
      ...new Set(outs.filter((o) => o.straight).map((o) => o.card.rank)),
    ],
    rs = new Set([...hero, ...board].map((c) => c.rank));
  const rank = (r: number) => (r === 1 ? 14 : r);
  let openEnded = false;
  for (let start = 2; start <= 10; start++) {
    const four = Array.from({ length: 4 }, (_, i) => start + i);
    if (
      four.every((r) => rs.has(r)) &&
      completingRanks.includes(rank(start - 1)) &&
      completingRanks.includes(start + 4)
    )
      openEnded = true;
  }
  const straightKind =
    completingRanks.length === 0
      ? "None"
      : openEnded
        ? "Open-ended"
        : completingRanks.length >= 2
          ? "Double gutshot"
          : "Gutshot / one-rank completion";
  return {
    outs,
    unseen: available.length,
    flushCount: outs.filter((o) => o.flush).length,
    straightCount: outs.filter((o) => o.straight).length,
    overlap: outs.filter((o) => o.flush && o.straight).length,
    total: outs.length,
    straightKind,
    canCertify,
    clean: outs.filter((o) => o.status === "wins"),
    uncertain: outs.filter((o) => o.status !== "wins"),
    combination: outs.some((o) => o.flush) && outs.some((o) => o.straight),
  };
}
export function fixedOutsProbability(
  outs: number,
  unseen: number,
  cardsToCome: 1 | 2,
) {
  if (
    !Number.isInteger(outs) ||
    !Number.isInteger(unseen) ||
    unseen < cardsToCome ||
    outs < 0 ||
    outs > unseen ||
    ![1, 2].includes(cardsToCome)
  )
    throw Error("Invalid fixed-outs probability input.");
  const miss = unseen - outs;
  if (cardsToCome === 1) return outs / unseen;
  return 1 - (miss * Math.max(0, miss - 1)) / (unseen * (unseen - 1));
}
export const DRAW_EXERCISES = [
  {
    id: "flush-nine",
    name: "The four-spade draw",
    hero: parseCards("As Qs"),
    board: parseCards("Js 7s 2d"),
    answer: 9,
    options: [4, 8, 9, 12],
    why: "Thirteen spades exist, four are visible, so nine unseen spades complete a flush. They are pattern-completing candidates, not nine guaranteed winning outs.",
  },
  {
    id: "open-eight",
    name: "Two ends to the straight",
    hero: parseCards("8s 7d"),
    board: parseCards("6c 5h Kd"),
    answer: 8,
    options: [4, 6, 8, 9],
    why: "Any four or nine completes a straight: four cards of each rank, eight total. An opponent can still have or later make a stronger hand.",
  },
  {
    id: "gut-four",
    name: "One missing rank",
    hero: parseCards("As Qd"),
    board: parseCards("Jc Th 2s"),
    answer: 4,
    options: [4, 8, 9, 12],
    why: "Only a king completes the Broadway straight on the next card. There are four unseen kings; ace-high is not already a straight.",
  },
  {
    id: "combo-fifteen",
    name: "Count the overlap once",
    hero: parseCards("8s 7s"),
    board: parseCards("6s 5s Kd"),
    answer: 15,
    options: [12, 15, 17, 20],
    why: "Nine spades complete a flush and eight fours/nines complete a straight. The four and nine of spades appear in both lists: 9 + 8 − 2 = 15 distinct cards.",
  },
  {
    id: "double-gut",
    name: "Two inside completions",
    hero: parseCards("Js 9d"),
    board: parseCards("8c 7h 5s"),
    answer: 8,
    options: [4, 6, 8, 9],
    why: "A six completes 5–9, while a ten completes 7–J. Those are two inside gaps, not the two ends of four consecutive ranks: a double gutshot.",
  },
] as const;
