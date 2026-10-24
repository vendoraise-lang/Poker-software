import { describe, it, expect } from "vitest";
import { evaluate, newHand, legal, type Action } from "../lib/poker";
import {
  analyzeTexture,
  parseCards,
  validateCards,
} from "../lib/postflop/texture";
import {
  POSTFLOP,
  postLegal,
  gradePost,
  postById,
} from "../lib/postflop/scenarios";
import {
  emptyPost,
  recordPost,
  reviewState,
  practiceQueue,
  conceptStats,
  validatePost,
} from "../lib/postflop/progress";
import {
  journalFor,
  restoreJournal,
  replayFrames,
  freshSession,
  tableAction,
  nextTable,
  validateSession,
  startOrigin,
} from "../lib/hand-session";
import {
  applyBackup,
  collectBackup,
  validateBackup,
  strictTraining,
} from "../lib/backup";
import { emptyTraining } from "../lib/training/progress";
import { emptyProgress } from "../lib/progress";
describe("postflop teaching consistency", () => {
  it("has 30 unique spots with ten per street and real disjoint cards", () => {
    expect(POSTFLOP).toHaveLength(30);
    expect(new Set(POSTFLOP.map((s) => s.id)).size).toBe(30);
    for (const street of ["Flop", "Turn", "River"])
      expect(POSTFLOP.filter((s) => s.street === street)).toHaveLength(10);
    for (const s of POSTFLOP) {
      expect(s.hole).toHaveLength(2);
      expect(() => validateCards([...s.hole, ...s.board])).not.toThrow();
      expect(s.board.length).toBe(
        s.street === "Flop" ? 3 : s.street === "Turn" ? 4 : 5,
      );
      expect(s.stack).toBeGreaterThan(s.size);
      expect(s.opponentStack).toBeGreaterThan(0);
      expect(s.size).toBeGreaterThanOrEqual(s.facingBet ? 2 * s.facingBet : 1);
      expect(s.pot).toBe(
        (s.street === "Flop" || s.prior.some((t) => t.includes("Pot stays"))
          ? 6.5
          : s.street === "Turn"
            ? 12.5
            : 24.5) + s.facingBet,
      );
    }
  });
  it.each(POSTFLOP.map((s, i) => [s, i] as const))(
    "verifies actual made hand for $id",
    (s, i) => {
      const categories = [
        1, 3, 1, 0, 0, 0, 1, 1, 0, 0, 2, 1, 5, 0, 1, 0, 3, 0, 4, 1, 5, 1, 0, 1,
        1, 6, 0, 1, 4, 0,
      ];
      expect(evaluate([...s.hole, ...s.board])[0]).toBe(categories[i]);
    },
  );
  it("accepts only legal choices, explains every accepted answer and labels alternatives", () => {
    for (const s of POSTFLOP) {
      expect(s.accepted[s.preferred]).toBeTruthy();
      for (const a of Object.keys(s.accepted) as Action[]) {
        expect(postLegal(s)).toContain(a);
        expect(gradePost(s, a).correct).toBe(true);
        expect(gradePost(s, a).explanation.length).toBeGreaterThan(40);
      }
      if (Object.keys(s.accepted).length > 1) expect(s.judgment).toBe(true);
      for (const a of postLegal(s))
        expect(gradePost(s, a).correct).toBe(!!s.accepted[a]);
      expect(() => gradePost(s, s.facingBet ? "check" : "call")).toThrow();
    }
    expect(() => postById("not real")).toThrow();
  });
  it("limits all-in and unopposed actions correctly", () => {
    const s = POSTFLOP[4];
    expect(postLegal({ ...s, stack: s.facingBet })).toEqual(["fold", "call"]);
    expect(postLegal({ ...s, facingBet: 0, opponentStack: 0 })).toEqual([
      "check",
    ]);
    expect(postLegal({ ...s, opponentStack: 0 })).toEqual(["fold", "call"]);
  });
});
describe("deterministic board texture", () => {
  it.each([
    ["As 7d 2c", "Rainbow", false],
    ["Ks 9s 3d", "Two-tone", false],
    ["Kh 9h 3h", "Monotone", false],
    ["As Ad 7c", "Rainbow", true],
  ])("detects %s", (board, label, paired) => {
    const t = analyzeTexture(parseCards(board));
    expect(t.suitLabel).toBe(label);
    expect(t.paired).toBe(paired);
  });
  it("detects connected/wet and dry boards, including ace-low connectivity", () => {
    expect(analyzeTexture(parseCards("As 7d 2c")).wet).toBe(false);
    expect(analyzeTexture(parseCards("Qs Jh 9d")).connected).toBe(3);
    expect(analyzeTexture(parseCards("As 2d 3c")).possibleStraight).toBe(true);
    expect(analyzeTexture(parseCards("Ks 9s 3d")).possibleFlushDraw).toBe(true);
  });
  it("separates a possible opponent flush, actual flush draw and made flush", () => {
    const board = parseCards("Ks 9s 3d");
    const draw = analyzeTexture(board, parseCards("As Qs"));
    expect(draw.made).toBe("High card");
    expect(draw.flushDraw).toBe(true);
    expect(draw.madeFlush).toBe(false);
    const made = analyzeTexture(parseCards("Ks 9s 3s"), parseCards("As Qs"));
    expect(made.possibleFlush).toBe(true);
    expect(made.madeFlush).toBe(true);
    expect(made.flushDraw).toBe(false);
    const no = analyzeTexture(parseCards("Ks 9s 3s"), parseCards("Ah Qd"));
    expect(no.possibleFlush).toBe(true);
    expect(no.madeFlush).toBe(false);
  });
  it("does not label a backdoor flush possibility as an immediate draw", () => {
    const t = analyzeTexture(parseCards("Kd 7s 2c"), parseCards("As Qs"));
    expect(t.flushDraw).toBe(false);
    expect(t.madeFlush).toBe(false);
  });
  it("finds open straight completions and closes draws on the river", () => {
    const t = analyzeTexture(parseCards("6c 5h Kd"), parseCards("8s 7d"));
    expect(t.straightRanks).toEqual([4, 9]);
    expect(t.madeStraight).toBe(false);
    const river = analyzeTexture(
      parseCards("6c 5h Kd Qc 2s"),
      parseCards("8s 7d"),
    );
    expect(river.canDraw).toBe(false);
    expect(river.straightRanks).toEqual([]);
    expect(river.flushDraw).toBe(false);
    expect(river.made).toBe("High card");
  });
  it("rejects duplicate and malformed cards without inventing results", () => {
    expect(() => parseCards("As As")).toThrow();
    expect(() => parseCards("ZZ")).toThrow();
    expect(() => analyzeTexture(parseCards("As 7d"))).toThrow();
    expect(() =>
      analyzeTexture(parseCards("As 7d 2c"), parseCards("As Kh")),
    ).toThrow();
    expect(parseCards("10h 2c")).toEqual([
      { rank: 10, suit: 1 },
      { rank: 2, suit: 3 },
    ]);
  });
});
describe("retrieval spacing and distinct evidence", () => {
  it("never turns repeated identical answers into independent mastery observations", () => {
    let p = emptyPost();
    for (let i = 0; i < 20; i++)
      p = recordPost(p, "f-value-overpair", "bet", 100);
    expect(reviewState(p, "f-value-overpair")).toMatchObject({
      streak: 1,
      due: 101,
    });
    expect(conceptStats(p).value).toMatchObject({ seen: 1, correct: 1 });
  });
  it("preserves the first miss despite same-day corrections, then spaces later retrievals", () => {
    let p = recordPost(emptyPost(), "f-value-overpair", "check", 100); // accepted first observation
    p = recordPost(p, "f-value-overpair", "check", 101);
    expect(reviewState(p, "f-value-overpair")).toMatchObject({
      streak: 2,
      due: 104,
    });
    p = recordPost(p, "f-value-overpair", "bet", 104);
    expect(reviewState(p, "f-value-overpair").due).toBe(111);
    const weak = POSTFLOP[1];
    p = recordPost(p, weak.id, "check", 100);
    p = recordPost(p, weak.id, "bet", 100);
    expect(reviewState(p, weak.id)).toMatchObject({
      streak: 0,
      correct: false,
      missed: true,
      due: 101,
    });
    expect(practiceQueue(p, 101)[0]).toBe(weak.id);
    expect(practiceQueue(p, 100, true)).toContain(weak.id);
  });
  it("keeps historical misses reviewable after a later successful retrieval", () => {
    let p = recordPost(emptyPost(), "f-value-set", "check", 200);
    p = recordPost(p, "f-value-set", "bet", 201);
    expect(reviewState(p, "f-value-set")).toMatchObject({
      missed: true,
      correct: true,
    });
    expect(practiceQueue(p, 202, true)).toContain("f-value-set");
  });
  it("validates known IDs, legal actions, dates and order", () => {
    expect(() => validatePost({ version: 5, attempts: [] })).toThrow();
    expect(() => recordPost(emptyPost(), "missing", "bet", 10)).toThrow();
    expect(() => recordPost(emptyPost(), "f-value-set", "call", 10)).toThrow();
    expect(() => recordPost(emptyPost(), "f-value-set", "bet", NaN)).toThrow();
    const p = recordPost(emptyPost(), "f-value-set", "bet", 10);
    expect(validatePost(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(() =>
      validatePost({ ...p, attempts: [...p.attempts, ...p.attempts] }),
    ).toThrow();
  });
});
function played() {
  let g = newHand(22),
    session = freshSession(g);
  while (g.street !== "Showdown") {
    const n = tableAction(session, g, legal(g).call ? "call" : "check");
    g = n.game;
    session = n.session;
  }
  return { g, session };
}
describe("validated hand persistence and replay", () => {
  it("rebuilds initial and unfinished states exactly, with no stored deck trust", () => {
    let g = newHand(2026),
      s = freshSession(g);
    expect(restoreJournal(s.active).game).toEqual(g);
    for (let i = 0; i < 7; i++) {
      const n = tableAction(s, g, legal(g).call ? "call" : "check");
      g = n.game;
      s = n.session;
    }
    expect(validateSession(JSON.parse(JSON.stringify(s)))).toEqual({
      session: s,
      game: g,
    });
    expect(
      restoreJournal({ ...s.active, deck: [{ rank: 1, suit: 10 }] }).game,
    ).toEqual(g);
  });
  it("preserves rotation and stacks when creating the next journal", () => {
    const { g, session } = played();
    const n = nextTable(session, g);
    expect(n.game.dealer).toBe(1);
    expect(restoreJournal(n.session.active).game).toEqual(n.game);
    expect(n.session.completed).toHaveLength(1);
    expect(() => nextTable(n.session, n.game)).toThrow();
  });
  it("rejects invalid chips, actors encoded as illegal actions, oversized bets, excessive history and future versions", () => {
    const j = journalFor(newHand());
    expect(() =>
      restoreJournal({
        ...j,
        origin: { ...j.origin, stacks: [999, 1000, 1000, 1000] },
      }),
    ).toThrow();
    expect(() =>
      restoreJournal({ ...j, commands: [{ action: "check" }] }),
    ).toThrow();
    expect(() =>
      restoreJournal({ ...j, commands: [{ action: "raise", amount: 10000 }] }),
    ).toThrow();
    expect(() =>
      restoreJournal({ ...j, commands: Array(513).fill({ action: "call" }) }),
    ).toThrow();
    expect(() => validateSession({ ...freshSession(), version: 9 })).toThrow();
  });
  it("conceals every opponent and future board until the relevant reveal", () => {
    const { session } = played(),
      frames = replayFrames(session.completed[0]);
    expect([...new Set(frames.map((f) => f.street))]).toEqual([
      "Preflop",
      "Flop",
      "Turn",
      "River",
      "Showdown",
    ]);
    for (const f of frames) {
      expect(f).not.toHaveProperty("deck");
      expect(f.board.length).toBe(
        f.street === "Preflop"
          ? 0
          : f.street === "Flop"
            ? 3
            : f.street === "Turn"
              ? 4
              : 5,
      );
      if (f.street !== "Showdown")
        expect(f.players.slice(1).every((p) => p.cards === null)).toBe(true);
      expect(
        f.players.reduce((n, p) => n + p.chips, 0) +
          (f.street === "Showdown" ? 0 : f.pot),
      ).toBe(4000);
    }
    expect(frames.at(-1)!.players.every((p) => p.cards?.length === 2)).toBe(
      true,
    );
  });
  it("keeps folded cards hidden and does not fabricate unreached streets", () => {
    let g = newHand(),
      s = freshSession(g);
    while (g.street !== "Showdown") {
      const n = tableAction(s, g, "fold");
      g = n.game;
      s = n.session;
    }
    const frames = replayFrames(s.active);
    expect(frames.every((f) => f.board.length === 0)).toBe(true);
    expect(
      frames
        .at(-1)!
        .players.slice(1)
        .every((p) => p.cards === null),
    ).toBe(true);
    expect(() => replayFrames(freshSession().active)).toThrow();
  });
  it("adds runout frames for all-ins without exposing winners or chips early", () => {
    let g = newHand(19),
      s = freshSession(g);
    while (g.street !== "Showdown") {
      const l = legal(g);
      const n = tableAction(
        s,
        g,
        l.canRaise ? "raise" : "call",
        l.canRaise ? l.max : undefined,
      );
      g = n.game;
      s = n.session;
    }
    const frames = replayFrames(s.active);
    for (const f of frames.filter((f) => f.street !== "Showdown")) {
      expect(f.players.slice(1).every((p) => p.cards === null)).toBe(true);
      expect(f.players.reduce((n, p) => n + p.chips, 0) + f.pot).toBe(4000);
    }
    expect(frames.some((f) => f.street === "Flop")).toBe(true);
    expect(frames.some((f) => f.street === "Turn")).toBe(true);
    expect(frames.some((f) => f.street === "River")).toBe(true);
  });
  it("can restore a short-blind immediate runout and retain original starting balances", () => {
    const origin = { seed: 2, dealer: 0, hand: 7, stacks: [3995, 5, 0, 0] };
    const g = startOrigin(origin);
    expect(g.street).toBe("Showdown");
    expect(journalFor(g).origin).toEqual(origin);
    expect(restoreJournal(journalFor(g)).game).toEqual(g);
  });
});
describe("portable progress validation and confirmed writes", () => {
  const backup = () => ({
    format: "pokerlab-progress",
    version: 3,
    game: { ...emptyProgress, table: played().session },
    training: emptyTraining(),
    postflop: emptyPost(),
  });
  it("roundtrips all phases and hand journals", () => {
    const p = backup(),
      b = validateBackup(JSON.stringify(p));
    expect(b).toEqual(p);
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    };
    applyBackup(storage, b, true);
    expect(collectBackup(storage)).toEqual(b);
  });
  it("requires confirmation before writing anything", () => {
    let writes = 0;
    const s = {
      getItem: () => null,
      setItem: () => {
        writes++;
      },
      removeItem: () => {
        writes++;
      },
    };
    expect(() =>
      applyBackup(s, validateBackup(JSON.stringify(backup())), false),
    ).toThrow(/confirmation/);
    expect(writes).toBe(0);
  });
  it("rejects invalid JSON, unsupported versions, bad hand rules and fake training records", () => {
    const b = backup();
    for (const raw of [
      "invalid",
      JSON.stringify({ ...b, version: 99 }),
      JSON.stringify({ ...b, game: { ...b.game, hands: -1 } }),
      JSON.stringify({
        ...b,
        training: {
          ...b.training,
          attempts: [
            {
              id: 1,
              kind: "decision",
              target: "fake",
              choice: "Raise",
              source: "practice",
            },
          ],
        },
      }),
      JSON.stringify({ ...b, postflop: { version: 1, attempts: [null] } }),
    ])
      expect(() => validateBackup(raw)).toThrow();
    expect(() =>
      strictTraining({
        version: 1,
        attempts: [],
        sessions: [],
        daily: { broken: true },
      }),
    ).toThrow();
  });
  it("supports v2 files without wiping Phase 3 data", () => {
    const p = backup();
    const old = validateBackup(
      JSON.stringify({ ...p, version: 2, postflop: undefined }),
    );
    expect(old.postflop).toBeNull();
    const data = new Map<string, string>([
      ["pokerlab-postflop-v1", "preserve"],
    ]);
    applyBackup(
      {
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => {
          data.set(k, v);
        },
        removeItem: (k) => {
          data.delete(k);
        },
      },
      old,
      true,
    );
    expect(data.get("pokerlab-postflop-v1")).toBe("preserve");
  });
  it("restores previous values if a write fails partway", () => {
    const data = new Map([
      ["pokerlab-progress", "old game"],
      ["pokerlab-training-v1", "old training"],
    ]);
    let writes = 0;
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (++writes === 2) throw Error("quota");
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    };
    expect(() =>
      applyBackup(storage, validateBackup(JSON.stringify(backup())), true),
    ).toThrow(/restored/);
    expect(data.get("pokerlab-progress")).toBe("old game");
    expect(data.get("pokerlab-training-v1")).toBe("old training");
    expect(data.has("pokerlab-postflop-v1")).toBe(false);
  });
});

describe("river texture and long-session journals", () => {
  it("does not call every river wet just because one suit repeats", () => {
    const t = analyzeTexture(parseCards("As Kd 9h 6c 2s"));
    expect(t.wet).toBe(false);
    expect(t.possibleFlush).toBe(false);
    expect(t.possibleFlushDraw).toBe(false);
  });
  it("reconstructs 24 completed hands exactly and retains only 20 replays", () => {
    let game = newHand(75),
      session = freshSession(game);
    for (let hand = 0; hand < 24; hand++) {
      while (game.street !== "Showdown") {
        const n = tableAction(
          session,
          game,
          legal(game).call ? "call" : "check",
        );
        game = n.game;
        session = n.session;
      }
      expect(restoreJournal(session.active).game).toEqual(game);
      if (hand < 23) {
        const next = nextTable(session, game);
        game = next.game;
        session = next.session;
      }
    }
    expect(session.completed).toHaveLength(20);
    expect(validateSession(JSON.parse(JSON.stringify(session))).game).toEqual(
      game,
    );
  });
});
