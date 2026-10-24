export type Card = { rank: number; suit: number };
export const ranks = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
export function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
function five(cards: Card[]): number[] {
  const rs = cards.map((c) => c.rank).sort((a, b) => b - a),
    counts = new Map<number, number>();
  rs.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const unique = [...new Set(rs)];
  if (unique.includes(14)) unique.push(1);
  let straight = 0;
  for (let i = 0; i <= unique.length - 5; i++)
    if (unique[i] - unique[i + 4] === 4) {
      straight = unique[i];
      break;
    }
  const flush = cards.every((c) => c.suit === cards[0].suit);
  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2)
    return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...rs];
  if (straight) return [4, straight];
  if (groups[0][1] === 3)
    return [3, groups[0][0], ...groups.slice(1).map((g) => g[0])];
  if (groups[0][1] === 2 && groups[1][1] === 2)
    return [2, ...groups.slice(0, 2).map((g) => g[0]), groups[2][0]];
  if (groups[0][1] === 2)
    return [1, groups[0][0], ...groups.slice(1).map((g) => g[0])];
  return [0, ...rs];
}
export function evaluate(cards: Card[]): number[] {
  if (cards.length < 5 || cards.length > 7) throw Error("Evaluate 5–7 cards");
  let best: number[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const v = five([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (compare(v, best) > 0) best = v;
          }
  return best;
}
export function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function deck(seed: number): Card[] {
  const d: Card[] = [];
  for (let suit = 0; suit < 4; suit++)
    for (let rank = 2; rank <= 14; rank++) d.push({ rank, suit });
  const rng = random(seed);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
export type Profile =
  "You" | "Tight-passive" | "Loose-aggressive" | "Tight-aggressive";
export type Player = {
  name: string;
  profile: Profile;
  chips: number;
  cards: Card[];
  folded: boolean;
  bet: number;
  total: number;
};
export type Action = "fold" | "check" | "call" | "bet" | "raise";
export type Game = {
  seed: number;
  hand: number;
  dealer: number;
  players: Player[];
  board: Card[];
  deck: Card[];
  street: "Preflop" | "Flop" | "Turn" | "River" | "Showdown";
  actor: number;
  currentBet: number;
  minRaise: number;
  pending: number[];
  raiseRights: number[];
  actedAt: number[];
  log: string[];
  winners: number[];
  awards: number[];
  feedback: string;
};
const active = (g: Game) =>
  g.players
    .map((p, i) => (!p.folded && p.chips > 0 ? i : -1))
    .filter((i) => i >= 0);
function after(indices: number[], seat: number) {
  return [...indices].sort(
    (a, b) => ((a - seat + 3) % 4) - ((b - seat + 3) % 4),
  );
}
function pay(g: Game, i: number, n: number) {
  const p = g.players[i],
    v = Math.min(n, p.chips);
  p.chips -= v;
  p.bet += v;
  p.total += v;
}
export function newHand(seed = 42, previous?: Game): Game {
  const players: Player[] = previous
    ? previous.players.map((p) => ({
        ...p,
        cards: [],
        folded: p.chips === 0,
        bet: 0,
        total: 0,
      }))
    : [
        { name: "You", profile: "You" },
        { name: "Maya", profile: "Tight-passive" },
        { name: "Atlas", profile: "Loose-aggressive" },
        { name: "Theo", profile: "Tight-aggressive" },
      ].map((p) => ({
        ...p,
        profile: p.profile as Profile,
        chips: 1000,
        cards: [],
        folded: false,
        bet: 0,
        total: 0,
      }));
  if (players.filter((p) => p.chips > 0).length < 2)
    throw Error("Session complete. Start a new session.");
  const seats = players
    .map((p, i) => (p.chips > 0 ? i : -1))
    .filter((i) => i >= 0);
  const dealer = previous ? after(seats, previous.dealer)[0] : 0;
  const ordered = after(seats, dealer);
  const sb = seats.length === 2 ? dealer : ordered[0],
    bb = seats.length === 2 ? ordered[0] : ordered[1];
  const g: Game = {
    seed,
    hand: (previous?.hand ?? 0) + 1,
    dealer,
    players,
    board: [],
    deck: deck(seed),
    street: "Preflop",
    actor: 0,
    currentBet: 20,
    minRaise: 20,
    pending: [],
    raiseRights: [],
    actedAt: [-1, -1, -1, -1],
    log: [],
    winners: [],
    awards: [0, 0, 0, 0],
    feedback: "",
  };
  for (let round = 0; round < 2; round++)
    for (const i of ordered) players[i].cards.push(g.deck.pop()!);
  pay(g, sb, 10);
  pay(g, bb, 20);
  g.log = [
    `${players[sb].name} posts ${players[sb].bet} · small blind`,
    `${players[bb].name} posts ${players[bb].bet} · big blind`,
  ];
  g.pending = after(active(g), bb);
  g.raiseRights = [...g.pending];
  g.actor = g.pending[0] ?? -1;
  advance(g);
  return g;
}
export function legal(g: Game) {
  const p = g.players[g.actor];
  if (!p || g.street === "Showdown")
    return {
      call: 0,
      min: 0,
      max: 0,
      canRaise: false,
      actions: [] as Action[],
    };
  const call = Math.min(p.chips, g.currentBet - p.bet);
  const max = p.bet + p.chips;
  const canRaise =
    g.raiseRights.includes(g.actor) &&
    max > g.currentBet &&
    active(g).length > 1;
  return {
    call,
    min: g.currentBet === 0 ? 20 : g.currentBet + g.minRaise,
    max,
    canRaise,
    actions: [
      "fold",
      call ? "call" : "check",
      ...(canRaise ? [g.currentBet ? "raise" : "bet"] : []),
    ] as Action[],
  };
}
export function act(state: Game, action: Action, amount?: number): Game {
  const g = structuredClone(state),
    i = g.actor,
    p = g.players[i],
    l = legal(g);
  if (!l.actions.includes(action)) throw Error("Illegal action");
  g.pending = g.pending.filter((s) => s !== i);
  g.raiseRights = g.raiseRights.filter((s) => s !== i);
  if (action === "fold") p.folded = true;
  else if (action === "call") pay(g, i, l.call);
  else if (action === "bet" || action === "raise") {
    if (
      !Number.isInteger(amount) ||
      amount! > l.max ||
      amount! <= g.currentBet ||
      (amount! < l.min && amount !== l.max)
    )
      throw Error("Invalid bet size");
    const increase = amount! - g.currentBet;
    pay(g, i, amount! - p.bet);
    g.currentBet = amount!;
    if (increase >= g.minRaise) {
      g.minRaise = increase;
      g.pending = after(
        active(g).filter((s) => s !== i),
        i,
      );
      g.raiseRights = [...g.pending];
    } else
      g.pending = after(
        [
          ...new Set([
            ...g.pending,
            ...active(g).filter(
              (s) => s !== i && g.players[s].bet < g.currentBet,
            ),
          ]),
        ],
        i,
      );
  }
  g.actedAt[i] = g.currentBet;
  g.raiseRights = [
    ...new Set([
      ...g.raiseRights,
      ...active(g).filter(
        (s) =>
          s !== i &&
          g.actedAt[s] >= 0 &&
          g.currentBet - g.actedAt[s] >= g.minRaise,
      ),
    ]),
  ];
  g.log.push(
    `${p.name} ${action}${action === "call" ? ` ${l.call}` : action === "bet" || action === "raise" ? ` to ${amount}` : ""}`,
  );
  g.pending = g.pending.filter(
    (s) => !g.players[s].folded && g.players[s].chips > 0,
  );
  advance(g);
  return g;
}
function advance(g: Game) {
  if (g.players.filter((p) => !p.folded).length === 1) {
    settle(g);
    return;
  }
  // An unmatched all-in must still be called or folded; otherwise run out the board.
  if (active(g).length <= 1) {
    // A short big blind does not force the last solvent player to pay a
    // nominal full blind into an uncontestable pot.
    g.currentBet = Math.max(
      ...g.players.filter((p) => !p.folded).map((p) => p.bet),
    );
    g.pending = g.pending.filter((i) => g.players[i].bet < g.currentBet);
  }
  if (g.pending.length) {
    g.actor = g.pending[0];
    return;
  }
  if (g.street === "River") {
    settle(g);
    return;
  }
  g.deck.pop();
  const count = g.street === "Preflop" ? 3 : 1;
  for (let i = 0; i < count; i++) g.board.push(g.deck.pop()!);
  g.street =
    g.street === "Preflop" ? "Flop" : g.street === "Flop" ? "Turn" : "River";
  g.players.forEach((p) => (p.bet = 0));
  g.currentBet = 0;
  g.minRaise = 20;
  g.actedAt = [-1, -1, -1, -1];
  g.log.push(`— ${g.street} —`);
  g.pending = after(active(g), g.dealer);
  g.raiseRights = [...g.pending];
  advance(g);
}
export function settle(g: Game) {
  const levels = [
    ...new Set(g.players.map((p) => p.total).filter(Boolean)),
  ].sort((a, b) => a - b);
  let prior = 0;
  const awards = [0, 0, 0, 0];
  for (const level of levels) {
    const contributors = g.players
      .map((p, i) => (p.total >= level ? i : -1))
      .filter((i) => i >= 0);
    const pot = (level - prior) * contributors.length;
    prior = level;
    const eligible = contributors.filter((i) => !g.players[i].folded);
    if (!eligible.length) throw Error("Pot has no eligible player");
    let winners = eligible;
    if (eligible.length > 1) {
      const values = eligible.map((i) =>
        evaluate([...g.players[i].cards, ...g.board]),
      );
      let best = values[0];
      values.forEach((v) => {
        if (compare(v, best) > 0) best = v;
      });
      winners = eligible.filter((_, j) => compare(values[j], best) === 0);
    }
    const order = after(winners, g.dealer);
    order.forEach(
      (i, j) =>
        (awards[i] +=
          Math.floor(pot / order.length) + (j < pot % order.length ? 1 : 0)),
    );
  }
  g.awards = awards;
  g.winners = awards
    .map((v, i) => (v > g.players[i].total ? i : -1))
    .filter((i) => i >= 0);
  awards.forEach((v, i) => (g.players[i].chips += v));
  g.street = "Showdown";
  g.actor = -1;
  g.pending = [];
  const live = g.players.filter((p) => !p.folded);
  g.feedback =
    live.length === 1
      ? `${live[0].name} wins uncontested. Position and well-timed aggression can win pots without a showdown.`
      : `${awards
          .map((v, i) => (v ? `${g.players[i].name} receives ${v}` : ""))
          .filter(Boolean)
          .join(
            " · ",
          )}. Compare the best five cards; unused cards never break a tie.`;
  g.log.push(g.feedback);
}
export function botAction(g: Game): { action: Action; amount?: number } {
  const p = g.players[g.actor],
    l = legal(g),
    r = random(g.seed + g.log.length * 7919)();
  const [a, b] = p.cards;
  const strength = g.board.length
    ? evaluate([...p.cards, ...g.board])[0] / 8 + 0.22
    : (Math.max(a.rank, b.rank) / 14) * 0.35 +
      (a.rank === b.rank ? 0.4 : 0) +
      (a.suit === b.suit ? 0.1 : 0);
  const aggressive = p.profile === "Loose-aggressive";
  const tight = p.profile !== "Loose-aggressive";
  if (l.call && tight && strength < 0.36 && r < 0.75) return { action: "fold" };
  if (
    l.canRaise &&
    r < (aggressive ? 0.48 : p.profile === "Tight-aggressive" ? 0.26 : 0.06) &&
    (!tight || strength > 0.4)
  ) {
    return {
      action: g.currentBet ? "raise" : "bet",
      amount: Math.min(
        l.max,
        Math.max(
          l.min,
          g.currentBet +
            Math.max(
              20,
              Math.floor(
                (g.players.reduce((s, p) => s + p.total, 0) * 0.55) / 10,
              ) * 10,
            ),
        ),
      ),
    };
  }
  return { action: l.call ? "call" : "check" };
}
export function position(g: Game, i: number) {
  const seats = g.players
    .map((p, j) => (p.cards.length ? j : -1))
    .filter((j) => j >= 0);
  if (!seats.includes(i)) return "OUT";
  if (seats.length === 2) return i === g.dealer ? "BTN / SB" : "BB";
  if (i === g.dealer) return "BTN";
  const order = after(seats, g.dealer);
  return i === order[0] ? "SB" : i === order[1] ? "BB" : "UTG";
}
