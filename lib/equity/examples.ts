import { parseCards } from "../postflop/texture";
import type { EquityInput } from "./engine";
export const baseInput = (
  hero: string,
  board: string,
  opponents: (string | null)[],
): EquityInput => ({
  hero: parseCards(hero),
  board: parseCards(board),
  opponents: opponents.map((h) => (h === null ? null : parseCards(h))),
  seed: 2026,
  samples: 5000,
  mode: "auto",
});
/** Authored, card-validated illustrations; no external expert review or GTO claim. */
export const EQUITY_EXAMPLES = [
  {
    id: "overpair",
    name: "Heads-up overpairs",
    input: baseInput("As Ah", "Qs 7d 2c", ["Ks Kh"]),
    lesson:
      "Both players have a pair on this flop. Completing all possible boards accounts for sets, straights, flushes and shared-board ties; current hand rank alone is not the final result.",
  },
  {
    id: "royal-split",
    name: "Three-way board royal flush",
    input: baseInput("2d 3c", "As Ks Qs Js Ts", ["4d 5c", "6d 7c"]),
    lesson:
      "Everyone uses the board’s royal flush. Each player ties, and each receives one third of an equal pot. A 100% tie probability is not 100% pot equity.",
  },
  {
    id: "dirty-flush",
    name: "Turn draw versus a set",
    input: baseInput("As Qs", "Js 7s 2d 9c", ["9h 9d"]),
    lesson:
      "Some spades complete the flush but also pair the board, giving the known opponent a full house or quads. The outs trainer certifies next-card wins only when the river and every opponent hand are fully determined.",
  },
  {
    id: "multi-overpair",
    name: "Three-way overpair versus a set",
    input: baseInput("As Ah", "Kd 7c 2s", ["Ks Qd", "7s 7h"]),
    lesson:
      "Aces are an overpair, but another player already has a set. In a multiway pot, winning requires beating every opponent; heads-up equity cannot simply be reused or multiplied.",
  },
  {
    id: "multi-draw",
    name: "Three-way combination draw",
    input: baseInput("8s 7s", "6s 5s Kd", ["Kh Qc", "6d 6c"]),
    lesson:
      "The flush/straight candidates overlap, and a river board pair can change who wins even after a draw hits. Equity assumes everyone reaches showdown; it does not tell you whether calling a bet is correct.",
  },
  {
    id: "six-random",
    name: "Aces against five random hands",
    input: baseInput("As Ah", "", [null, null, null, null, null]),
    lesson:
      "Five unknown hands are dealt jointly without replacement. Each opponent is uniform over legal hands conditional on visible cards, not an opening or calling range. More opponents create more ways for someone else to win; the simulation is not a strategy recommendation.",
  },
] as const;
