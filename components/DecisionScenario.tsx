import Card from "./Card";
import {
  gradeDecision,
  legalChoices,
  scenarioCards,
  TOPIC_LABELS,
  type Choice,
  type Scenario,
} from "@/lib/training/fixtures";
export default function DecisionScenario({
  scenario: s,
  answer,
  onAnswer,
}: {
  scenario: Scenario;
  answer: Choice | null;
  onAnswer: (choice: Choice) => void;
}) {
  const grade = answer ? gradeDecision(s, answer) : null;
  return (
    <section className="decision-scenario" aria-label="Decision scenario">
      <div className="drill-topline">
        <span className="eyebrow">6-MAX · PREFLOP</span>
        <span className="fixture-id">
          Level {s.level} · {TOPIC_LABELS[s.topic]}
        </span>
      </div>
      <div className="scenario-summary">
        <div className="drill-cards">
          {scenarioCards(s).map((card, i) => (
            <Card key={i} card={card} />
          ))}
        </div>
        <div>
          <h2>
            {s.hand} in the {s.position}
          </h2>
          <p>
            {s.strength} starting-hand group · {s.stackBB} BB effective before
            the hand
          </p>
        </div>
      </div>
      <dl className="scenario-facts">
        <div>
          <dt>Blinds</dt>
          <dd>0.5 / 1 BB</dd>
        </div>
        <div>
          <dt>Already invested</dt>
          <dd>{s.investedBB} BB</dd>
        </div>
        <div>
          <dt>Stack remaining</dt>
          <dd>{s.stackBB - s.investedBB} BB</dd>
        </div>
        <div>
          <dt>Cost to call</dt>
          <dd>{s.currentBetBB - s.investedBB} BB</dd>
        </div>
      </dl>
      <div className="seat-order" aria-label="Six seats in preflop order">
        {["UTG", "HJ", "CO", "BTN", "SB", "BB"].map((p) => (
          <span className={p === s.position ? "hero-position" : ""} key={p}>
            {p}
            {p === s.position ? " · YOU" : ""}
          </span>
        ))}
      </div>
      <h3>Before your turn</h3>
      <ol className="prior-actions">
        {s.prior.length ? (
          s.prior.map((a, i) => (
            <li key={i}>
              <b>{a.position}</b>{" "}
              {a.action === "Fold" ? "folds" : `raises to ${a.toBB} BB`}
            </li>
          ))
        ) : (
          <li>
            Small blind posts 0.5 BB; big blind posts 1 BB. You are first to
            act.
          </li>
        )}
      </ol>
      <p className="scenario-prompt">
        What is your plan? Choose a legal action.
      </p>
      <div className="trainer-actions">
        {legalChoices(s).map((choice) => (
          <button
            key={choice}
            disabled={answer !== null}
            className={`${choice === "Raise" ? "primary" : ""} ${answer === choice ? "chosen" : ""}`}
            onClick={() => onAnswer(choice)}
          >
            {choice}
            {choice === "Call"
              ? ` ${s.currentBetBB - s.investedBB} BB`
              : choice === "Raise"
                ? ` to ${s.raiseToBB} BB`
                : ""}
          </button>
        ))}
      </div>
      {grade && (
        <div
          className={`answer-feedback ${grade.correct ? "correct" : "reconsider"}`}
          role="status"
        >
          <h3>
            {grade.correct
              ? answer === s.preferred
                ? "✓ Matches the teaching baseline"
                : "✓ Reasonable alternative"
              : "A useful spot to revisit"}
          </h3>
          <p>{grade.explanation}</p>
          <p>
            <b>Preferred teaching line: {s.preferred}.</b>
            {s.accepted.length > 1
              ? ` Also accepted: ${s.accepted.filter((c) => c !== s.preferred).join(", ")}.`
              : ""}
          </p>
          <details>
            <summary>Explore all three decisions</summary>
            {legalChoices(s).map((c) => (
              <p key={c}>
                <b>{c}: </b>
                {s.explanations[c]}
              </p>
            ))}
          </details>
        </div>
      )}
      <p className="teaching-note">
        Illustrative beginner strategy at the stated depth, with no rake or
        antes. Multiple strategies can be reasonable. This is not an exact GTO
        solution or an EV estimate.
      </p>
    </section>
  );
}
