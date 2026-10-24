import Link from "next/link";
export default function BeginnerGuide() {
  return (
    <section className="beginner-guide" aria-label="Beginner quick start">
      <div>
        <span className="eyebrow">NEW TO POKER? START HERE</span>
        <h2>Your first practice session</h2>
        <p>
          Learn one idea, try a knowledge check, then play a hand with fictional
          chips. There is no time limit and no penalty for mistakes.
        </p>
        <Link className="primary" href="/academy">
          Start your first lesson →
        </Link>
      </div>
      <details>
        <summary>Follow the beginner guide & learn the terms</summary>
        <ol>
          <li>
            <Link href="/academy">Academy:</Link> start Module 1. Answer the
            card examples, mark each lesson explored, then open Assessment.
            Explanations appear after every answer.
          </li>
          <li>
            <Link href="/?workspace=Practice">Play:</Link> use Call or Check to
            follow a hand to showdown. Call matches a bet; Check passes when you
            owe nothing. Folding ends your part in the hand.
          </li>
          <li>
            <Link href="/review">Review:</Link> once the hand finishes, select
            one of your decisions. Read what was known then; opponents’ hidden
            cards stay hidden.
          </li>
          <li>
            <Link href="/?workspace=Equity">Equity:</Link> start with an example
            and choose Calculate equity. It counts possible showdowns, not the
            best betting action.
          </li>
          <li>
            <Link href="/?workspace=Train">Train:</Link> practice a weak topic.
            Your saved lessons and assessments resume on this browser after
            reload. Use Train → Data to export a backup.
          </li>
        </ol>
        <dl className="beginner-terms">
          <div>
            <dt>Hole cards / board</dt>
            <dd>Your two private cards / the shared community cards.</dd>
          </div>
          <div>
            <dt>Blinds / BB</dt>
            <dd>
              Forced opening bets. BB means one big blind, a unit for comparing
              chip amounts.
            </dd>
          </div>
          <div>
            <dt>Pot / stack</dt>
            <dd>Chips contested in this hand / chips a player has left.</dd>
          </div>
          <div>
            <dt>Position / BTN</dt>
            <dd>
              Your place in the action order. BTN is the dealer button, usually
              last after the flop when still playing.
            </dd>
          </div>
          <div>
            <dt>UTG / HJ / CO / SB</dt>
            <dd>
              Under the gun (first before the flop in six-seat play), hijack,
              cutoff, and small blind. Six-seat order: UTG, HJ, CO, BTN, SB, BB.
            </dd>
          </div>
          <div>
            <dt>Hero / villain</dt>
            <dd>
              You / another player. “Villain” does not mean the opponent is
              cheating.
            </dd>
          </div>
          <div>
            <dt>Equity / pot odds</dt>
            <dd>
              Average share of the pot at showdown under stated assumptions /
              the immediate price of calling. Neither alone proves which action
              is best.
            </dd>
          </div>
          <div>
            <dt>Outs / range / GTO</dt>
            <dd>
              Cards that could improve a hand / possible opponent hands /
              game-theory optimal strategy. PokerLab’s strategy lessons are
              simplified heuristics, not certified GTO advice.
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
