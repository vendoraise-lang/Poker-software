import type { Action, Card, Profile } from "../poker";
import { parseCards } from "./texture";
export type Concept =
  "value" | "bluff" | "control" | "draws" | "defence" | "sizing";
export const CONCEPTS: Record<Concept, string> = {
  value: "Value betting",
  bluff: "Bluff selection",
  control: "Checking & pot control",
  draws: "Draws & changing boards",
  defence: "Calling & folding",
  sizing: "Basic bet sizing",
};
export type PostflopScenario = {
  id: string;
  street: "Flop" | "Turn" | "River";
  hole: Card[];
  board: Card[];
  position: "BTN" | "BB";
  stack: number;
  opponentStack: number;
  pot: number;
  facingBet: number;
  size: number;
  opponent: Exclude<Profile, "You">;
  concept: Concept;
  judgment: boolean;
  prior: string[];
  preferred: Action;
  accepted: Partial<Record<Action, string>>;
  lesson: string;
};
type Spec = {
  id: string;
  hole: string;
  board: string;
  concept: Concept;
  facing?: number;
  size?: number;
  profile?: PostflopScenario["opponent"];
  oop?: boolean;
  checked?: boolean;
  judgment?: boolean;
  preferred: Action;
  accepted: Partial<Record<Action, string>>;
  lesson: string;
};
function fixture(s: Spec): PostflopScenario {
  const board = parseCards(s.board),
    street =
      board.length === 3 ? "Flop" : board.length === 4 ? "Turn" : "River",
    position = s.oop ? "BB" : "BTN";
  let pot = 6.5,
    stack = 97;
  const prior = [
    "6-max, heads-up pot after the other players fold. SB posts 0.5 BB; BB posts 1 BB.",
    "BTN raises to 3 BB; BB calls 2 more. Pot: 6.5 BB.",
  ];
  for (const [name, bet] of (street === "Flop"
    ? []
    : street === "Turn"
      ? [["Flop", 3]]
      : [
          ["Flop", 3],
          ["Turn", 6],
        ]) as [string, number][]) {
    if (s.checked)
      prior.push(`${name}: BB checks; BTN checks. Pot stays ${pot} BB.`);
    else {
      prior.push(
        `${name}: ${s.oop ? "BB bets" : "BB checks; BTN bets"} ${bet} BB; ${s.oop ? "BTN" : "BB"} calls.`,
      );
      pot += bet * 2;
      stack -= bet;
    }
  }
  const facingBet = s.facing ?? 0;
  prior.push(
    facingBet
      ? `${street}: ${s.oop ? "BB checks; BTN" : "BB"} bets ${facingBet} BB.`
      : s.oop
        ? `${street}: BB (you) acts first.`
        : `${street}: BB checks to you.`,
  );
  return {
    id: s.id,
    street,
    hole: parseCards(s.hole),
    board,
    position,
    stack,
    opponentStack: stack - facingBet,
    pot: pot + facingBet,
    facingBet,
    size:
      s.size ??
      (facingBet
        ? facingBet * 3
        : street === "Flop"
          ? 3
          : street === "Turn"
            ? 6
            : 12),
    opponent: s.profile ?? "Tight-passive",
    concept: s.concept,
    judgment: s.judgment ?? Object.keys(s.accepted).length > 1,
    prior,
    preferred: s.preferred,
    accepted: s.accepted,
    lesson: s.lesson,
  };
}
/** 30 individually authored situations. All amounts in BB, no rake/antes, 100 BB initial stacks.
 * Stable IDs and teaching answers are versioned persistence inputs, not solver claims.
 */
export const POSTFLOP: readonly PostflopScenario[] = [
  fixture({
    id: "f-value-overpair",
    hole: "As Ah",
    board: "Kd 7c 2s",
    concept: "value",
    preferred: "bet",
    accepted: {
      bet: "An overpair can be called by kings and some smaller pairs. A modest value bet builds the pot without requiring a huge commitment.",
      check:
        "Checking back keeps the pot smaller and protects some strong hands in a checking range; betting is the simpler teaching preference.",
    },
    lesson: "Ask which worse hands can call before making a value bet.",
  }),
  fixture({
    id: "f-value-set",
    hole: "7s 7h",
    board: "Kh 7d 2c",
    concept: "value",
    size: 3,
    preferred: "bet",
    accepted: {
      bet: "A set is a strong made hand here. Build value from kings and pairs while remembering that later cards can change relative strength.",
    },
    lesson:
      "A strong made hand is a reason to seek calls from worse, not to assume you cannot lose.",
  }),
  fixture({
    id: "f-control-midpair",
    hole: "9s 9h",
    board: "Kc 7d 2h",
    concept: "control",
    preferred: "check",
    accepted: {
      check:
        "This middle pair has showdown value but few worse hands may call several bets. Checking back keeps weaker hands in and controls the pot.",
    },
    lesson:
      "Not every hand that might be ahead benefits from building a large pot.",
  }),
  fixture({
    id: "f-bluff-backdoor",
    hole: "As Qs",
    board: "Kd 7s 2c",
    concept: "bluff",
    size: 2,
    profile: "Tight-aggressive",
    preferred: "bet",
    accepted: {
      bet: "A small continuation bluff can challenge weak pairs and unpaired hands. The ace-high hand has backdoor possibilities, but no immediate flush draw.",
      check:
        "Checking back preserves ace-high showdown value and avoids bluffing every missed flop. This is a defensible alternative.",
    },
    lesson:
      "Backdoor potential means improvement needs two future cards; it is not a made hand or a one-card flush draw.",
  }),
  fixture({
    id: "f-draw-nutflush",
    hole: "As Qs",
    board: "Js 7s 2d",
    concept: "draws",
    facing: 2,
    preferred: "call",
    accepted: {
      call: "You have four spades, not a flush. Calling a small bet keeps the pot manageable while preserving drawing potential.",
      raise:
        "A semi-bluff raise is defensible if this opponent can fold. You still need a plan when called or re-raised.",
    },
    lesson:
      "Drawing potential can support a call or semi-bluff; a flush draw is not a made flush.",
  }),
  fixture({
    id: "f-defence-weak",
    hole: "8c 3d",
    board: "As Kh 9c",
    concept: "defence",
    facing: 4,
    preferred: "fold",
    accepted: {
      fold: "You have no pair and no immediate straight or flush draw against a selective bettor. Do not continue simply because you have invested preflop.",
    },
    lesson:
      "Past investment is sunk. Evaluate the current price and likely continuing hands.",
  }),
  fixture({
    id: "f-defence-top-pair",
    hole: "Ah Qc",
    board: "Ad 8s 3c",
    concept: "defence",
    facing: 2,
    profile: "Loose-aggressive",
    preferred: "call",
    accepted: {
      call: "Top pair with a good kicker can call a small bet against an aggressive profile. Calling retains bluffs and avoids overinflating the pot.",
      raise:
        "A raise can seek value from weaker aces against a sufficiently loose opponent, though it risks folding their bluffs.",
    },
    lesson:
      "An aggressive profile changes context but never guarantees that a bet is a bluff.",
  }),
  fixture({
    id: "f-sizing-wet",
    hole: "Kh Kc",
    board: "Qs Jh 8h",
    concept: "sizing",
    size: 4,
    preferred: "bet",
    accepted: {
      bet: "A roughly two-thirds-pot bet can get value from pairs and draws on this coordinated board. Kings remain vulnerable to existing strong hands and future cards.",
      check:
        "Checking some overpairs on a very connected board is defensible; it avoids treating an overpair as an automatic stack-off.",
    },
    lesson:
      "Use a sizing plan tied to which hands continue; a wet board is not permission to bet without limits.",
  }),
  fixture({
    id: "f-draw-straight",
    hole: "8s 7d",
    board: "6c 5h Kd",
    concept: "draws",
    facing: 2,
    preferred: "call",
    accepted: {
      call: "A four or nine would complete a straight. A small call is a reasonable teaching line, but those ranks are not guaranteed winning outs.",
      raise:
        "A selective semi-bluff raise can combine fold pressure with straight potential, if the opponent can fold.",
    },
    lesson:
      "Identify cards that complete your pattern separately from whether those cards win.",
  }),
  fixture({
    id: "f-control-monotone",
    hole: "Ac Qd",
    board: "Kh 9h 3h",
    concept: "control",
    oop: true,
    preferred: "check",
    accepted: {
      check:
        "You have neither a pair nor a heart. Checking out of position avoids blindly attacking a board where opponents can already hold a flush.",
    },
    lesson:
      "A monotone board makes a flush possible for some holdings; it does not mean everyone has one.",
  }),
  fixture({
    id: "t-value-top-two",
    hole: "As Kd",
    board: "Ac Kh 7s 2d",
    concept: "value",
    preferred: "bet",
    accepted: {
      bet: "Top two pair can get calls from worse aces and some kings on this relatively disconnected turn. The 6 BB size is illustrative.",
    },
    lesson:
      "Name worse continuing hands rather than betting merely because your cards look strong.",
  }),
  fixture({
    id: "t-control-overcard",
    hole: "Qs Qh",
    board: "Jd 7c 2s Ac",
    concept: "control",
    preferred: "check",
    accepted: {
      check:
        "The ace changes which hands are ahead. Queens retain showdown value but may struggle to get value from worse across another large bet.",
      bet: "A small, selective bet can still get calls from jacks against a calling-prone opponent. It requires a clear worse-hand target.",
    },
    lesson:
      "An overcard changes relative strength; it does not erase your existing pair.",
  }),
  fixture({
    id: "t-draw-completedflush",
    hole: "As Ts",
    board: "Ks 8s 3d 2s",
    concept: "value",
    size: 7,
    preferred: "bet",
    accepted: {
      bet: "Your five spades make the ace-high flush. This is a made flush now, so bet for value against worse flushes and other continuing hands.",
    },
    lesson: "Recompute the actual made hand when a draw completes.",
  }),
  fixture({
    id: "t-draw-missedflush",
    hole: "As Qs",
    board: "Js 7s 2d 4c",
    concept: "draws",
    facing: 8,
    judgment: true,
    preferred: "fold",
    accepted: {
      fold: "A larger turn price with one card to come makes folding the missed draw a cautious baseline. Future winnings are uncertain.",
      call: "Calling can be defensible with credible implied value or weaker opposing hands. It is judgment-dependent; the flush draw alone does not establish a profitable call.",
    },
    lesson:
      "There is one card left, and not every completed draw is paid off. No exact equity is assumed here.",
  }),
  fixture({
    id: "t-defence-passive-raise",
    hole: "Ah Qd",
    board: "Ac 8h 3s 7d",
    concept: "defence",
    facing: 10,
    preferred: "fold",
    judgment: true,
    accepted: {
      fold: "Facing a large lead from a tight-passive profile after they called the flop, a cautious fold avoids overvaluing one pair.",
      call: "A call can be justified if this opponent also leads weaker aces or draws. A profile is a tendency, not proof of a particular hand.",
    },
    lesson:
      "Top pair is not an obligation to call every size. This spot depends heavily on opponent behavior.",
  }),
  fixture({
    id: "t-bluff-scare-ace",
    hole: "Qs Js",
    board: "Kd 8c 2h Ah",
    concept: "bluff",
    size: 6,
    preferred: "bet",
    profile: "Tight-aggressive",
    accepted: {
      bet: "The ace can be a useful pressure card, and a ten would complete a straight. A selective barrel has a coherent story, not a guaranteed fold.",
      check:
        "Checking back avoids over-bluffing a range that already continued on the flop. You preserve the chance of improving.",
    },
    lesson:
      "A scare card affects both ranges. Do not assume it belongs only to the preflop raiser.",
  }),
  fixture({
    id: "t-value-trips",
    hole: "9s Td",
    board: "9c 6h 2d 9h",
    concept: "value",
    preferred: "bet",
    accepted: {
      bet: "You now have three nines. Worse pairs and draws may call, but a better nine or full house is still possible.",
      check:
        "A checking line can protect strong hands and induce later bets. It is slower than the value-betting baseline.",
    },
    lesson:
      "Trips is three of a kind using a paired board; it is not automatically a full house.",
  }),
  fixture({
    id: "t-defence-air",
    hole: "Qc Jd",
    board: "As 8h 3c 2d",
    concept: "defence",
    facing: 8,
    preferred: "fold",
    accepted: {
      fold: "You still have no pair and no immediate straight or flush draw. A costly turn call lacks a clear beginner justification.",
    },
    lesson: "Do not invent a draw from two attractive-looking hole cards.",
  }),
  fixture({
    id: "t-sizing-straight",
    hole: "8s 7d",
    board: "6c 5h Kd 9c",
    concept: "sizing",
    size: 8,
    preferred: "bet",
    accepted: {
      bet: "You made a nine-high straight. A value bet can charge kings, two pairs and draws, without pretending every opponent will continue.",
    },
    lesson:
      "Straight completion changes your purpose from drawing to extracting value.",
  }),
  fixture({
    id: "t-control-fourflush",
    hole: "Ac Ad",
    board: "Kh 9h 3h 2h",
    concept: "control",
    oop: true,
    preferred: "check",
    accepted: {
      check:
        "Four hearts on board make a flush possible with one heart in an opponent’s hand. Your red ace is a diamond, so you have no heart flush.",
    },
    lesson:
      "Read suits precisely. A red card is not necessarily the suit needed.",
  }),
  fixture({
    id: "r-value-nutflush",
    hole: "As Ts",
    board: "Ks 8s 3d 2s Qc",
    concept: "value",
    size: 16,
    preferred: "bet",
    accepted: {
      bet: "Your ace-high flush can seek value from lower flushes and some strong non-flush hands. Choose a size based on plausible calls.",
    },
    lesson:
      "The strongest flush on this unpaired board is a value hand, not a reason to bluff.",
  }),
  fixture({
    id: "r-control-showdown",
    hole: "9s 9h",
    board: "Kc 7d 2h 4c 6d",
    concept: "control",
    checked: true,
    preferred: "check",
    accepted: {
      check:
        "Nines have some showdown value but a thin value bet may mostly get called by better hands. Checking back realizes that showdown value.",
    },
    lesson: "Checking can be an intentional value-preserving decision.",
  }),
  fixture({
    id: "r-bluff-missedspades",
    hole: "As Qs",
    board: "Js 7s 2d 4c 9h",
    concept: "bluff",
    checked: true,
    size: 4,
    profile: "Tight-aggressive",
    preferred: "bet",
    accepted: {
      bet: "A selective missed-draw bluff may target weak pairs after multiple checks. It needs foldable opposing hands and must not be used with every miss.",
      check:
        "Ace high can sometimes win at showdown, and checking avoids bluffing an opponent who may not fold enough.",
    },
    lesson:
      "The missed spades are not a flush. River bluff selection is judgment-dependent.",
  }),
  fixture({
    id: "r-defence-passive-large",
    hole: "Ah Qd",
    board: "Ac 8h 3s 7d 2c",
    concept: "defence",
    facing: 20,
    judgment: true,
    preferred: "fold",
    accepted: {
      fold: "A large river bet from a tight-passive player can make one pair an unattractive bluff-catcher. A cautious fold fits that teaching assumption.",
      call: "Calling is defensible if observation shows enough missed draws or weaker value bets. Profile labels alone cannot prove the right answer.",
    },
    lesson:
      "Bluff-catching depends on an opponent’s betting range, not just your pair or the displayed price.",
  }),
  fixture({
    id: "r-defence-aggression",
    hole: "Ah Qd",
    board: "Ac 8h 3s 7d 2c",
    concept: "defence",
    facing: 8,
    profile: "Loose-aggressive",
    preferred: "call",
    accepted: {
      call: "Top pair can bluff-catch a modest bet against a player capable of betting missed hands. This does not mean every aggressive opponent is bluffing.",
      fold: "A fold remains defensible when specific evidence outweighs the broad profile and indicates a value-heavy line.",
    },
    lesson:
      "Use both bet size and observed behavior; do not mechanically call because a label says aggressive.",
  }),
  fixture({
    id: "r-value-fullhouse",
    hole: "7s 7h",
    board: "Kh 7d 2c 2s 9d",
    concept: "value",
    size: 16,
    preferred: "bet",
    accepted: {
      bet: "Your three sevens plus two twos make a full house. Seek value from trips, strong pairs and some slower-played hands.",
    },
    lesson:
      "A paired board can improve your set to a full house. Count the best five actual cards.",
  }),
  fixture({
    id: "r-draw-missed-fold",
    hole: "8s 7d",
    board: "6c 5h Kd Qc 2s",
    concept: "draws",
    facing: 12,
    preferred: "fold",
    accepted: {
      fold: "The straight draw missed and there is no next card. Eight high is not a hand to call with in this teaching situation.",
    },
    lesson:
      "On the river, a missed draw is no longer a drawing hand; there are no future outs.",
  }),
  fixture({
    id: "r-sizing-thinvalue",
    hole: "Kh Jd",
    board: "Kc 8h 3s 2d 7c",
    concept: "sizing",
    checked: true,
    size: 2,
    preferred: "bet",
    accepted: {
      bet: "A small value bet targets weaker kings and some pairs against this passive profile. It is thin value, so do not assume it warrants a huge bet.",
      check:
        "Checking back is reasonable when few worse hands call or a check-raise would put you in a difficult spot.",
    },
    lesson:
      "Thin value asks for realistic worse callers and a size they might pay.",
  }),
  fixture({
    id: "r-control-boardstraight",
    hole: "As Qd",
    board: "9c Th Js Qc Kd",
    concept: "control",
    oop: true,
    checked: true,
    preferred: "check",
    accepted: {
      check:
        "Your ace combines with T-J-Q-K to make an ace-high straight, improving on the king-high straight on board. Checking is a deceptive option.",
      bet: "Betting is accepted for value because your ace improves the board’s straight. This is not automatically a split pot.",
    },
    lesson:
      "A straight on board does not force a tie if a hole card can improve it.",
  }),
  fixture({
    id: "r-bluff-no-fold-target",
    hole: "Qc Jd",
    board: "As 8h 3c 2d 6s",
    concept: "bluff",
    checked: true,
    profile: "Tight-passive",
    preferred: "check",
    accepted: {
      check:
        "Against the assumed opponent who dislikes folding pairs, checking avoids a low-information bluff with queen high.",
      bet: "A small selective bluff is defensible only with evidence that better high-card hands or weak pairs will fold; it is not a default with every miss.",
    },
    lesson: "Before bluffing, identify better hands that might actually fold.",
  }),
];
export function postById(id: string) {
  const s = POSTFLOP.find((s) => s.id === id);
  if (!s) throw Error("Unknown postflop exercise");
  return s;
}
export function postLegal(s: PostflopScenario): Action[] {
  if (s.stack <= 0) return [];
  if (s.facingBet > 0)
    return [
      "fold",
      "call",
      ...(s.stack > s.facingBet && s.opponentStack > 0
        ? ["raise" as const]
        : []),
    ];
  return ["check", ...(s.opponentStack > 0 ? ["bet" as const] : [])];
}
export function gradePost(s: PostflopScenario, action: Action) {
  if (!postLegal(s).includes(action))
    throw Error("Illegal action in this exercise");
  return {
    correct: !!s.accepted[action],
    explanation:
      s.accepted[action] ??
      `This action is legal but outside the accepted teaching lines. ${s.lesson} Preferred line: ${s.preferred}.`,
  };
}
