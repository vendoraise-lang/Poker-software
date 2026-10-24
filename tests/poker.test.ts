import { describe, it, expect } from "vitest";
import {
  act,
  botAction,
  compare,
  deck,
  evaluate,
  legal,
  newHand,
  settle,
  type Card,
  type Game,
} from "../lib/poker";
function cards(s: string): Card[] {
  return s.split(" ").map((c) => ({
    rank: "23456789TJQKA".indexOf(c[0]) + 2,
    suit: "shdc".indexOf(c[1]),
  }));
}
describe("hand evaluation", () => {
  const hands = [
    "As Kd 9c 7h 3s",
    "As Ad 9c 7h 3s",
    "As Ad 9c 9h 3s",
    "As Ad Ac 7h 3s",
    "As 2d 3c 4h 5s",
    "As Js 9s 7s 3s",
    "As Ad Ac 7h 7s",
    "As Ad Ac Ah 3s",
    "9s Ts Js Qs Ks",
  ];
  it.each(hands.map((h, i) => [h, i] as const))("ranks %s as %i", (h, i) =>
    expect(evaluate(cards(h))[0]).toBe(i),
  );
  it("distinguishes royal flush and wheel; uses best five of seven", () => {
    expect(evaluate(cards("As Ks Qs Js Ts 2d 3d"))).toEqual([8, 14]);
    expect(evaluate(cards("As 2d 3c 4h 5s Kc Qd"))).toEqual([4, 5]);
  });
  it("compares kickers and ignores irrelevant hole cards", () => {
    expect(
      compare(
        evaluate(cards("As Ad Kc 9h 7s")),
        evaluate(cards("As Ad Qc Jh Ts")),
      ),
    ).toBeGreaterThan(0);
    expect(
      compare(
        evaluate(cards("As Ks Qs Js Ts 2d 3d")),
        evaluate(cards("As Ks Qs Js Ts 4d 5d")),
      ),
    ).toBe(0);
  });
  it("handles two triples as a full house", () =>
    expect(evaluate(cards("As Ad Ac Kh Ks Kd 2s"))).toEqual([6, 14, 13]));
});
describe("game rules", () => {
  it("shuffles a unique deck reproducibly", () => {
    expect(deck(11)).toEqual(deck(11));
    expect(deck(11)).not.toEqual(deck(12));
    expect(new Set(deck(11).map((c) => `${c.rank}-${c.suit}`)).size).toBe(52);
  });
  it("posts blinds, deals unique cards, starts UTG, rotates button", () => {
    let g = newHand();
    expect(g.dealer).toBe(0);
    expect(g.actor).toBe(3);
    expect(g.players.map((p) => p.bet)).toEqual([0, 10, 20, 0]);
    expect(
      new Set(
        [...g.deck, ...g.players.flatMap((p) => p.cards)].map(
          (c) => `${c.rank}-${c.suit}`,
        ),
      ).size,
    ).toBe(52);
    while (g.street !== "Showdown")
      g = act(g, legal(g).call ? "call" : "check");
    const n = newHand(43, g);
    expect(n.dealer).toBe(1);
    expect(n.actor).toBe(0);
  });
  it("rejects illegal checks, under-raises, oversized and fractional bets without mutation", () => {
    const g = newHand(),
      copy = structuredClone(g);
    expect(() => act(g, "check")).toThrow();
    for (const n of [21, 39, 1001, 45.5])
      expect(() => act(g, "raise", n)).toThrow();
    expect(g).toEqual(copy);
  });
  it("gives big blind an option and starts postflop left of button", () => {
    let g = newHand();
    g = act(g, "call");
    g = act(g, "call");
    g = act(g, "call");
    expect(g.actor).toBe(2);
    expect(g.street).toBe("Preflop");
    g = act(g, "check");
    expect(g.street).toBe("Flop");
    expect(g.board).toHaveLength(3);
    expect(g.actor).toBe(1);
    expect(g.currentBet).toBe(0);
  });
  it("reopens action after full raise, requiring all opponents to respond", () => {
    let g = newHand();
    g = act(g, "call");
    g = act(g, "raise", 60);
    expect(g.minRaise).toBe(40);
    expect(g.pending).toEqual([1, 2, 3]);
    expect(legal(g).min).toBe(100);
  });
  it("ends immediately when everyone else folds", () => {
    let g = newHand();
    g = act(g, "fold");
    g = act(g, "fold");
    g = act(g, "fold");
    expect(g.street).toBe("Showdown");
    expect(g.players[2].chips).toBe(1010);
    expect(g.players.reduce((n, p) => n + p.chips, 0)).toBe(4000);
    expect(g.board).toHaveLength(0);
  });
  it("short all-in requires response but does not reopen an earlier caller", () => {
    let g = newHand();
    g.players[0].chips = 30;
    g = act(g, "call");
    g = act(g, "raise", 30);
    g = act(g, "call");
    g = act(g, "call");
    expect(g.actor).toBe(3);
    expect(legal(g).call).toBe(10);
    expect(legal(g).canRaise).toBe(false);
    g = act(g, "call");
    expect(g.street).toBe("Flop");
  });
  it("runs out board with all-in players and no meaningless betting", () => {
    let g = newHand();
    g.players.forEach((p) => (p.chips = 100 - p.total));
    while (g.street !== "Showdown") {
      const l = legal(g);
      g = act(
        g,
        l.canRaise
          ? g.currentBet
            ? "raise"
            : "bet"
          : l.call
            ? "call"
            : "check",
        l.max,
      );
    }
    expect(g.board).toHaveLength(5);
    expect(g.players.reduce((n, p) => n + p.chips, 0)).toBe(400);
  });
  it("returns uncalled excess and distributes main/side pots", () => {
    const g = newHand();
    g.board = cards("2s 3d 7c 8h 9s");
    const holes = ["As Ad", "Ks Kd", "Qs Qd", "Js Jd"];
    g.players.forEach((p, i) => {
      p.cards = cards(holes[i]);
      p.total = [50, 100, 200, 200][i];
      p.chips = 0;
      p.folded = i === 3;
    });
    settle(g);
    expect(g.awards).toEqual([200, 150, 200, 0]);
  });
  it("splits ties with odd chips clockwise after the dealer", () => {
    const g = newHand();
    g.board = cards("As Ks Qs Js Ts");
    g.players.forEach((p, i) => {
      p.total = 5;
      p.chips = 0;
      p.folded = i === 3;
    });
    settle(g);
    expect(g.awards).toEqual([6, 7, 7, 0]);
  });
  it("uses heads-up button as small blind and first preflop actor", () => {
    let g = newHand();
    g.players[2].chips = 0;
    g.players[3].chips = 0;
    g = newHand(8, g);
    expect(g.dealer).toBe(1);
    expect(g.actor).toBe(1);
    expect(g.players[1].bet).toBe(10);
    g = act(g, "call");
    g = act(g, "check");
    expect(g.actor).toBe(0);
  });
  it("plays 150 seeded bot hands legally and conserves every chip", () => {
    for (let seed = 0; seed < 150; seed++) {
      let g: Game = newHand(seed);
      let steps = 0;
      while (g.street !== "Showdown" && steps++ < 250) {
        const b = botAction(g);
        g = act(g, b.action, b.amount);
        expect(g.players.every((p) => p.chips >= 0)).toBe(true);
      }
      expect(g.street).toBe("Showdown");
      expect(g.players.reduce((n, p) => n + p.chips, 0)).toBe(4000);
    }
  });
});

describe("additional betting boundaries", () => {
  it("cumulative short all-ins reopen raising after a full increase", () => {
    let g = newHand(12);
    g.players[0].chips = 30;
    g.players[1].chips = 30;
    g = act(g, "call");
    g = act(g, "raise", 30);
    g = act(g, "raise", 40);
    g = act(g, "call");
    expect(g.actor).toBe(3);
    expect(legal(g).canRaise).toBe(true);
    expect(legal(g).min).toBe(60);
  });
  it("never lets the only player with chips bet into an all-in opponent", () => {
    let g = newHand();
    g.players[0].chips = 40;
    g = act(g, "fold");
    g = act(g, "raise", 40);
    g = act(g, "fold");
    expect(g.actor).toBe(2);
    expect(legal(g).canRaise).toBe(false);
    g = act(g, "call");
    expect(g.street).toBe("Showdown");
    expect(g.board).toHaveLength(5);
  });
  it("makes deterministic transitions without mutating input", () => {
    const g = newHand(1);
    expect(act(g, "call")).toEqual(act(g, "call"));
    expect(g.players[3].bet).toBe(0);
    expect(g.log).toHaveLength(2);
  });
  it("survives multi-hand sessions, busts and rotating short stacks", () => {
    for (let seed = 0; seed < 30; seed++) {
      let g = newHand(seed);
      for (let hand = 0; hand < 20; hand++) {
        let steps = 0;
        while (g.street !== "Showdown" && steps++ < 250) {
          const b = botAction(g);
          g = act(g, b.action, b.amount);
        }
        expect(g.street).toBe("Showdown");
        expect(g.players.reduce((n, p) => n + p.chips, 0)).toBe(4000);
        if (g.players.filter((p) => p.chips > 0).length < 2) break;
        g = newHand(seed + hand * 999, g);
      }
    }
  });
});

describe("short forced blinds", () => {
  it("runs out immediately when the lone solvent player already covers the all-in blind", () => {
    const prior = newHand();
    prior.players[0].chips = 5;
    prior.players[1].chips = 100;
    prior.players[2].chips = 0;
    prior.players[3].chips = 0;
    const g = newHand(7, prior);
    expect(g.street).toBe("Showdown");
    expect(g.board).toHaveLength(5);
    expect(g.players.reduce((n, p) => n + p.chips, 0)).toBe(105);
  });
  it("charges only the unmatched part of a short all-in blind heads-up", () => {
    const prior = newHand();
    prior.players[0].chips = 15;
    prior.players[1].chips = 100;
    prior.players[2].chips = 0;
    prior.players[3].chips = 0;
    let g = newHand(7, prior);
    expect(g.actor).toBe(1);
    expect(legal(g).call).toBe(5);
    g = act(g, "call");
    expect(g.street).toBe("Showdown");
    expect(g.players.reduce((n, p) => n + p.chips, 0)).toBe(115);
  });
});
