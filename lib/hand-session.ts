import { act, legal, newHand, type Action, type Game } from "./poker";
export type Origin = {
  seed: number;
  hand: number;
  dealer: number;
  stacks: number[];
};
export type Command = { action: Action; amount?: number };
export type Journal = { origin: Origin; commands: Command[] };
export type TableSession = {
  version: 1;
  active: Journal;
  completed: Journal[];
};
export function originFor(g: Game): Origin {
  return {
    seed: g.seed,
    hand: g.hand,
    dealer: g.dealer,
    stacks: g.players.map(
      (p) =>
        p.chips +
        p.total -
        (g.street === "Showdown" ? g.awards[g.players.indexOf(p)] : 0),
    ),
  };
}
export function startOrigin(o: Origin): Game {
  if (
    !o ||
    !Number.isSafeInteger(o.seed) ||
    o.seed < 0 ||
    o.seed > 4294967295 ||
    !Number.isSafeInteger(o.hand) ||
    o.hand < 1 ||
    !Number.isInteger(o.dealer) ||
    o.dealer < 0 ||
    o.dealer > 3 ||
    !Array.isArray(o.stacks) ||
    o.stacks.length !== 4 ||
    o.stacks.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    o.stacks.reduce((a, b) => a + b, 0) !== 4000 ||
    o.stacks.filter((n) => n > 0).length < 2 ||
    o.stacks[o.dealer] <= 0
  )
    throw Error("Invalid starting hand configuration.");
  const previous = newHand(o.seed);
  previous.players.forEach((p, i) => (p.chips = o.stacks[i]));
  previous.dealer = (o.dealer + 3) % 4;
  previous.hand = o.hand - 1;
  return newHand(o.seed, previous);
}
export function journalFor(g: Game): Journal {
  return { origin: originFor(g), commands: [] };
}
export function restoreJournal(value: unknown): {
  journal: Journal;
  game: Game;
} {
  const j = value as Journal;
  if (!j || !Array.isArray(j.commands) || j.commands.length > 512)
    throw Error("Invalid saved hand history.");
  let game = startOrigin(j.origin);
  const commands: Command[] = [];
  for (const c of j.commands) {
    if (
      !c ||
      !["fold", "check", "call", "bet", "raise"].includes(c.action) ||
      (c.amount !== undefined &&
        (!Number.isSafeInteger(c.amount) || c.amount < 0)) ||
      (c.action !== "bet" && c.action !== "raise" && c.amount !== undefined)
    )
      throw Error("Invalid saved action.");
    game = act(game, c.action, c.amount);
    commands.push(
      c.amount === undefined
        ? { action: c.action }
        : { action: c.action, amount: c.amount },
    );
  }
  const total = game.players.reduce(
    (s, p) => s + p.chips + (game.street === "Showdown" ? 0 : p.total),
    0,
  );
  if (total !== 4000) throw Error("Saved hand violates chip conservation.");
  return {
    journal: {
      origin: {
        seed: j.origin.seed,
        hand: j.origin.hand,
        dealer: j.origin.dealer,
        stacks: [...j.origin.stacks],
      },
      commands,
    },
    game,
  };
}
export function freshSession(g = newHand(2026)): TableSession {
  const j = journalFor(g);
  return {
    version: 1,
    active: j,
    completed: g.street === "Showdown" ? [j] : [],
  };
}
export function validateSession(value: unknown): {
  session: TableSession;
  game: Game;
} {
  const s = value as TableSession;
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.completed) ||
    s.completed.length > 20
  )
    throw Error("Unsupported saved hand format.");
  const active = restoreJournal(s.active);
  const completed = s.completed.map((j) => {
    const r = restoreJournal(j);
    if (r.game.street !== "Showdown")
      throw Error("Replay is not a completed hand.");
    return r.journal;
  });
  return {
    session: { version: 1, active: active.journal, completed },
    game: active.game,
  };
}
export function tableAction(
  s: TableSession,
  game: Game,
  action: Action,
  amount?: number,
) {
  const next = act(game, action, amount),
    command: Command = amount === undefined ? { action } : { action, amount };
  const active = {
    origin: s.active.origin,
    commands: [...s.active.commands, command],
  };
  return {
    game: next,
    session: {
      ...s,
      active,
      completed:
        next.street === "Showdown"
          ? [...s.completed, active].slice(-20)
          : s.completed,
    },
  };
}
export function nextTable(s: TableSession, g: Game) {
  if (g.street !== "Showdown") throw Error("Complete the current hand first.");
  const game =
      g.players[0].chips === 0 ||
      g.players.filter((p) => p.chips > 0).length < 2
        ? newHand(g.seed + 1)
        : newHand(g.seed + 1, g),
    active = journalFor(game);
  return {
    game,
    session: {
      ...s,
      active,
      completed:
        game.street === "Showdown"
          ? [...s.completed, active].slice(-20)
          : s.completed,
    },
  };
}
export type ReplayFrame = {
  street: Game["street"];
  label: string;
  board: Game["board"];
  players: {
    name: string;
    chips: number;
    bet: number;
    folded: boolean;
    cards: Game["board"] | null;
  }[];
  pot: number;
  actor: number;
  actions: Action[];
};
function frame(
  g: Game,
  label: string,
  reveal = g.street === "Showdown",
): ReplayFrame {
  const showdown = reveal && g.players.filter((p) => !p.folded).length > 1;
  return {
    street: g.street,
    label,
    board: structuredClone(g.board),
    players: g.players.map((p, i) => ({
      name: p.name,
      chips: p.chips,
      bet: p.bet,
      folded: p.folded,
      cards:
        !p.cards.length || i === 0 || (showdown && !p.folded)
          ? structuredClone(p.cards)
          : null,
    })),
    pot: g.players.reduce((s, p) => s + p.total, 0),
    actor: g.actor,
    actions: legal(g).actions,
  };
}
export function replayFrames(j: Journal): ReplayFrame[] {
  const verified = restoreJournal(j);
  if (verified.game.street !== "Showdown")
    throw Error("Only completed hands can be replayed.");
  let g = startOrigin(j.origin);
  const frames: ReplayFrame[] = [];
  const streets = ["Preflop", "Flop", "Turn", "River"] as const;
  function runout(before: Game, next: Game, label: string) {
    const balance = structuredClone(next);
    if (next.street === "Showdown")
      balance.players.forEach((p, i) => (p.chips -= next.awards[i]));
    balance.actor = -1;
    balance.street = before.street;
    balance.board = [...before.board];
    balance.players.forEach(
      (p, i) =>
        (p.bet =
          before.players[i].bet +
          next.players[i].total -
          before.players[i].total),
    );
    frames.push(frame(balance, label, false));
    const start = streets.indexOf(before.street as (typeof streets)[number]);
    const end =
      next.street === "Showdown"
        ? next.board.length === 5
          ? 3
          : start
        : streets.indexOf(next.street);
    for (let i = start + 1; i <= end; i++) {
      balance.street = streets[i];
      balance.board = next.board.slice(0, i + 2);
      balance.players.forEach((p) => (p.bet = 0));
      frames.push(frame(balance, `${streets[i]} revealed`, false));
    }
    frames.push(
      frame(
        next,
        next.street === "Showdown"
          ? next.players.filter((p) => !p.folded).length > 1
            ? "Contested showdown: eligible hands revealed"
            : "Uncontested hand settled; opponent cards stay concealed"
          : `${next.street}: next decision`,
      ),
    );
  }
  if (g.street === "Showdown") {
    const before = structuredClone(g);
    before.street = "Preflop";
    before.board = [];
    before.players.forEach((p) => (p.bet = p.total));
    runout(before, g, "Blinds all-in; no further decision");
  } else frames.push(frame(g, "Preflop: blinds posted"));
  for (const c of j.commands) {
    const before = g;
    g = act(g, c.action, c.amount);
    const label = `${before.players[before.actor].name} ${c.action}${c.amount !== undefined ? ` to ${c.amount}` : c.action === "call" ? ` ${legal(before).call}` : ""}`;
    if (g.street !== before.street) runout(before, g, label);
    else frames.push(frame(g, label));
  }
  return frames;
}
