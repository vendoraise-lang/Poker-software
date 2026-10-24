import { evaluate, ranks, type Card } from "../poker";
export function validateCards(cards: readonly Card[]) {
  if (
    cards.some(
      (c) =>
        !c ||
        !Number.isInteger(c.rank) ||
        c.rank < 2 ||
        c.rank > 14 ||
        !Number.isInteger(c.suit) ||
        c.suit < 0 ||
        c.suit > 3,
    ) ||
    new Set(cards.map((c) => `${c.rank}:${c.suit}`)).size !== cards.length
  )
    throw Error("Use distinct cards from a standard deck.");
}
export function parseCards(input: string): Card[] {
  const tokens = input.trim().split(/[ ,]+/).filter(Boolean);
  const cards = tokens.map((token) => {
    const t = token.replace(/^10/, "T").toUpperCase();
    if (!/^[2-9TJQKA][SHDC]$/.test(t))
      throw Error("Use cards like As Kh Td, with s/h/d/c suits.");
    return {
      rank: "23456789TJQKA".indexOf(t[0]) + 2,
      suit: "SHDC".indexOf(t[1]),
    };
  });
  validateCards(cards);
  return cards;
}
function windows() {
  return Array.from({ length: 10 }, (_, i) =>
    i === 0 ? [14, 2, 3, 4, 5] : Array.from({ length: 5 }, (_, j) => i + j + 1),
  );
}
function hasStraight(rs: Set<number>) {
  return windows().some((w) => w.every((r) => rs.has(r)));
}
export function analyzeTexture(board: Card[], hole: Card[] = []) {
  if (
    board.length < 3 ||
    board.length > 5 ||
    (hole.length !== 0 && hole.length !== 2)
  )
    throw Error("Analyze a 3–5 card board and optionally two hole cards.");
  validateCards([...board, ...hole]);
  const suits = [0, 1, 2, 3].map(
      (s) => board.filter((c) => c.suit === s).length,
    ),
    uniqueSuits = suits.filter(Boolean).length,
    uniqueRanks = new Set(board.map((c) => c.rank)),
    paired = uniqueRanks.size < board.length;
  const connected = Math.max(
    ...windows().map((w) => w.filter((r) => uniqueRanks.has(r)).length),
  );
  const suitLabel =
    uniqueSuits === 1
      ? "Monotone"
      : uniqueSuits === 2
        ? "Two-tone"
        : uniqueSuits === board.length
          ? "Rainbow"
          : uniqueSuits === 3
            ? "Three suits"
            : "Four suits";
  const wet =
    suits.some((n) => n >= (board.length < 5 ? 2 : 3)) || connected >= 3;
  const all = [...board, ...hole],
    rs = new Set(all.map((c) => c.rank)),
    madeStraight = hasStraight(rs),
    allSuits = [0, 1, 2, 3].map((s) => all.filter((c) => c.suit === s).length),
    madeFlush = allSuits.some((n) => n >= 5);
  const canDraw = board.length < 5;
  const straightRanks =
    hole.length && canDraw && !madeStraight
      ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].filter(
          (r) => !rs.has(r) && hasStraight(new Set([...rs, r])),
        )
      : [];
  const flushDraw =
    hole.length === 2 && canDraw && !madeFlush && allSuits.some((n) => n === 4);
  return {
    paired,
    suitLabel,
    connected,
    wet,
    canDraw,
    possibleStraight: connected >= 3,
    possibleFlush: suits.some((n) => n >= 3),
    possibleFlushDraw: canDraw && suits.some((n) => n >= 2),
    flushDraw,
    straightRanks,
    made: hole.length ? ranks[evaluate(all)[0]] : null,
    madeStraight: hole.length > 0 && madeStraight,
    madeFlush: hole.length > 0 && madeFlush,
  };
}
