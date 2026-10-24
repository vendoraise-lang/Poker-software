import { compare, evaluate, type Card } from "../poker";
import { validateCards } from "../postflop/texture";
import {
  validateRange,
  expandRange,
  scanJoint,
  jointSampler,
  type WeightedRange,
} from "./ranges";
export const MAX_SAMPLES = 50000;
export const MAX_EXACT = 50000;
export const MAX_EVALUATIONS = 120000;
export type EquityInput = {
  hero: Card[];
  board: Card[];
  opponents: (Card[] | null)[];
  seed: number;
  samples: number;
  mode?: "auto" | "exact" | "monte-carlo";
  ranges?: (WeightedRange | null)[];
};
export type Interval = { low: number; high: number };
export type PlayerResult = {
  win: number;
  tie: number;
  loss: number;
  equity: number;
  winInterval: Interval;
  tieInterval: Interval;
  lossInterval: Interval;
  equityInterval: Interval;
};
export type EquityResult = {
  method: "exact" | "monte-carlo";
  samples: number;
  possibleOutcomes: string;
  seed: number;
  players: PlayerResult[];
  confidence: number | null;
  complete: true;
  input: EquityInput;
};
export type EquityProgress = {
  completed: number;
  total: number;
  method: EquityResult["method"];
  possibleOutcomes: string;
};
export const fullDeck = (): Card[] =>
  Array.from({ length: 52 }, (_, i) => ({
    rank: (i % 13) + 2,
    suit: Math.floor(i / 13),
  }));
export function combinations(n: number, k: number): bigint {
  if (
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(k) ||
    n < 0 ||
    k < 0 ||
    k > n
  )
    return 0n;
  let r = 1n;
  for (let i = 1; i <= Math.min(k, n - k); i++)
    r = (r * BigInt(n - i + 1)) / BigInt(i);
  return r;
}
export function validateEquity(input: EquityInput): EquityInput {
  if (
    !input ||
    !Array.isArray(input.hero) ||
    input.hero.length !== 2 ||
    !Array.isArray(input.board) ||
    ![0, 3, 4, 5].includes(input.board.length) ||
    !Array.isArray(input.opponents) ||
    input.opponents.length < 1 ||
    input.opponents.length > 5 ||
    input.opponents.some(
      (h) => h !== null && (!Array.isArray(h) || h.length !== 2),
    )
  )
    throw Error(
      "Use two hero cards, 0/3/4/5 board cards, and 1–5 opponents with two known cards or a random hand.",
    );
  const cards = [
    ...input.hero,
    ...input.board,
    ...input.opponents.flatMap((h) => h ?? []),
  ];
  validateCards(cards);
  if (
    !Number.isSafeInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 0xffffffff
  )
    throw Error("Seed must be an integer from 0 to 4,294,967,295.");
  if (
    !Number.isSafeInteger(input.samples) ||
    input.samples < 1 ||
    input.samples > MAX_SAMPLES
  )
    throw Error(
      `Sample count must be an integer from 1 to ${MAX_SAMPLES.toLocaleString("en-US")}.`,
    );
  if (
    input.mode !== undefined &&
    !["auto", "exact", "monte-carlo"].includes(input.mode)
  )
    throw Error("Unknown calculation method.");
  if (
    input.ranges !== undefined &&
    (!Array.isArray(input.ranges) ||
      input.ranges.length !== input.opponents.length)
  )
    throw Error("Assign one range or null per opponent.");
  const ranges = input.ranges
    ? Array.from(input.ranges).map((r, i) => {
        if (r === null) return null;
        if (input.opponents[i] !== null)
          throw Error("A known hand cannot also have a range.");
        return validateRange(r);
      })
    : undefined;
  const needed =
    5 -
    input.board.length +
    input.opponents.filter((h) => h === null).length * 2;
  if (needed > 52 - cards.length)
    throw Error("Not enough unseen cards to complete this deal.");
  return {
    hero: input.hero.map((c) => ({ ...c })),
    board: input.board.map((c) => ({ ...c })),
    opponents: input.opponents.map((h) => h?.map((c) => ({ ...c })) ?? null),
    seed: input.seed,
    samples: input.samples,
    mode: input.mode ?? "auto",
    ...(ranges ? { ranges } : {}),
  };
}
export function outcomeSpace(input: EquityInput): bigint {
  const s = validateEquity(input);
  if (s.ranges?.some(Boolean))
    throw Error("Use createEquityJob to count capped weighted support.");
  let remaining =
    52 -
    s.hero.length -
    s.board.length -
    s.opponents.flatMap((h) => h ?? []).length;
  const boardMissing = 5 - s.board.length;
  let total = combinations(remaining, boardMissing);
  remaining -= boardMissing;
  for (const h of s.opponents)
    if (h === null) {
      total *= combinations(remaining, 2);
      remaining -= 2;
    }
  return total;
}
/** xoshiro128** with SplitMix-style 32-bit expansion. Integer rejection here
 * removes modulo bias in a bounded RNG; no illegal card deals are rejected.
 * This is reproducible pseudorandom sampling, not cryptographic randomness.
 */
export function seededIntegers(seed: number) {
  let x = seed >>> 0;
  const expand = () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  let a = expand(),
    b = expand(),
    c = expand(),
    d = expand();
  const rot = (v: number, k: number) => (v << k) | (v >>> (32 - k));
  const next = () => {
    const result = Math.imul(rot(Math.imul(b, 5), 7), 9) >>> 0,
      t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rot(d, 11);
    return result;
  };
  return (bound: number) => {
    if (!Number.isInteger(bound) || bound < 1 || bound > 4294967296)
      throw Error("Invalid sampling bound.");
    const limit = Math.floor(4294967296 / bound) * bound;
    let v;
    do {
      v = next();
    } while (v >= limit);
    return v % bound;
  };
}
export function sampleWithoutReplacement(
  deck: readonly Card[],
  count: number,
  nextInt: (bound: number) => number,
): Card[] {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > deck.length ||
    deck.length > 52
  )
    throw Error("Invalid draw size.");
  const pool = [...deck];
  for (let i = 0; i < count; i++) {
    const j = i + nextInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
export function showdownShares(hands: Card[][], board: Card[]) {
  if (
    hands.length < 2 ||
    hands.length > 6 ||
    board.length !== 5 ||
    hands.some((h) => h.length !== 2)
  )
    throw Error("Complete 2–6 player showdown required.");
  validateCards([...board, ...hands.flat()]);
  const values = hands.map((h) => evaluate([...h, ...board]));
  let best = values[0];
  for (const v of values) if (compare(v, best) > 0) best = v;
  const winners = values
    .map((v, i) => (compare(v, best) === 0 ? i : -1))
    .filter((i) => i >= 0);
  return hands.map((_, i) => (winners.includes(i) ? 1 / winners.length : 0));
}
function* choose(
  pool: readonly Card[],
  count: number,
  start = 0,
  prefix: Card[] = [],
): Generator<Card[]> {
  if (count === 0) {
    yield prefix;
    return;
  }
  for (let i = start; i <= pool.length - count; i++)
    yield* choose(pool, count - 1, i + 1, [...prefix, pool[i]]);
}
const id = (c: Card) => c.suit * 13 + c.rank - 2;
function remaining(pool: readonly Card[], removed: readonly Card[]) {
  const ids = new Set(removed.map(id));
  return pool.filter((c) => !ids.has(id(c)));
}
function* exactDeals(
  s: EquityInput,
  pool: Card[],
): Generator<{ hands: Card[][]; board: Card[] }> {
  for (const extra of choose(pool, 5 - s.board.length)) {
    const board = [...s.board, ...extra];
    function* opponents(
      i: number,
      available: Card[],
      hands: Card[][],
    ): Generator<{ hands: Card[][]; board: Card[] }> {
      if (i === s.opponents.length) {
        yield { hands: [s.hero, ...hands], board };
        return;
      }
      const hand = s.opponents[i];
      if (hand) yield* opponents(i + 1, available, [...hands, hand]);
      else
        for (const pair of choose(available, 2))
          yield* opponents(i + 1, remaining(available, pair), [...hands, pair]);
    }
    yield* opponents(0, remaining(pool, extra), []);
  }
}
export function wilson(successes: number, n: number): Interval {
  const z = 1.959963984540054,
    z2 = z * z,
    p = successes / n,
    den = 1 + z2 / n,
    center = (p + z2 / (2 * n)) / den,
    radius = (z / den) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    low: Math.max(0, center - radius),
    high: Math.min(1, center + radius),
  };
}
export function createEquityJob(raw: EquityInput) {
  const input = validateEquity(raw);
  if (input.ranges?.some(Boolean)) return createRangeJob(input);
  const space = outcomeSpace(input),
    players = input.opponents.length + 1,
    tractable =
      space <= BigInt(MAX_EXACT) &&
      space * BigInt(players) <= BigInt(MAX_EVALUATIONS);
  if (input.mode === "exact" && !tractable)
    throw Error(
      "Exact enumeration exceeds the capped workload. Use automatic selection or Monte Carlo.",
    );
  const method =
    input.mode === "monte-carlo"
      ? "monte-carlo"
      : tractable
        ? "exact"
        : "monte-carlo";
  if (method === "monte-carlo" && input.samples * players > MAX_EVALUATIONS)
    throw Error(
      `For ${players} players use at most ${Math.floor(MAX_EVALUATIONS / players).toLocaleString("en-US")} samples.`,
    );
  const total = method === "exact" ? Number(space) : input.samples,
    pool = remaining(fullDeck(), [
      ...input.hero,
      ...input.board,
      ...input.opponents.flatMap((h) => h ?? []),
    ]),
    nextInt = seededIntegers(input.seed),
    iterator = method === "exact" ? exactDeals(input, pool) : null,
    stats = Array.from({ length: players }, () => ({
      wins: 0,
      ties: 0,
      losses: 0,
      share: 0,
    }));
  let completed = 0;
  function trial() {
    if (iterator) {
      const next = iterator.next();
      if (next.done) throw Error("Enumeration ended before expected count.");
      return next.value;
    }
    const drawn = sampleWithoutReplacement(
        pool,
        5 - input.board.length + input.opponents.filter((h) => !h).length * 2,
        nextInt,
      ),
      board = [...input.board, ...drawn.slice(0, 5 - input.board.length)];
    let cursor = 5 - input.board.length;
    return {
      board,
      hands: [
        input.hero,
        ...input.opponents.map((h) => {
          if (h) return h;
          const pair = drawn.slice(cursor, cursor + 2);
          cursor += 2;
          return pair;
        }),
      ],
    };
  }
  const progress = (): EquityProgress => ({
    completed,
    total,
    method,
    possibleOutcomes: space.toString(),
  });
  return {
    input,
    progress,
    step(batch = 50) {
      if (!Number.isInteger(batch) || batch < 1 || batch > 500)
        throw Error("Batch size must be 1–500.");
      const end = Math.min(total, completed + batch);
      while (completed < end) {
        const deal = trial(),
          shares = showdownShares(deal.hands, deal.board);
        shares.forEach((share, i) => {
          stats[i].share += share;
          if (share === 1) stats[i].wins++;
          else if (share > 0) stats[i].ties++;
          else stats[i].losses++;
        });
        completed++;
      }
      return progress();
    },
    result(): EquityResult {
      if (completed !== total)
        throw Error(
          "Incomplete jobs are not equity results. A prefix of an exact enumeration is biased.",
        );
      return {
        method,
        samples: completed,
        possibleOutcomes: space.toString(),
        seed: input.seed,
        confidence: method === "exact" ? null : 0.95,
        complete: true,
        input,
        players: stats.map((st) => {
          const win = st.wins / completed,
            tie = st.ties / completed,
            loss = st.losses / completed,
            equity = st.share / completed,
            epsilon = Math.sqrt(Math.log(40) / (2 * completed)),
            point = (v: number) => ({ low: v, high: v });
          return {
            win,
            tie,
            loss,
            equity,
            winInterval:
              method === "exact" ? point(win) : wilson(st.wins, completed),
            tieInterval:
              method === "exact" ? point(tie) : wilson(st.ties, completed),
            lossInterval:
              method === "exact" ? point(loss) : wilson(st.losses, completed),
            equityInterval:
              method === "exact"
                ? point(equity)
                : {
                    low: Math.max(0, equity - epsilon),
                    high: Math.min(1, equity + epsilon),
                  },
          };
        }),
      };
    },
  };
}
export async function runEquity(
  input: EquityInput,
  options: {
    signal?: AbortSignal;
    onProgress?: (p: EquityProgress) => void;
    yieldControl?: () => Promise<void>;
    batch?: number;
  } = {},
): Promise<EquityResult> {
  const job = createEquityJob(input),
    check = () => {
      if (options.signal?.aborted)
        throw new DOMException("Calculation cancelled.", "AbortError");
    };
  check();
  options.onProgress?.(job.progress());
  while (job.progress().completed < job.progress().total) {
    check();
    job.step(options.batch ?? 50);
    options.onProgress?.(job.progress());
    if (job.progress().completed < job.progress().total)
      await (options.yieldControl?.() ??
        new Promise<void>((resolve) => setTimeout(resolve, 0)));
  }
  check();
  return job.result();
}

function createRangeJob(input: EquityInput) {
  const players = input.opponents.length + 1,
    blocked = [
      ...input.hero,
      ...input.board,
      ...input.opponents.flatMap((h) => h ?? []),
    ],
    pool = remaining(fullDeck(), blocked),
    unknown = input.opponents
      .map((h, i) => (h === null ? i : -1))
      .filter((i) => i >= 0),
    candidates = unknown.map((i) =>
      expandRange(input.ranges?.[i] ?? null, blocked),
    );
  if (candidates.some((c) => !c.length))
    throw Error("A weighted range has no legal combinations after blockers.");
  const boards = combinations(
      pool.length - unknown.length * 2,
      5 - input.board.length,
    ),
    limit = Math.min(MAX_EXACT, Math.floor(MAX_EVALUATIONS / players)),
    maxAssignments =
      boards > BigInt(limit) ? 1 : Math.floor(limit / Number(boards));
  const scan = scanJoint(candidates, maxAssignments);
  if (scan.complete && !scan.assignments.length)
    throw Error("The opponent ranges have no jointly compatible hands.");
  if (!scan.assignments.length)
    throw Error(
      "Range compatibility could not be established within the planning budget. Simplify the ranges.",
    );
  const tractable =
    scan.complete && BigInt(scan.assignments.length) * boards <= BigInt(limit);
  if (input.mode === "exact" && !tractable)
    throw Error("Weighted exact enumeration exceeds the capped workload.");
  const method =
    input.mode === "monte-carlo"
      ? "monte-carlo"
      : tractable
        ? "exact"
        : "monte-carlo";
  if (method === "monte-carlo" && input.samples * players > MAX_EVALUATIONS)
    throw Error("Weighted simulation exceeds the player-evaluation cap.");
  const total =
      method === "exact"
        ? scan.assignments.length * Number(boards)
        : input.samples,
    space = tractable
      ? String(scan.assignments.length * Number(boards))
      : "weighted support; count exceeds planning cap",
    nextInt = seededIntegers(input.seed),
    sampler = jointSampler(candidates, nextInt),
    stats = Array.from({ length: players }, () => ({
      win: 0,
      tie: 0,
      loss: 0,
      share: 0,
    }));
  let completed = 0,
    mass = 0;
  const handsFor = (assignment: Card[][]) => {
    let cursor = 0;
    return [
      input.hero,
      ...input.opponents.map((h) => h ?? assignment[cursor++]),
    ];
  };
  function* exact() {
    for (const a of scan.assignments) {
      const available = remaining(pool, a.hands.flat());
      for (const extra of choose(available, 5 - input.board.length))
        yield {
          hands: handsFor(a.hands),
          board: [...input.board, ...extra],
          weight: a.weight,
        };
    }
  }
  const iterator = method === "exact" ? exact() : null;
  const progress = (): EquityProgress => ({
    completed,
    total,
    method,
    possibleOutcomes: space,
  });
  return {
    input,
    progress,
    step(batch = 50) {
      if (!Number.isInteger(batch) || batch < 1 || batch > 500)
        throw Error("Batch size must be 1–500.");
      const end = Math.min(total, completed + batch);
      while (completed < end) {
        let deal: { hands: Card[][]; board: Card[]; weight: number };
        if (iterator) {
          const next = iterator.next();
          if (next.done) throw Error("Weighted enumeration count mismatch.");
          deal = next.value;
        } else {
          const assignment = sampler.draw(),
            extra = sampleWithoutReplacement(
              remaining(pool, assignment.hands.flat()),
              5 - input.board.length,
              nextInt,
            );
          deal = {
            hands: handsFor(assignment.hands),
            board: [...input.board, ...extra],
            weight: 1,
          };
        }
        const shares = showdownShares(deal.hands, deal.board);
        mass += deal.weight;
        shares.forEach((share, i) => {
          stats[i].share += share * deal.weight;
          if (share === 1) stats[i].win += deal.weight;
          else if (share > 0) stats[i].tie += deal.weight;
          else stats[i].loss += deal.weight;
        });
        completed++;
      }
      return progress();
    },
    result(): EquityResult {
      if (completed !== total)
        throw Error(
          "Incomplete weighted calculation; no partial equity result.",
        );
      const epsilon = Math.sqrt(Math.log(40) / (2 * completed)),
        point = (v: number) => ({ low: v, high: v });
      return {
        method,
        samples: completed,
        possibleOutcomes: space,
        seed: input.seed,
        confidence: method === "exact" ? null : 0.95,
        complete: true,
        input,
        players: stats.map((st) => {
          const win = st.win / mass,
            tie = st.tie / mass,
            loss = st.loss / mass,
            equity = st.share / mass;
          return {
            win,
            tie,
            loss,
            equity,
            winInterval:
              method === "exact" ? point(win) : wilson(st.win, completed),
            tieInterval:
              method === "exact" ? point(tie) : wilson(st.tie, completed),
            lossInterval:
              method === "exact" ? point(loss) : wilson(st.loss, completed),
            equityInterval:
              method === "exact"
                ? point(equity)
                : {
                    low: Math.max(0, equity - epsilon),
                    high: Math.min(1, equity + epsilon),
                  },
          };
        }),
      };
    },
  };
}
