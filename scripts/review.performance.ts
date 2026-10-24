import { it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { buildReview } from "../lib/review/model";
import { newHand, legal } from "../lib/poker";
import { freshSession, tableAction } from "../lib/hand-session";
import { createEquityJob } from "../lib/equity/engine";
import { baseInput } from "../lib/equity/examples";
import {
  expandRange,
  uniformRange,
  type WeightedRange,
} from "../lib/equity/ranges";
function measure(fn: () => void) {
  fn();
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  return Number(times.sort((a, b) => a - b)[2].toFixed(3));
}
it("measures real validated review and weighted equity work without timing thresholds", () => {
  let game = newHand(99),
    session = freshSession(game);
  while (game.street !== "Showdown") {
    const n = tableAction(session, game, legal(game).call ? "call" : "check");
    game = n.game;
    session = n.session;
  }
  const r = (weights: Record<string, number>): WeightedRange => ({
      version: 1,
      weights,
    }),
    input = {
      ...baseInput("Qh Qd", "Ah 2c 3d 4h 9s", [null, null]),
      ranges: [r({ AA: 1, KK: 1 }), r({ AA: 1, KK: 3 })],
    };
  const compute = (samples: number, mode: "exact" | "monte-carlo") => {
    const j = createEquityJob({ ...input, samples, mode });
    while (j.progress().completed < j.progress().total) j.step(500);
    const result = j.result();
    expect(result.complete).toBe(true);
    return result;
  };
  const report = {
    node: process.version,
    cpu: cpus()[0]?.model,
    logicalCPUs: cpus().length,
    memoryGiB: Number((totalmem() / 2 ** 30).toFixed(2)),
    method:
      "median of 5 runs after one warm-up; wall-clock ms, Node synchronous batches; no worker/yield overhead",
    reviewDecisions: buildReview(session.active).decisions.length,
    measurementsMs: {
      reconstructCompletedHand: measure(() => {
        expect(buildReview(session.active).decisions).toHaveLength(4);
      }),
      expandFull169Range: measure(() => {
        expect(
          expandRange(uniformRange(), input.hero.concat(input.board)).length,
        ).toBeGreaterThan(0);
      }),
      weightedExact42Allocations: measure(() => {
        expect(compute(1, "exact").players[1].equity).toBe(0.7);
      }),
      weightedMonteCarlo10000: measure(() => {
        compute(10000, "monte-carlo");
      }),
    },
  };
  writeFileSync(
    "docs/phase5-performance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
});
