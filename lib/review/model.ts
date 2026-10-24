import {
  act,
  evaluate,
  legal,
  position,
  type Action,
  type Card,
  type Game,
} from "../poker";
import {
  replayFrames,
  restoreJournal,
  startOrigin,
  type Command,
  type Journal,
  type ReplayFrame,
} from "../hand-session";
import { analyzeTexture } from "../postflop/texture";
import type { EquityInput } from "../equity/engine";
import type { WeightedRange } from "../equity/ranges";
export const REVIEW_TOPICS = {
  opening: "Preflop selection",
  "pot-odds": "Pot odds",
  defence: "Calling & folding",
  draws: "Draws & redraws",
  control: "Pot control",
  sizing: "Bet sizing",
  value: "Value targets",
  bluff: "Bluff selection",
} as const;
export type ReviewTopic = keyof typeof REVIEW_TOPICS;
export type TeachingFinding = {
  rule: string;
  topic: ReviewTopic;
  kind: "fact" | "heuristic";
  title: string;
  evidence: string;
  guidance: string;
  uncertainty: string;
};
export type DecisionPoint = {
  frameIndex: number;
  commandIndex: number;
  street: Game["street"];
  board: Card[];
  hero: Card[];
  position: string;
  stack: number;
  effectiveBehind: number;
  pot: number;
  call: number;
  eligibleAfterCall: number;
  requiredShare: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  actions: Action[];
  chosen: Command;
  committed: number;
  history: string[];
  opponents: {
    seat: number;
    name: string;
    chips: number;
    bet: number;
    folded: boolean;
    allIn: boolean;
    profile: string;
  }[];
  context: string;
  findings: TeachingFinding[];
};
const boards = (cards: Card[]) =>
  cards.map((c) => `${c.rank}:${c.suit}`).join(",");
function matches(f: ReplayFrame, g: Game) {
  return (
    f.street === g.street &&
    f.actor === g.actor &&
    boards(f.board) === boards(g.board) &&
    f.pot === g.players.reduce((s, p) => s + p.total, 0) &&
    f.players.every(
      (p, i) =>
        p.chips === g.players[i].chips &&
        p.bet === g.players[i].bet &&
        p.folded === g.players[i].folded,
    )
  );
}
export function buildReview(value: unknown) {
  const { journal, game: final } = restoreJournal(value);
  if (final.street !== "Showdown")
    throw Error("Review supports completed simulated hands only.");
  const frames = replayFrames(journal),
    decisions: DecisionPoint[] = [];
  let game = startOrigin(journal.origin),
    cursor = 0;
  for (let i = 0; i < journal.commands.length; i++) {
    const command = journal.commands[i];
    if (game.actor === 0) {
      const index = frames.findIndex((f, j) => j >= cursor && matches(f, game));
      if (index < 0)
        throw Error("Cannot align review with the recorded public history.");
      cursor = index;
      const hero = game.players[0],
        l = legal(game),
        opponents = game.players.slice(1).map((p, j) => ({
          seat: j + 1,
          name: p.name,
          chips: p.chips,
          bet: p.bet,
          folded: p.folded,
          allIn: p.chips === 0 && !p.folded,
          profile: p.profile,
        })),
        heroCap = hero.total + l.call,
        eligibleAfterCall = game.players.reduce(
          (sum, p, j) =>
            sum + Math.min(p.total + (j === 0 ? l.call : 0), heroCap),
          0,
        ),
        committed =
          command.action === "call"
            ? l.call
            : command.amount !== undefined
              ? command.amount - hero.bet
              : 0;
      const point: DecisionPoint = {
        frameIndex: index,
        commandIndex: i,
        street: game.street,
        board: structuredClone(game.board),
        hero: structuredClone(hero.cards),
        position: position(game, 0),
        stack: hero.chips,
        effectiveBehind: Math.min(
          hero.chips,
          Math.max(
            0,
            ...opponents.filter((p) => !p.folded).map((p) => p.chips),
          ),
        ),
        pot: game.players.reduce((s, p) => s + p.total, 0),
        call: l.call,
        eligibleAfterCall,
        requiredShare:
          l.call && eligibleAfterCall ? l.call / eligibleAfterCall : 0,
        minRaiseTo: l.min,
        maxRaiseTo: l.max,
        actions: [...l.actions],
        chosen: { ...command },
        committed,
        history: [...game.log],
        opponents,
        context: "",
        findings: [],
      };
      point.context = JSON.stringify({
        street: point.street,
        board: point.board,
        hero: point.hero,
        position: point.position,
        stack: point.stack,
        pot: point.pot,
        history: point.history,
        opponents: point.opponents,
      });
      point.findings = teachingFindings(point);
      decisions.push(point);
    }
    game = act(game, command.action, command.amount);
  }
  return { frames, decisions, handNumber: journal.origin.hand };
}
export function teachingFindings(p: DecisionPoint): TeachingFinding[] {
  const findings: TeachingFinding[] = [];
  const add = (
    rule: string,
    topic: ReviewTopic,
    kind: TeachingFinding["kind"],
    title: string,
    evidence: string,
    guidance: string,
    uncertainty: string,
  ) =>
    findings.push({
      rule,
      topic,
      kind,
      title,
      evidence,
      guidance,
      uncertainty,
    });
  if (p.call > 0)
    add(
      "PRICE-1",
      "pot-odds",
      "fact",
      "Know the immediate price",
      `Calling costs ${p.call} play chips into a hero-eligible pot of ${p.eligibleAfterCall} after calling.`,
      `The snapshot break-even share is ${(p.requiredShare * 100).toFixed(1)}%, before future betting or rake. Previously invested chips are sunk.`,
      "This is a price calculation, not a recommendation. Other players can still act; equal-pot equity does not model contribution-dependent side pots.",
    );
  if (
    p.street === "Preflop" &&
    p.hero[0].rank === 14 &&
    p.hero[1].rank === 14 &&
    p.chosen.action === "fold"
  )
    add(
      "OPEN-1",
      "opening",
      "heuristic",
      "Revisit folding a premium pair",
      "The recorded hand is pocket aces and the chosen action was fold.",
      "In this ordinary play-chip cash-style model without ICM, folding aces deserves a hand-selection review.",
      "This is a transparent beginner baseline, not a computed EV verdict. Exceptional table assumptions are not modeled.",
    );
  if (p.board.length >= 3) {
    const t = analyzeTexture(p.board, p.hero),
      category = evaluate([...p.hero, ...p.board])[0],
      largePrice = p.requiredShare >= 1 / 3;
    if (
      p.chosen.action === "call" &&
      category === 0 &&
      largePrice &&
      !t.flushDraw &&
      !t.straightRanks.length
    )
      add(
        "CALL-1",
        "defence",
        "heuristic",
        "Check the reason for a costly high-card call",
        `You called with ${t.made}, no immediate flush draw, and no one-card straight completion at a price of ${(p.requiredShare * 100).toFixed(1)}%.`,
        "Name the worse hands or bluffs you expect to beat; a previous investment does not require another call.",
        "A high-card bluff-catch can be defensible against some ranges. This rule flags a concept to inspect, not a proven mistake.",
      );
    if (p.street === "River" && p.chosen.action === "call" && category === 0)
      add(
        "RIVER-1",
        "draws",
        "fact",
        "A river call cannot buy another card",
        "The board has five cards and your best made hand is high card.",
        "There are no future outs on the river. If calling, justify it as a bluff-catch rather than a drawing call.",
        "High card can beat a weaker bluff. A missed draw alone does not prove that folding is optimal.",
      );
    if (
      (p.chosen.action === "bet" || p.chosen.action === "raise") &&
      category === 1
    )
      add(
        "VALUE-1",
        "value",
        "heuristic",
        "Identify what a worse hand calls",
        `The recorded aggressive action used a one-pair hand and committed ${p.committed} additional chips.`,
        "For value, name plausible worse callers. If bluffing, name better hands expected to fold. Checking can sometimes preserve showdown value.",
        "Thin value, protection, bluffing and checking may all be defensible depending on assumed ranges and future actions.",
      );
    if (p.chosen.action === "bet" && p.committed >= p.pot)
      add(
        "SIZE-1",
        "sizing",
        "heuristic",
        "Explain the pot-sized or larger bet",
        `A fresh bet committed ${p.committed} into a pot of ${p.pot}, or ${((p.committed / p.pot) * 100).toFixed(0)}% of the existing pot.`,
        "Explain which value hands or bluff candidates use this size and which opposing hands continue.",
        "A large bet is not automatically wrong; the threshold is an explicit teaching prompt, not an optimal-sizing model.",
      );
    if (p.street !== "River" && (t.flushDraw || t.straightRanks.length))
      add(
        "DRAW-1",
        "draws",
        "fact",
        "Separate a draw from a made hand",
        `Current made hand: ${t.made}. ${t.flushDraw ? "Four cards of one suit are visible." : ""} ${t.straightRanks.length ? "One-card straight-completing ranks exist." : ""}`,
        "A pattern-completing card may also improve an opponent. Review distinct outs, overlap and possible redraws.",
        "Neither a draw count nor showdown equity alone determines a call or semi-bluff.",
      );
  }
  return findings;
}
/** Deliberately accepts only the projected DecisionPoint, never a private Game,
 * journal seed, future board or actual opponent cards. Folded cards stay unknown.
 */
export function decisionEquity(
  p: DecisionPoint,
  ranges: (WeightedRange | null)[],
  samples = 5000,
): EquityInput {
  const live = p.opponents.filter((o) => !o.folded);
  if (!live.length) throw Error("No live opponent at this decision.");
  return {
    hero: structuredClone(p.hero),
    board: structuredClone(p.board),
    opponents: live.map(() => null),
    ranges: live.map((o) => ranges[o.seat - 1] ?? null),
    seed: 2026,
    samples,
    mode: "auto",
  };
}
export function reviewJournals(raw: unknown) {
  const data = raw as {
    table?: { version?: number; completed?: unknown[] };
    hands?: number;
  };
  if (!data?.table)
    return {
      hands: [] as Journal[],
      skipped: 0,
      message:
        "Older statistics contain no reconstructable hand histories. Complete a new simulated hand to review it.",
    };
  if (data.table.version !== 1 || !Array.isArray(data.table.completed))
    return {
      hands: [] as Journal[],
      skipped: 0,
      message:
        "The saved table history format is unsupported; it has been left unchanged.",
    };
  const hands: Journal[] = [];
  let skipped = 0;
  for (const value of data.table.completed.slice(-20))
    try {
      const r = restoreJournal(value);
      if (r.game.street !== "Showdown") throw Error();
      hands.push(r.journal);
    } catch {
      skipped++;
    }
  return {
    hands,
    skipped,
    message: skipped
      ? `${skipped} missing, incomplete or malformed hand histories were skipped; valid completed hands remain available.`
      : hands.length
        ? ""
        : "No completed journal is recorded yet. Unfinished hands are not available for retrospective review.",
  };
}
