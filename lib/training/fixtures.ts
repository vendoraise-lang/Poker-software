import { exampleCards, POSITIONS, type Position } from "./ranges";
export type Choice = "Fold" | "Call" | "Raise";
export type Topic = "opening" | "defending" | "reraising" | "pot-odds";
export type Strength = "Premium" | "Strong" | "Speculative" | "Weak";
export type PriorAction = {
  position: Position;
  action: "Fold" | "Raise";
  toBB?: number;
};
export type Scenario = {
  id: string;
  level: 1 | 2 | 3;
  topic: Exclude<Topic, "pot-odds">;
  position: Position;
  hand: string;
  strength: Strength;
  stackBB: number;
  investedBB: number;
  currentBetBB: number;
  raiseToBB: number;
  prior: PriorAction[];
  preferred: Choice;
  accepted: Choice[];
  explanations: Record<Choice, string>;
};
function opening(
  id: string,
  position: Position,
  hand: string,
  strength: Strength,
  preferred: Choice,
  why: string,
): Scenario {
  return {
    id,
    level: 1,
    topic: "opening",
    position,
    hand,
    strength,
    stackBB: 100,
    investedBB: position === "SB" ? 0.5 : 0,
    currentBetBB: 1,
    raiseToBB: 2.5,
    prior: POSITIONS.slice(0, POSITIONS.indexOf(position)).map((position) => ({
      position,
      action: "Fold",
    })),
    preferred,
    accepted: [preferred],
    explanations: {
      Fold:
        preferred === "Fold"
          ? why
          : `Folding is legal, but this hand belongs in our sample ${position} opening range. ${why}`,
      Call: `Calling the blind is legal. Our beginner baseline uses raising or folding in unopened pots rather than limping. ${why}`,
      Raise:
        preferred === "Raise"
          ? why
          : `A raise is legal, but this hand is outside this conservative ${position} sample. ${why}`,
    },
  };
}
function facing(
  id: string,
  level: 2 | 3,
  position: Position,
  opener: Position,
  hand: string,
  strength: Strength,
  preferred: Choice,
  accepted: Choice[],
  explanations: Record<Choice, string>,
  stackBB = 100,
): Scenario {
  return {
    id,
    level,
    topic: "defending",
    position,
    hand,
    strength,
    stackBB,
    investedBB: position === "BB" ? 1 : position === "SB" ? 0.5 : 0,
    currentBetBB: 2.5,
    raiseToBB: stackBB === 20 ? 20 : 8,
    prior: POSITIONS.slice(0, POSITIONS.indexOf(position)).map((position) =>
      position === opener
        ? { position, action: "Raise", toBB: 2.5 }
        : { position, action: "Fold" },
    ),
    preferred,
    accepted,
    explanations,
  };
}
/** Stable fixture IDs are part of the local persistence contract. Values are play chips in BB.
 * Six seats, blinds .5/1, no antes/rake. Each response is a teaching baseline, not an EV claim.
 */
export const SCENARIOS: readonly Scenario[] = [
  opening(
    "open-utg-aa",
    "UTG",
    "AA",
    "Premium",
    "Raise",
    "Aces are a premium starting hand. Raise to build a pot; early position is a reason to select strong hands, not to fold aces.",
  ),
  opening(
    "open-utg-j4o",
    "UTG",
    "J4o",
    "Weak",
    "Fold",
    "Jack-four offsuit has poor connectivity and a weak kicker. With five players still behind, folding is a straightforward beginner choice.",
  ),
  opening(
    "open-btn-a5s",
    "BTN",
    "A5s",
    "Speculative",
    "Raise",
    "With everyone folding to the button, fewer players remain. Ace-five suited is in our wider sample; suitedness and possible straights add playability, not a guarantee of winning.",
  ),
  opening(
    "open-hj-99",
    "HJ",
    "99",
    "Strong",
    "Raise",
    "Nines belong in this example opening range. A raise can win the blinds or build a pot with a playable pair; overcards can still make later streets difficult.",
  ),
  opening(
    "open-sb-72o",
    "SB",
    "72o",
    "Weak",
    "Fold",
    "Seven-two offsuit is outside our conservative small-blind raise-or-fold sample. You would act first after the flop. Completing is legal but is not the baseline taught here.",
  ),
  facing(
    "defend-bb-kqs",
    2,
    "BB",
    "BTN",
    "KQs",
    "Strong",
    "Call",
    ["Call", "Raise"],
    {
      Fold: "Folding is legal but conservative against a late-position open with this suited broadway hand.",
      Call: "Calling invests another 1.5 BB. You close the preflop action and have a playable suited hand. You will still be out of position after the flop.",
      Raise:
        "A three-bet is a reasonable alternative against a wide button opening range. It builds a larger pot out of position, so have a plan if the opener continues.",
    },
  ),
  facing("defend-btn-72o", 2, "BTN", "UTG", "72o", "Weak", "Fold", ["Fold"], {
    Fold: "An early-position open usually represents a more selective range. Seven-two offsuit is a clear fold in this teaching baseline.",
    Call: "Position helps, but it does not rescue every weak hand. Two blinds remain behind you, and this hand has poor playability.",
    Raise:
      "This is not a sensible beginner bluff candidate against a selective early-position range. Start by folding your weakest hands.",
  }),
  facing("defend-co-aa", 2, "CO", "HJ", "AA", "Premium", "Raise", ["Raise"], {
    Fold: "Aces are far too strong for this baseline fold. Do not confuse a selective opener with an unbeatable hand.",
    Call: "Calling can be a deliberate trap in some strategies. For a beginner baseline, prefer building the pot and reducing the number of opponents with a raise.",
    Raise:
      "Three-bet for value with aces. A suggested 8 BB total is an illustrative size, not an exact optimal size.",
  }),
  facing(
    "defend-btn-88",
    2,
    "BTN",
    "CO",
    "88",
    "Strong",
    "Call",
    ["Call", "Raise"],
    {
      Fold: "Folding is possible against unusually strong opponents, but this example assumes an ordinary cutoff open at 100 BB.",
      Call: "Calling in position with a medium pair is a reasonable baseline at this depth. Do not assume you must hit a set to win or that every set will be paid off.",
      Raise:
        "A three-bet is also a reasonable alternative against a wider cutoff range. It changes the pot size and the range that continues.",
    },
  ),
  facing("defend-sb-j3o", 2, "SB", "HJ", "J3o", "Weak", "Fold", ["Fold"], {
    Fold: "You have a weak kicker, poor connectivity, and will act first after the flop. Folding avoids a difficult out-of-position pot.",
    Call: "A cheap-looking price is not enough. This hand often makes dominated pairs, and the big blind can still raise.",
    Raise:
      "Aggression needs a sensible hand-selection plan. This offsuit weak hand is outside our beginner defence strategy.",
  }),
  facing(
    "short-bb-ako",
    3,
    "BB",
    "BTN",
    "AKo",
    "Premium",
    "Raise",
    ["Raise"],
    {
      Fold: "Ace-king is a premium starting hand against a button open, even though it is not yet a pair.",
      Call: "Calling can be part of a more nuanced strategy. Our simplified 20 BB fixture prefers a re-raise all-in; this is a teaching choice, not a universal rule.",
      Raise:
        "At 20 BB effective, our teaching baseline re-raises all-in to 20 BB against this late-position open. Stack depth changes sizing and commitment; ace-king can still lose.",
    },
    20,
  ),
  facing(
    "defend-btn-aqs",
    3,
    "BTN",
    "UTG",
    "AQs",
    "Strong",
    "Call",
    ["Call", "Raise"],
    {
      Fold: "This suited broadway hand has enough playability for our example against an ordinary early-position open.",
      Call: "Calling keeps some weaker hands in the opener’s range and uses your position. Beware making a dominated top pair; the blinds may still squeeze.",
      Raise:
        "A three-bet is an accepted alternative. Against an early opener, expect a more selective continuing range; do not treat every ace as a value raise.",
    },
  ),
  facing("defend-bb-83o", 3, "BB", "UTG", "83o", "Weak", "Fold", ["Fold"], {
    Fold: "The discounted big-blind price does not make every call good. This offsuit disconnected hand is outside our beginner defence baseline.",
    Call: "You would invest 1.5 BB, but the price alone ignores poor playability and the opener’s range. Pot odds are one input, not an automatic calling instruction.",
    Raise:
      "A weak disconnected hand is not a beginner three-bet candidate against this early-position range.",
  }),
  {
    id: "threebet-co-qq",
    level: 3,
    topic: "reraising",
    position: "CO",
    hand: "QQ",
    strength: "Premium",
    stackBB: 100,
    investedBB: 2.5,
    currentBetBB: 9,
    raiseToBB: 22,
    prior: [
      { position: "UTG", action: "Fold" },
      { position: "HJ", action: "Fold" },
      { position: "CO", action: "Raise", toBB: 2.5 },
      { position: "BTN", action: "Raise", toBB: 9 },
      { position: "SB", action: "Fold" },
      { position: "BB", action: "Fold" },
    ],
    preferred: "Raise",
    accepted: ["Raise", "Call"],
    explanations: {
      Fold: "Queens are too strong for a default fold against an ordinary button three-bet in this example.",
      Call: "Calling is an accepted alternative at this depth. You retain strong hands in your calling range but will act before the button after the flop.",
      Raise:
        "A four-bet is our preferred teaching line with queens against a button three-bet. The illustrative size is 22 BB total. This does not imply you must call every subsequent shove.",
    },
  },
  {
    id: "threebet-co-a9o",
    level: 3,
    topic: "reraising",
    position: "CO",
    hand: "A9o",
    strength: "Speculative",
    stackBB: 100,
    investedBB: 2.5,
    currentBetBB: 9,
    raiseToBB: 22,
    prior: [
      { position: "UTG", action: "Fold" },
      { position: "HJ", action: "Fold" },
      { position: "CO", action: "Raise", toBB: 2.5 },
      { position: "BTN", action: "Raise", toBB: 9 },
      { position: "SB", action: "Fold" },
      { position: "BB", action: "Fold" },
    ],
    preferred: "Fold",
    accepted: ["Fold"],
    explanations: {
      Fold: "Your earlier raise does not oblige you to continue. Ace-nine offsuit can be dominated by the button’s stronger aces; folding is the beginner baseline.",
      Call: "Do not call just to defend chips already invested. Those chips are sunk, and you face a larger pot out of position with a vulnerable ace.",
      Raise:
        "Advanced four-bet bluff strategies exist, but this fixture does not teach a bluff with ace-nine offsuit. Prefer the simple fold baseline.",
    },
  },
];
export function scenarioById(id: string) {
  const s = SCENARIOS.find((s) => s.id === id);
  if (!s) throw Error("Unknown scenario");
  return s;
}
export function legalChoices(s: Scenario): Choice[] {
  const owed = s.currentBetBB - s.investedBB,
    remaining = s.stackBB - s.investedBB;
  return [
    "Fold",
    ...(owed > 0 && remaining > 0 ? ["Call" as const] : []),
    ...(remaining > owed ? ["Raise" as const] : []),
  ];
}
export function gradeDecision(s: Scenario, choice: Choice) {
  if (!legalChoices(s).includes(choice)) throw Error("Illegal training choice");
  return {
    correct: s.accepted.includes(choice),
    preferred: s.preferred,
    explanation: s.explanations[choice],
  };
}
export function scenarioCards(s: Scenario) {
  return exampleCards(s.hand);
}
export const TOPIC_LABELS: Record<Topic, string> = {
  opening: "Opening ranges",
  defending: "Facing a raise",
  reraising: "Facing a three-bet",
  "pot-odds": "Pot odds",
};
