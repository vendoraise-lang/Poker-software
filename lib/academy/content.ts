import { evaluate, ranks, type Card } from "../poker";
import { parseCards, analyzeTexture } from "../postflop/texture";
import { drawReport } from "../equity/draws";
import { expandRange, type WeightedRange } from "../equity/ranges";
import { potOdds } from "../training/odds";
export type Concept =
  | "actions"
  | "rankings"
  | "position"
  | "selection"
  | "price"
  | "share"
  | "value-control"
  | "defence-reasoning"
  | "texture"
  | "draw-counting"
  | "combinations"
  | "blockers"
  | "information"
  | "uncertainty";
export type Kind = "fact" | "math" | "judgment";
export type Question = {
  id: string;
  module: number;
  concept: Concept;
  purpose: "practice" | "assessment";
  key: string;
  kind: Kind;
  prompt: string;
  context: string;
  hero: Card[];
  board: Card[];
  opponents: Card[][];
  options: { id: string; label: string }[];
  accepted: string[];
  explanation: string;
  basis: string;
};
export type Lesson = {
  id: string;
  concept: Concept;
  title: string;
  text: string;
  tryIt: string;
  practiceId: string;
};
export type AcademyModule = {
  id: number;
  title: string;
  level: string;
  objectives: string[];
  concepts: Concept[];
  lessons: Lesson[];
  drill: string;
};
export const LABELS: Record<Concept, string> = {
  actions: "Legal actions",
  rankings: "Best-five hand ranking",
  position: "Position",
  selection: "Starting-hand reasoning",
  price: "Pot-odds mathematics",
  share: "Fractional pot equity",
  "value-control": "Value & pot control",
  "defence-reasoning": "Defence & bluff reasoning",
  texture: "Board texture",
  "draw-counting": "Distinct draw candidates",
  combinations: "Range combinations",
  blockers: "Card removal",
  information: "Available information",
  uncertainty: "Evidence & uncertainty",
};
export function hash(s: string) {
  let n = 0;
  for (const c of s) n = (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0;
  return n;
}
function question(
  module: number,
  concept: Concept,
  index: number,
  kind: Kind,
  prompt: string,
  correct: string | string[],
  wrong: string[],
  explanation: string,
  cards: {
    hero?: string;
    board?: string;
    opponents?: string[];
    context?: string;
  } = {},
  semantic?: string,
): Question {
  const good = Array.isArray(correct) ? correct : [correct],
    all = [...good, ...wrong];
  if (new Set(all).size !== all.length) throw Error("Duplicate answer label");
  const offset = hash(concept + index) % all.length,
    labels = [...all.slice(offset), ...all.slice(0, offset)],
    id = `a6-${concept}-${index}`,
    key = semantic ?? `a6:${concept}:${index}`;
  return {
    id,
    module,
    concept,
    purpose: index === 0 ? "practice" : "assessment",
    key,
    kind,
    prompt,
    context:
      cards.context ??
      "Hypothetical play-chip teaching example. No rake, antes or real-money stakes.",
    hero: parseCards(cards.hero ?? ""),
    board: parseCards(cards.board ?? ""),
    opponents: (cards.opponents ?? []).map(parseCards),
    options: labels.map((label, i) => ({ id: `o${i}`, label })),
    accepted: labels.flatMap((label, i) =>
      good.includes(label) ? [`o${i}`] : [],
    ),
    explanation,
    basis:
      kind === "judgment"
        ? "Documented teaching assumptions; external strategy validation still needed"
        : kind === "math"
          ? "Explicit arithmetic / combination counting"
          : "Rules or deterministic card facts",
  };
}
const Q: Question[] = [];
const add = (q: Question) => Q.push(q);
const ruleCases = [
  [
    "Nothing is owed and another player can still act. Which option keeps your claim for free?",
    "Check",
    [
      "Calling must cost a full big blind",
      "You must raise",
      "Checking forfeits the pot",
    ],
    "Checking is legal when your street bet already matches the current wager. It keeps the hand live without adding chips.",
  ],
  [
    "The current street wager is 30 chips; you have put in 10 and have 100 behind. What is the call cost?",
    "20 chips",
    ["10 chips", "30 chips", "40 chips"],
    "A call adds the difference, 30 − 10 = 20, not the full 30 again.",
  ],
  [
    "A player bets 20, then another raises to 60. What is the next minimum full raise-to total?",
    "100 chips",
    ["80 chips", "120 chips", "60 chips"],
    "The last full raise increased the bet by 40 (60 − 20). Another full raise must increase 60 by at least 40, to 100.",
  ],
  [
    "You face a 50-chip call but have only 18 chips left. What can calling do?",
    "Call all-in for 18; eligibility is limited by contribution",
    [
      "Borrow chips to call 50",
      "Win every side pot automatically",
      "Call 50 and keep 18 behind",
    ],
    "Calling can use the remaining stack. Side pots isolate contributions; being all-in does not grant a claim to money you did not match.",
  ],
  [
    "A player has already called 40. Several short all-ins increase the wager to 80; the last full raise size is 40. What happens to that player’s raise rights?",
    "The cumulative 40 increase can reopen raising",
    [
      "Short all-ins can never reopen action",
      "The player is automatically folded",
      "The player must raise",
    ],
    "Reopening considers the full increase faced since acting. A single short increase is not a full raise, but cumulative increases can reach the required size.",
  ],
  [
    "Heads-up, which player is the small blind and acts first preflop?",
    "The button",
    [
      "The big blind",
      "A third player under the gun",
      "Both players simultaneously",
    ],
    "Heads-up the button is the small blind and acts first preflop. The big blind acts first after the flop.",
  ],
  [
    "You face a bet with chips remaining. Which action gives up your claim to this hand’s pot?",
    "Fold",
    [
      "Check even though chips are owed",
      "Call without matching any chips",
      "Post the dealer button",
    ],
    "Folding surrenders your claim. Checking is not legal while an unmatched wager is owed, except that a short stack can call all-in, not check.",
  ],
] as const;
ruleCases.forEach((r, i) =>
  add(
    question(1, "actions", i, "fact", r[0], r[1], [...r[2]], r[3], {
      hero: "Ah Qc",
    }),
  ),
);
const rankCases = [
  ["As 2d", "3c 4h 5s Kc Qd", "Name the best five-card hand."],
  ["Kh Kd", "Ks 7h 7c 2d 3s", "Name the best five-card hand."],
  ["As Js", "9s 7s 3s 2h 4d", "Name the best five-card hand."],
  ["Qs Qh", "Qd Qc 9h 4s 2d", "Name the best five-card hand."],
  ["8c 7d", "6s 5h 4c Ah Kd", "Name the best five-card hand."],
  ["Ah Kc", "Ad Kh 8c 7s 2d", "Name the best five-card hand."],
  ["Ts 9s", "8s 7s 6s Ah Kd", "Name the best five-card hand."],
] as const;
rankCases.forEach(([hero, board, prompt], i) => {
  const name = ranks[evaluate([...parseCards(hero), ...parseCards(board)])[0]];
  add(
    question(
      1,
      "rankings",
      i,
      "fact",
      prompt,
      name,
      ranks.filter((r) => r !== name).slice(0, 3),
      `Use the best five cards from seven: this holding makes ${name.toLowerCase()}. Unused cards never upgrade the category or break a tie.`,
      { hero, board },
      `rank-task:${hero}:${board}`,
    ),
  );
});
const positions = [
  [
    "In a six-seat hand before the flop, who acts first when all seats are in?",
    "UTG",
    ["BTN", "SB", "BB"],
    "UTG begins preflop after the two blinds.",
  ],
  [
    "After the flop with all six players still live, who acts last?",
    "BTN",
    ["UTG", "SB", "BB"],
    "The button has last action after the flop when all players remain.",
  ],
  [
    "After the flop with SB, BB and BTN still live, who acts first?",
    "SB",
    ["BTN", "BB", "Nobody until a bet"],
    "Postflop action begins with the first live seat clockwise from the button: the small blind here.",
  ],
  [
    "Heads-up after the flop, who acts first?",
    "BB",
    ["BTN / SB", "Both at once", "Whoever won the previous hand"],
    "Heads-up the button is the small blind; the big blind acts first postflop.",
  ],
  [
    "In 6-max, which seat is immediately before the button in preflop order?",
    "CO",
    ["HJ", "UTG", "BB"],
    "The order is UTG, HJ, CO, BTN, SB, BB. The cutoff is immediately before BTN.",
  ],
  [
    "The button has folded. CO and BB remain after the flop. Who acts last?",
    "CO",
    ["BB", "The folded button", "UTG even though folded"],
    "Among the remaining seats, CO acts after BB. A folded button cannot act.",
  ],
  [
    "Everyone before the big blind folds preflop, including the small blind. What happens?",
    "BB wins the blinds without another decision",
    [
      "BB must raise first in",
      "The button receives the pot",
      "The hand must reach the flop",
    ],
    "There is no unopened raise-first-in decision for BB when everyone folds. A small-blind limp would be a different situation.",
  ],
] as const;
positions.forEach((r, i) =>
  add(
    question(2, "position", i, "fact", r[0], r[1], [...r[2]], r[3], {
      hero: "Kc Qd",
      context: "Positions are explicitly stated; folded seats do not act.",
    }),
  ),
);
const starts = [
  ["KTo", "UTG"],
  ["AQo", "UTG"],
  ["KJs", "CO"],
  ["66", "BTN"],
  ["ATo", "SB"],
  ["Q5o", "UTG"],
  ["98s", "BTN"],
] as const;
starts.forEach(([hand, pos], i) => {
  const weak = hand === "Q5o" || hand === "KTo",
    good = weak
      ? ["Folding is a sensible conservative baseline with players behind."]
      : [
          "Raising can be a sensible first-in line for this hand and seat.",
          "A legal alternative needs a plan for the players behind and later streets.",
        ];
  const a = hand[0],
    b = hand[1],
    hero = a + "s " + b + (a === b || hand[2] === "o" ? "d" : "s");
  add(
    question(
      2,
      "selection",
      i,
      "judgment",
      `Everyone has folded to ${pos} with ${hand}, 100 BB deep. Which reasoning fits a cautious beginner plan?`,
      good,
      [
        "The position never changes hand selection.",
        "A starting-hand chart proves one exact GTO action for every opponent.",
        ...(good.length === 1
          ? ["Any two cards must be raised because the pot is unopened."]
          : []),
      ],
      `${weak ? "This is outside a conservative early-position example range." : "This is a plausible opening candidate in the stated position."} No rake, antes or opponent reads are modeled. Other coherent strategies may differ; this checks reasoning, not profitable play.`,
      {
        hero,
        context: `6-max, ${pos} to act after earlier seats fold, blinds 0.5/1 BB; 100 BB initial stacks. Fold, call the blind or raise to at least 2 BB are legal.`,
      },
      `selection:${pos}:${hand}:100:first-in`,
    ),
  );
});
export function priceKey(pot: number, bet: number) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a),
    d = gcd(pot, bet);
  return `price:${bet / d}/${pot / d}`;
}
const priceCases = [
  [100, 50],
  [90, 60],
  [120, 90],
  [80, 160],
  [150, 30],
  [60, 180],
  [80, 100],
];
priceCases.forEach(([pot, bet], i) => {
  const r = potOdds(pot, bet),
    value = Number((r.required * 100).toFixed(2)),
    wrong = [
      (bet / (pot + bet)) * 100,
      (bet / pot) * 100,
      value + 5,
      value - 5,
      10,
      20,
      50,
    ]
      .map((n) => Number(n.toFixed(2)))
      .filter((n) => n > 0 && n <= 100 && n !== value);
  add(
    question(
      3,
      "price",
      i,
      "math",
      `Pot before the opponent’s bet: ${pot}. New bet: ${bet}. What is the immediate break-even share if you call, ignoring future betting and rake?`,
      `${value.toFixed(2)}%`,
      [...new Set(wrong)].slice(0, 3).map((n) => `${n.toFixed(2)}%`),
      `Pot now = ${pot} + ${bet} = ${r.potNow}. After your call it is ${r.finalPot}. Required share = ${bet} / ${r.finalPot} = ${value.toFixed(2)}%. The denominator includes your own call; this price alone does not tell you your hand’s equity or the best action.`,
      {
        context:
          "Heads-up price exercise. Both players can cover the bet; no player remains behind.",
      },
      priceKey(pot, bet),
    ),
  );
});
const shares = [
  { tie: 3, share: 1 / 3 },
  { tie: 2, share: 1 / 2 },
  { tie: 4, share: 1 / 4 },
  { tie: 5, share: 1 / 5 },
  { tie: 6, share: 1 / 6 },
  { tie: 0, share: 0 },
  { tie: -1, share: 0.375 },
];
shares.forEach((s, i) => {
  const prompt =
    s.tie > 0
      ? `${s.tie} players tie for the best hand on this board and all have equal pot claims. What share does each receive?`
      : s.tie === 0
        ? "Two opponents tie for best, but hero loses. What is hero’s pot share?"
        : "In four equally weighted hypothetical terminal outcomes, hero wins outright once, ties with one opponent once, and loses twice. What is mean pot share?";
  const value = (s.share * 100).toFixed(2) + "%",
    wrong = ["0.00%", "25.00%", "50.00%", "100.00%", "33.33%", "75.00%"]
      .filter((v) => v !== value)
      .slice(0, 3);
  add(
    question(
      3,
      "share",
      i,
      "math",
      prompt,
      value,
      wrong,
      s.tie > 0
        ? `Tie probability is 100% for each winner in this specified outcome, but share is 1/${s.tie} = ${value}. All winners’ shares sum to one.`
        : s.tie === 0
          ? "Only players tied for best share the pot. A losing player does not get tie credit just because the opponents tie."
          : "The synthetic outcome summary gives (1 + 1/2 + 0 + 0) / 4 = 0.375. This is a counting exercise, not a claimed frequency for an actual poker matchup.",
      s.tie > 0
        ? {
            hero: "2d 3c",
            board: "As Ks Qs Js Ts",
            context:
              "A royal flush lies on board. Other hole cards are distinct and cannot improve it; equal pot claims, no side pots.",
          }
        : {
            context:
              "The stated outcome summary is the complete hypothetical data for this calculation.",
          },
      `share:${s.tie}`,
    ),
  );
});
const controlCases = [
  ["Qs Qd", "Jh 7c 3s"],
  ["Ks Kd", "Jh 7s 2d"],
  ["Ts Td", "Qc 8h 4s"],
  ["Ah Qd", "Ac 9s 5h"],
  ["Js Jd", "Tc 8h 6s"],
  ["Kh Qd", "Qc 7s 2h"],
  ["6s 6d", "Ac Kh 3s"],
] as const;
controlCases.forEach(([hero, board], i) => {
  const pairRank = parseCards(hero)[0].rank,
    over = pairRank > Math.max(...parseCards(board).map((c) => c.rank));
  const good =
    i === 6
      ? [
          "Checking back can preserve showdown value while avoiding a pot that mainly attracts stronger hands.",
        ]
      : [
          "A value bet can make sense if worse hands will call at the chosen size.",
          "Checking back can be defensible to control the pot or retain weaker hands.",
        ];
  add(
    question(
      4,
      "value-control",
      i,
      "judgment",
      "The BB checks to BTN on the flop. Which explanation can justify a line?",
      good,
      [
        "A pair guarantees that betting any size is profitable.",
        "Position makes checking illegal.",
        ...(good.length === 1
          ? ["Small pairs must automatically commit the entire stack."]
          : []),
      ],
      `${over ? "The hole-card pair is above every board rank." : "Recompute the best hand rather than treating any pair as invulnerable."} Seek worse callers for value; use checking deliberately when building the pot does not help. Accepted lines depend on assumptions, not a solver output.`,
      {
        hero,
        board,
        context:
          "6-max preflop, now heads-up BTN versus BB. BTN raised to 3 BB, BB called; SB’s 0.5 BB is dead. Pot 6.5 BB; both have 97 BB left. BB checks; BTN may check or bet at least 1 BB.",
      },
    ),
  );
});
const defenceCases = [
  ["Ah Jd", "Ac 8h 4s 7d 2c", 4],
  ["Kh Qd", "Kc 9h 3s 6d 2c", 8],
  ["As Kd", "Ks Jh 6c 4d 2h", 15],
  ["Qh Jd", "Kc 9h 3s 2d 7c", 12],
  ["8s 7s", "6s 5d Kc", 2],
  ["As Kd", "Qs Jh Tc 3d 2s", 10],
  ["2d 3c", "As Ks Qs Js Ts", 5],
] as const;
defenceCases.forEach(([hero, board, bet], i) => {
  const special = i === 5 || i === 6;
  const good =
    i === 5
      ? [
          "Hero has the ace-high straight; on this unpaired, non-flush board it cannot be beaten.",
        ]
      : i === 6
        ? [
            "All continuing players have the board’s royal flush; a tie is not a sole win.",
          ]
        : i === 4
          ? [
              "Calling can preserve the straight draw at a manageable price.",
              "A selective semi-bluff raise can be defensible if the opponent can fold.",
            ]
          : [
              "Calling can be a defensible bluff-catch if enough worse hands bet.",
              "Folding can be defensible against a stronger value-heavy betting range.",
            ];
  add(
    question(
      4,
      "defence-reasoning",
      i,
      special ? "fact" : "judgment",
      special
        ? "Which claim is supported by the known cards?"
        : "You face a bet. Which reasoning is defensible under its stated assumption?",
      good,
      special
        ? [
            "Any bet proves the opponent has the nuts.",
            "The earlier streets guarantee who must win.",
            "Future drawing outs remain on the river.",
          ]
        : [
            "Pot odds alone prove calling is correct.",
            "Raising guarantees that every better hand folds.",
          ],
      special
        ? "Compare the actual best five cards. Betting strategy still requires a model of opponents, costs and responses."
        : i === 4
          ? "This is a drawing hand, not a made straight. Calling or semi-bluffing needs a price/range plan and can still lose."
          : "A profile is a tendency, not proof. Name the value hands and bluffs behind a call or fold; there is no context-free optimal-action grade.",
      {
        hero,
        board,
        context: `Heads-up play-chip exercise. Pot before villain’s new bet ${bet}: 20 BB. Hero already checked this street, both had 80 BB available and villain now bets ${bet} BB. Hero can fold, call, or make a full raise to at least ${2 * bet} BB.`,
      },
    ),
  );
});
const textures = [
  ["Ks 8s 2d", "Ah Qd"],
  ["6s 6d Qs", "Ah Kd"],
  ["Kh 8h 4h", "As Qd"],
  ["Ac 8d 4s", "Kh Qc"],
  ["Kh 9h 3h 2h", "Ac Ad"],
  ["7c 7d Kh 3c 2h", "Ks Kd"],
  ["As Kd 9h 6c 2s", "Qc Jd"],
] as const;
textures.forEach(([board, hero], i) => {
  const t = analyzeTexture(parseCards(board), parseCards(hero));
  const correct = `${t.paired ? "Paired" : "Unpaired"} · ${t.suitLabel} · hero ${t.made}`;
  const wrong = [
    "Every player already has a flush.",
    "The board guarantees every player a full house.",
    "A possible draw is automatically a made hand.",
  ];
  add(
    question(
      5,
      "texture",
      i,
      "fact",
      "Which description follows from these actual cards?",
      correct,
      wrong,
      `Suit counts and distinct ranks determine the board labels; hero’s actual best five make ${t.made?.toLowerCase()}. A possible opponent holding is not a known hand. ${t.canDraw ? "Future cards may change relative strength." : "This is the river: no future drawing card remains."}`,
      { hero, board },
      `texture:${board}:${hero}`,
    ),
  );
});
const drawCases = [
  ["As Qs", "Js 7s 2d", []],
  ["Ah Qh", "Jh 7h 2c", ["Kh 9d"]],
  ["As Ks", "Qs 8s 2d", ["Js Ts"]],
  ["8s 7d", "6c 5h Kd", ["4d Ah"]],
  ["Ah Qd", "Jc Ts 2s", ["Ks Kd"]],
  ["8s 7s", "6s 5s Kd", ["9s 4d"]],
  ["Ah Qh", "Jh 7h 2c 9d", ["9s 9c"]],
] as const;
drawCases.forEach(([hero, board, opponents], i) => {
  const h = parseCards(hero),
    b = parseCards(board),
    o = opponents.map(parseCards),
    r = drawReport(h, b, o);
  const value = i === 6 ? r.clean.length : r.total;
  add(
    question(
      5,
      "draw-counting",
      i,
      "math",
      i === 6
        ? "Every opponent hand is known and the next card is the river. How many flush-completing cards also win outright?"
        : "How many distinct unseen next cards complete a flush or straight? Exclude the explicitly known opponent cards; do not assume every completion wins.",
      `${value} cards`,
      [0, 2, 4, 7, 8, 9, 13, 15, 17]
        .filter((n) => n !== value)
        .slice(0, 3)
        .map((n) => `${n} cards`),
      i === 6
        ? `${r.total} hearts complete the flush, but ${r.uncertain.map((c) => "23456789TJQKA"[c.card.rank - 2] + "h").join(" and ")} also give the opponent a full house or quads. Only ${r.clean.length} win the specified showdown.`
        : `Flush candidates ${r.flushCount} + straight candidates ${r.straightCount} − overlap ${r.overlap} = ${r.total}. Known opponent cards are unavailable. Improvement is not guaranteed winning equity.`,
      {
        hero,
        board,
        opponents: [...opponents],
        context:
          "Opponent cards shown here are explicitly known for this counting exercise, unlike hidden cards in a recorded-hand decision review.",
      },
      `draw-count:${hero}:${board}:${opponents.join("/")}`,
    ),
  );
});
const comboCases: [string, Record<string, number>][] = [
  ["A pair", { KK: 100 }],
  ["A pair", { AA: 100 }],
  ["One suited class", { AKs: 100 }],
  ["One offsuit class", { AQo: 100 }],
  [
    "All starting-hand classes",
    Object.fromEntries(["__all__"].map((k) => [k, 100])),
  ],
  ["A pair plus a suited class", { QQ: 100, AJs: 100 }],
  ["A pair plus an offsuit class", { TT: 100, KQo: 100 }],
];
comboCases.forEach(([name, weights], i) => {
  const all = i === 4,
    range: WeightedRange = {
      version: 1,
      weights: all
        ? Object.fromEntries(
            (() => {
              const rank = "AKQJT98765432";
              const a: string[] = [];
              for (let r = 0; r < 13; r++)
                for (let c = 0; c < 13; c++)
                  a.push(
                    r === c
                      ? rank[r] + rank[c]
                      : r < c
                        ? rank[r] + rank[c] + "s"
                        : rank[c] + rank[r] + "o",
                  );
              return a;
            })().map((h) => [h, 100]),
          )
        : weights,
    },
    n = expandRange(range, []).length;
  add(
    question(
      6,
      "combinations",
      i,
      "math",
      `${name}: ${all ? "all 169 classes" : Object.keys(weights).join(" + ")}, no blockers. How many physical combinations are included?`,
      `${n} combos`,
      [4, 6, 10, 12, 18, 169, 1326]
        .filter((v) => v !== n)
        .slice(0, 3)
        .map((v) => `${v} combos`),
      `Pairs have 6, suited classes 4, offsuit classes 12. Sum surviving physical combinations, not boxes in the 169 grid. This range contains ${n} combinations.`,
      {
        context:
          "The displayed cards illustrate a range member, not unavailable blockers. Count the full stated range from a fresh 52-card deck.",
        hero: all
          ? "As Kh"
          : Object.keys(weights)[0][0] +
            "s " +
            Object.keys(weights)[0][1] +
            (Object.keys(weights)[0][2] === "s" ? "s" : "d"),
      },
      i <= 1 ? "combo:pair" : `combo:${i}`,
    ),
  );
});
const blockedCases = [
  ["KK", "Kc"],
  ["AA", "As"],
  ["AA", "As Ad"],
  ["AA", "As Ad Ah"],
  ["AKs", "As"],
  ["AKo", "As"],
  ["AKs", "As Kh"],
] as const;
blockedCases.forEach(([hand, known], i) => {
  const n = expandRange(
    { version: 1, weights: { [hand]: 100 } },
    parseCards(known),
  ).length;
  add(
    question(
      6,
      "blockers",
      i,
      "math",
      `Known unavailable cards: ${known}. How many ${hand} combinations survive?`,
      `${n} combos`,
      [0, 1, 2, 3, 4, 6, 9, 12]
        .filter((v) => v !== n)
        .slice(0, 3)
        .map((v) => `${v} combos`),
      `Expand ${hand} to physical two-card hands, discard any containing ${known}, then normalize the remaining raw mass. ${n} survive. An empty range must be rejected rather than silently made uniform.`,
      {
        hero: known,
        context: `These cards are explicitly known blockers, not hidden opponent cards: ${known}.`,
      },
      i <= 1 ? "block:pair:one" : `block:${hand}:${known}`,
    ),
  );
});
const information = [
  [
    "At a recorded flop decision, which cards may enter hero’s equity calculation as known?",
    "Hero’s two cards and the board already revealed",
    [
      "The actual hidden opponent cards recovered from the deal seed",
      "The future turn and river from the finished journal",
      "Folded opponents’ private cards",
    ],
    "The review projection excludes the deck, deal seed, hidden holes and later board. Retrospective access to a result does not make it prior information.",
  ],
  [
    "Hero is deciding on the turn. Which comparison respects the information cutoff?",
    "Recalculate an earlier flop decision with that earlier board and participant set",
    [
      "Use the final river for both calculations",
      "Remove players who fold later from the earlier point",
      "Pretend a later showdown reveal was known earlier",
    ],
    "Earlier calculations must use earlier public information, including who was still in at that point.",
  ],
  [
    "An opponent folded without showing. How should their cards affect a review calculation?",
    "Do not treat their private cards as known dead cards",
    [
      "Read the seed to remove the exact cards",
      "Always remove two aces",
      "Show their cards in the range editor",
    ],
    "Hidden folded cards are unknown; action-conditioned fold ranges are a separate modeling problem, not a license to peek.",
  ],
  [
    "Only old aggregate hand statistics are saved. Can a complete hand be replayed accurately?",
    "No; a reconstructable history is needed",
    [
      "Yes, invent a likely deal",
      "Yes, statistics identify the original deck",
      "Yes, the win percentage uniquely determines the actions",
    ],
    "The studio preserves statistics but does not fabricate missing journals.",
  ],
  [
    "A contested showdown reveals eligible hands. What happens when replay returns to an earlier decision?",
    "Those opponents’ cards must be concealed again",
    [
      "Keep them as known equity inputs",
      "Assume their future hands were obvious",
      "Erase hero’s own cards instead",
    ],
    "A reveal is information from that later point. Earlier decisions keep their original information boundary.",
  ],
  [
    "Which action history belongs beside a decision being reviewed?",
    "Only actions observed before the selected decision",
    [
      "All later raises and the winner payout",
      "Only the winning player’s future actions",
      "A solver-invented betting line",
    ],
    "The recorded hero choice can be shown separately as the action under review; future opponent actions and payouts must not contaminate its snapshot.",
  ],
  [
    "What can a saved opponent range in the Review Studio establish?",
    "A user-supplied hypothesis, not their actual hidden cards",
    [
      "A certified GTO range",
      "Proof of a particular two-card hand",
      "A guaranteed profitable response",
    ],
    "A transparent range assumption can be calculated correctly while still being strategically wrong.",
  ],
] as const;
information.forEach((r, i) =>
  add(
    question(7, "information", i, "fact", r[0], r[1], [...r[2]], r[3], {
      hero: "Ah Qc",
      board: "Js 7d 3c",
    }),
  ),
);
const uncertainty = [
  [
    "A simulation reports no losses in 100 trials. What follows?",
    "No losses were observed; rare losses may still be possible",
    [
      "The true loss probability is exactly zero",
      "The simulation is exhaustive",
      "The hand cannot lose in any legal deal",
    ],
    "A finite sample can miss rare events. Report sample count and uncertainty; do not turn a zero count into proof.",
  ],
  [
    "An exact enumeration finishes within its cap. What does “exact” mean?",
    "All supported outcomes were counted under the stated cards and range model",
    [
      "The supplied opponent model must be correct",
      "The recorded action has exact positive EV",
      "A global GTO solution was found",
    ],
    "Exact conditional probability does not validate range assumptions, future behavior or betting strategy.",
  ],
  [
    "What do more Monte Carlo trials mainly reduce?",
    "Sampling error under the same model",
    [
      "An incorrect opponent-range assumption",
      "All future betting uncertainty",
      "The chance of every losing runout",
    ],
    "Larger samples cannot repair wrong inputs or a model that ignores future decisions.",
  ],
  [
    "Four individual 95% intervals are shown. What can you claim?",
    "They are individual uncertainty intervals, not automatically a joint 95% guarantee",
    [
      "All four contain truth together with exactly 95% probability",
      "Every estimate is exact",
      "Confidence levels add up to 380% certainty",
    ],
    "Separate interval coverage is not a simultaneous guarantee, and PRNG-based simulation still relies on its sampling model.",
  ],
  [
    "Why is one unusually successful session not validated poker proficiency?",
    "Outcomes and a small set of repeated fixtures do not independently measure broad skill",
    [
      "Winning guarantees every decision was correct",
      "One repeated answer proves transfer to every situation",
      "A larger displayed rating makes it scientifically validated",
    ],
    "Separate conceptual checks, diverse scenarios, uncertainty and external educational validation. The Academy does not issue a validated numerical player rating.",
  ],
  [
    "Two estimated equities differ slightly and their uncertainty is substantial. What is justified?",
    "The difference may be sampling noise; inspect assumptions and intervals",
    [
      "The larger number proves a better betting action",
      "Both are exact because they have decimals",
      "Use the winning seed as evidence",
    ],
    "Estimated scenario differences are not solver-backed EV comparisons. Equity alone does not determine the best action.",
  ],
  [
    "The same fixture is answered correctly many times. How should independent assessment evidence change?",
    "It remains one seen scenario; repetition is useful practice, not new independent evidence",
    [
      "Every repeat is a fresh independent success",
      "It certifies mastery of all related concepts",
      "It should erase all first-attempt errors",
    ],
    "Reassessment can show practice feedback, but fresh evidence should come from distinct scenarios; repeated choices must not inflate coverage.",
  ],
] as const;
uncertainty.forEach((r, i) =>
  add(question(7, "uncertainty", i, "fact", r[0], r[1], [...r[2]], r[3])),
);
export const QUESTIONS: readonly Question[] = Q;
export function getQuestion(id: string) {
  const q = QUESTIONS.find((q) => q.id === id);
  if (!q) throw Error("Unknown Academy exercise.");
  return q;
}
export function gradeQuestion(id: string, choice: string) {
  const q = getQuestion(id);
  if (!q.options.some((o) => o.id === choice))
    throw Error("Unknown answer option.");
  return {
    accepted: q.accepted.includes(choice),
    kind: q.kind,
    explanation: q.explanation,
  };
}
export function optionOrder(q: Question, session: number) {
  const offset = hash(q.id + ":" + session) % q.options.length;
  return [...q.options.slice(offset), ...q.options.slice(0, offset)];
}
const lessonTexts: Record<Concept, [string, string, string]> = {
  actions: [
    "Act within the rules",
    "Check when nothing is owed. Call matches the outstanding wager up to your stack. Raise increases the total street wager by a legal amount. One short all-in is not a full raise, but cumulative increases can reopen action.",
    "Try a rules check using the visible example.",
  ],
  rankings: [
    "Use the best five",
    "Hold’em uses the best five cards from two hole cards and five board cards; you may use zero, one or two hole cards. Compare category, then relevant kickers. Unused cards do not break ties.",
    "Read all seven cards before naming the hand.",
  ],
  position: [
    "Information arrives in order",
    "With six seats, preflop order is UTG, HJ, CO, BTN, SB, BB. After the flop, action starts with the first live seat clockwise from BTN. Heads-up BTN is SB and acts first preflop, last postflop.",
    "Trace the six-seat order before choosing who acts first.",
  ],
  selection: [
    "Choose a range, not a superstition",
    "Position, depth, prior action and opponents change which starting hands are reasonable. A conservative opening sample teaches a plan; it is not an exact GTO chart or a calling range.",
    "Compare a conditional explanation with an absolute claim.",
  ],
  price: [
    "Price is a fraction of the final pot",
    "Call cost divided by the pot after calling is the immediate break-even share if no future costs occur. Include the opponent’s bet and your own call. Price does not measure hand equity.",
    "Work out the denominator before choosing a percentage.",
  ],
  share: [
    "Equity counts fractional shares",
    "A sole winner gets one pot; three tied winners each get one third. A losing player gets nothing even if other players tie. Expected share is not the same as tie frequency or strategic betting EV.",
    "A royal flush on board illustrates equal shares.",
  ],
  "value-control": [
    "Explain what betting achieves",
    "A value bet needs worse hands willing to call. A bluff needs better hands that might fold. Checking can preserve showdown value and protect a range; a pair is not an obligation to build a large pot.",
    "Inspect the made hand and price before evaluating the reasoning.",
  ],
  "defence-reasoning": [
    "Defend a line with assumptions",
    "Calling, raising or folding depends on which hands bet and which continue. Draws can support calls or semi-bluffs; river calls cannot buy a future card. Multiple lines can be defensible.",
    "Separate a factual hand claim from a conditional strategy line.",
  ],
  texture: [
    "Read patterns precisely",
    "Paired ranks and suit counts are deterministic. Wet/dry is a disclosed teaching heuristic. A monotone board permits some flushes; it does not give everyone a flush.",
    "Look at hero’s actual best hand, not just a possible opponent holding.",
  ],
  "draw-counting": [
    "Count cards, not overlapping lists",
    "A flush draw normally has four cards of a suit, with another card to come. Open-ended and gutshot draws have different completing ranks. Remove explicitly known cards and count overlaps once. Hitting does not guarantee winning.",
    "Count distinct physical candidates in the example.",
  ],
  combinations: [
    "169 boxes represent 1,326 deals",
    "There are 6 physical ways to hold a pair, 4 ways to hold one suited class and 12 ways to hold one offsuit class. Equal grid weights are per combination, not equal probability per box.",
    "Compare the physical count with the number of labels.",
  ],
  blockers: [
    "Remove cards before normalizing",
    "An exposed card eliminates every combination containing it. Normalize over surviving legal combo mass. Across multiple opponent ranges, condition on the entire assignment being collision-free; naive sequential renormalization is biased.",
    "Use the known blocker example; no hidden cards are assumed.",
  ],
  information: [
    "Review what you knew then",
    "Only hero cards, revealed board and observed actions belong at a decision point. Future cards, later folds and opponent showdown reveals were not earlier knowledge. Missing histories cannot be reconstructed from win totals.",
    "Identify which proposed input crosses the information boundary.",
  ],
  uncertainty: [
    "Keep facts, models and claims separate",
    "Exact probabilities can be exact under the wrong assumed range. Monte Carlo has sampling uncertainty. Strategic advice and self-report are not validated proficiency measures; repeated fixtures are not independent evidence.",
    "Choose the limited claim that the evidence actually supports.",
  ],
};
const specs = [
  [
    "Rules, actions and hand rankings",
    "Foundations",
    ["actions", "rankings"],
    "opening",
  ],
  [
    "Position and starting-hand selection",
    "Foundations",
    ["position", "selection"],
    "opening",
  ],
  ["Pot odds and equity", "Building blocks", ["price", "share"], "pot-odds"],
  [
    "Postflop fundamentals",
    "Applied reasoning",
    ["value-control", "defence-reasoning"],
    "control",
  ],
  [
    "Board textures and draws",
    "Applied reasoning",
    ["texture", "draw-counting"],
    "draws",
  ],
  [
    "Opponent ranges and blockers",
    "Deeper reasoning",
    ["combinations", "blockers"],
    "value",
  ],
  [
    "Hand review and uncertainty",
    "Deeper reasoning",
    ["information", "uncertainty"],
    "defence",
  ],
] as const;
export const MODULES: AcademyModule[] = specs.map(
  ([title, level, concepts, drill], i) => ({
    id: i + 1,
    title,
    level,
    concepts: [...concepts],
    drill,
    objectives: [
      `Explain ${LABELS[concepts[0]].toLowerCase()} in a new example.`,
      `Apply ${LABELS[concepts[1]].toLowerCase()} without relying on a repeated answer.`,
      "State what the example establishes, and what it does not.",
    ],
    lessons: concepts.map((concept) => ({
      id: `lesson-${concept}`,
      concept,
      title: lessonTexts[concept][0],
      text: lessonTexts[concept][1],
      tryIt: lessonTexts[concept][2],
      practiceId: `a6-${concept}-0`,
    })),
  }),
);
export function getModule(id: number) {
  const m = MODULES.find((m) => m.id === id);
  if (!m) throw Error("Unknown Academy module.");
  return m;
}
