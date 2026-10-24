export type OddsQuiz = {
  id: string;
  potBeforeBet: number;
  bet: number;
  options: readonly number[];
  context: string;
};
/** Heads-up, one opponent's bet, no rake. Pot before bet excludes that new bet.
 * Required break-even share is cost / (pot before bet + bet + cost).
 * It equals a calling equity threshold only if no more betting/costs occur.
 */
export function potOdds(potBeforeBet: number, bet: number) {
  if (
    !Number.isFinite(potBeforeBet) ||
    !Number.isFinite(bet) ||
    potBeforeBet <= 0 ||
    bet <= 0
  )
    throw Error("Pot and bet must be positive finite numbers");
  const potNow = potBeforeBet + bet,
    finalPot = potNow + bet;
  return { call: bet, potNow, finalPot, required: bet / finalPot };
}
export const ODDS_QUIZZES: readonly OddsQuiz[] = [
  {
    id: "odds-half",
    potBeforeBet: 100,
    bet: 50,
    options: [20, 25, 33, 50],
    context:
      "On the river, the pot is 100 chips. Your opponent bets 50. No players remain behind you.",
  },
  {
    id: "odds-pot",
    potBeforeBet: 100,
    bet: 100,
    options: [25, 33.3, 50, 66.7],
    context: "On the river, your opponent bets 100 into a pot of 100 chips.",
  },
  {
    id: "odds-small",
    potBeforeBet: 120,
    bet: 40,
    options: [10, 20, 25, 33.3],
    context:
      "On the turn, your opponent bets 40 into 120. Treat this as a price calculation only: future betting is still possible.",
  },
  {
    id: "odds-overbet",
    potBeforeBet: 100,
    bet: 150,
    options: [25, 33.3, 37.5, 60],
    context: "On the river, the pot is 100 and the opponent bets 150 chips.",
  },
  {
    id: "odds-quarter",
    potBeforeBet: 200,
    bet: 50,
    options: [16.7, 20, 25, 50],
    context:
      "On the flop, an opponent bets 50 into a pot of 200. This question isolates the immediate price, not the whole decision.",
  },
];
export function quizById(id: string) {
  const q = ODDS_QUIZZES.find((q) => q.id === id);
  if (!q) throw Error("Unknown quiz");
  return q;
}
export function gradeOdds(q: OddsQuiz, answer: number) {
  if (!q.options.includes(answer)) throw Error("Unknown answer");
  const result = potOdds(q.potBeforeBet, q.bet);
  return {
    ...result,
    correct: Math.abs(answer - result.required * 100) < 0.051,
    percentage: Math.round(result.required * 1000) / 10,
  };
}
export const ODDS_CAUTION =
  "Pot odds describe the price. They do not tell you your hand’s equity. Consider the opponent’s range, future betting, position, and how often you can realize your equity. Without further betting or rake, this is the break-even equity threshold; earlier streets need more context.";
