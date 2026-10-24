import type { Card } from "../poker";
export const RANKS = "AKQJT98765432".split("");
export const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"] as const;
export type Position = (typeof POSITIONS)[number];
export function matrixClass(row: number, col: number): string {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row > 12 ||
    col > 12
  )
    throw Error("Invalid matrix coordinates");
  return row === col
    ? RANKS[row] + RANKS[col]
    : row < col
      ? RANKS[row] + RANKS[col] + "s"
      : RANKS[col] + RANKS[row] + "o";
}
export const HAND_CLASSES = RANKS.flatMap((_, r) =>
  RANKS.map((_, c) => matrixClass(r, c)),
);
export function handClass(cards: readonly Card[]): string {
  if (
    cards.length !== 2 ||
    cards.some(
      (c) =>
        !Number.isInteger(c.rank) ||
        c.rank < 2 ||
        c.rank > 14 ||
        !Number.isInteger(c.suit) ||
        c.suit < 0 ||
        c.suit > 3,
    ) ||
    (cards[0].rank === cards[1].rank && cards[0].suit === cards[1].suit)
  )
    throw Error("Expected two distinct standard cards");
  const [a, b] = [...cards].sort((a, b) => b.rank - a.rank),
    symbol = (n: number) => "23456789TJQKA"[n - 2];
  return (
    symbol(a.rank) +
    symbol(b.rank) +
    (a.rank === b.rank ? "" : a.suit === b.suit ? "s" : "o")
  );
}
export function exampleCards(hand: string): Card[] {
  if (!HAND_CLASSES.includes(hand)) throw Error("Unknown hand class");
  return [
    { rank: "23456789TJQKA".indexOf(hand[0]) + 2, suit: 0 },
    {
      rank: "23456789TJQKA".indexOf(hand[1]) + 2,
      suit: hand[2] === "s" ? 0 : 1,
    },
  ];
}
const pairs = (low: string) =>
  RANKS.slice(0, RANKS.indexOf(low) + 1).map((r) => r + r);
const family = (high: string, low: string, kind: "s" | "o") =>
  RANKS.slice(RANKS.indexOf(high) + 1, RANKS.indexOf(low) + 1).map(
    (r) => high + r + kind,
  );
const unique = (...parts: string[][]) => [...new Set(parts.flat())];
const utg = unique(
  pairs("7"),
  family("A", "T", "s"),
  ["KQs"],
  family("A", "J", "o"),
  ["KQo"],
);
const hj = unique(
  utg,
  pairs("6"),
  family("A", "8", "s"),
  family("K", "T", "s"),
  ["QTs", "QJs", "JTs", "ATo", "KJo", "QJo"],
);
const co = unique(
  hj,
  pairs("5"),
  family("A", "2", "s"),
  family("K", "8", "s"),
  ["Q9s", "J9s", "T9s", "98s", "A9o", "KTo", "QTo", "JTo"],
);
const btn = unique(
  co,
  pairs("2"),
  family("K", "5", "s"),
  family("Q", "7", "s"),
  ["J8s", "T8s", "97s", "87s", "76s", "65s", "54s"],
  family("A", "2", "o"),
  ["K9o", "Q9o", "J9o", "T9o"],
);
/** Explicit, rake-free teaching samples for unopened pots at ~100 BB, not GTO charts.
 * SB deliberately uses a conservative raise-or-fold sample. BB has no raise-first-in spot.
 */
export const OPENING_RANGES: Record<Position, readonly string[]> = {
  UTG: utg,
  HJ: hj,
  CO: co,
  BTN: btn,
  SB: co,
  BB: [],
};
export function inOpeningRange(position: Position, hand: string) {
  return OPENING_RANGES[position].includes(hand);
}
export function combinations(hand: string) {
  if (!HAND_CLASSES.includes(hand)) throw Error("Unknown hand class");
  return hand.length === 2 ? 6 : hand.endsWith("s") ? 4 : 12;
}
export function rangeCombinations(position: Position) {
  return OPENING_RANGES[position].reduce((n, h) => n + combinations(h), 0);
}
