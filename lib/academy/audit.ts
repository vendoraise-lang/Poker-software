/** Structural audit, not expert validation of strategic recommendations.
 * Deliberately does not reuse answer labels as an independent maths oracle:
 * hand-counting and arithmetic expectations also live in academy.test.ts.
 */
import { QUESTIONS, MODULES } from "./content";
import { validateCards } from "../postflop/texture";
import { SCENARIOS, legalChoices, scenarioCards } from "../training/fixtures";
import { POSTFLOP, postLegal } from "../postflop/scenarios";
import { DRAW_EXERCISES, drawReport } from "../equity/draws";
import { EQUITY_EXAMPLES } from "../equity/examples";
import { validateEquity } from "../equity/engine";
import { ODDS_QUIZZES, potOdds } from "../training/odds";
export function auditTeachingMaterials() {
  const issues: string[] = [];
  for (const q of QUESTIONS) {
    try {
      validateCards([...q.hero, ...q.board, ...q.opponents.flat()]);
    } catch {
      issues.push(`${q.id}: invalid or duplicate cards`);
    }
    if (
      !MODULES.some((m) => m.id === q.module && m.concepts.includes(q.concept))
    )
      issues.push(`${q.id}: unmapped concept`);
    if (
      !q.explanation ||
      !q.basis ||
      !q.accepted.length ||
      q.accepted.some((a) => !q.options.some((o) => o.id === a)) ||
      new Set(q.options.map((o) => o.label)).size !== q.options.length ||
      q.accepted.length === q.options.length
    )
      issues.push(`${q.id}: incomplete answer contract`);
    if (q.kind === "judgment" && !q.basis.includes("external"))
      issues.push(`${q.id}: missing heuristic disclosure`);
  }
  for (const s of SCENARIOS) {
    try {
      validateCards(scenarioCards(s));
    } catch {
      issues.push(`${s.id}: invalid cards`);
    }
    if (
      !s.accepted.includes(s.preferred) ||
      s.accepted.some((a) => !legalChoices(s).includes(a))
    )
      issues.push(`${s.id}: illegal accepted action`);
    if (
      s.accepted.some((a) => !s.explanations[a]) ||
      s.raiseToBB <= s.currentBetBB ||
      s.raiseToBB > s.stackBB
    )
      issues.push(`${s.id}: incomplete price/explanation`);
  }
  for (const s of POSTFLOP) {
    try {
      validateCards([...s.hole, ...s.board]);
    } catch {
      issues.push(`${s.id}: invalid cards`);
    }
    if (
      s.board.length !== { Flop: 3, Turn: 4, River: 5 }[s.street] ||
      !s.accepted[s.preferred] ||
      Object.keys(s.accepted).some(
        (a) => !postLegal(s).includes(a as typeof s.preferred),
      )
    )
      issues.push(`${s.id}: street or accepted action mismatch`);
    if (s.size > s.stack || s.size < (s.facingBet ? 2 * s.facingBet : 1))
      issues.push(`${s.id}: illegal suggested full size`);
  }
  for (const q of ODDS_QUIZZES) {
    const target = potOdds(q.potBeforeBet, q.bet).required * 100;
    if (q.options.filter((o) => Math.abs(o - target) < 0.2).length !== 1)
      issues.push(`${q.id}: ambiguous rounded odds options`);
  }
  for (const q of DRAW_EXERCISES) {
    if (
      drawReport(q.hero, q.board).total !== q.answer ||
      q.options.filter((n) => n === q.answer).length !== 1
    )
      issues.push(`${q.id}: draw count mismatch`);
  }
  for (const q of EQUITY_EXAMPLES) {
    try {
      validateEquity(q.input);
    } catch {
      issues.push(`${q.id}: impossible equity input`);
    }
  }
  return {
    issues,
    counts: {
      modules: MODULES.length,
      academy: QUESTIONS.length,
      preflop: SCENARIOS.length,
      postflop: POSTFLOP.length,
      odds: ODDS_QUIZZES.length,
      draws: DRAW_EXERCISES.length,
      equityExamples: EQUITY_EXAMPLES.length,
    },
  };
}
