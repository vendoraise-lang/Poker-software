import Card from "./Card";
import { position, type Game } from "@/lib/poker";
export default function PlayerSeat({
  game,
  index: i,
  highlightedCards,
}: {
  game: Game;
  index: number;
  highlightedCards?: Set<number>;
}) {
  const p = game.players[i];
  const complete = game.street === "Showdown";
  const latestAction = [...game.log].reverse().find(line =>
    line.startsWith(p.name + " ") &&
    / (fold|check|call|bet|raise)( |$)/.test(line)
  );
  const showAction = !complete && latestAction &&
    !game.log.slice(game.log.lastIndexOf(latestAction) + 1).some(line => line.startsWith("— "));
  const actionText = latestAction?.slice(p.name.length + 1) ?? "";
  return (
    <div
      className={`seat seat-${i} ${game.actor === i ? "active-seat" : ""} ${p.folded ? "folded" : ""} ${complete && game.awards[i] > 0 ? "awarded-seat" : ""}`}
    >
      {showAction && <div className="seat-action-bubble" key={latestAction} aria-label={`${p.name} ${actionText}`}>{actionText}</div>}
      <div className="seat-cards">
        {p.cards.length && !(complete && p.folded) ? (
          p.cards.map((c, j) => (
            <span key={j} className={highlightedCards ? highlightedCards.has(j) ? "best-five-card" : "non-best-card" : undefined}>
            <Card
              card={c}
              small
              hidden={
                i !== 0 &&
                !(
                  complete &&
                  !p.folded &&
                  game.players.filter((p) => !p.folded).length > 1
                )
              }
            />
            </span>
          ))
        ) : (
          <span className="busted">{p.cards.length ? "Folded" : "Sitting out"}</span>
        )}
      </div>
      <div className="seat-info">
        <span className={`avatar avatar-${i}`}>
          {i === 0 ? "Y" : p.name[0]}
        </span>
        <div>
          <b>
            {p.name} {i === 0 && <em>YOU</em>}
          </b>
          <small>
            {p.chips.toLocaleString()} <span>chips</span>
          </small>
        </div>
        <span className={`position ${position(game, i) === "BTN" ? "dealer-position" : ""}`}>{position(game, i) === "BTN" ? "D" : position(game, i)}</span>
      </div>
      <div className="seat-caption">
        {p.folded
          ? "Folded"
          : p.chips === 0
            ? "All-in"
            : game.actor === i
              ? "Thinking…"
              : i === 0
                ? "Your turn"
                : "In hand"}
      </div>
      {complete && game.awards[i] > 0 && (
        <div className="seat-award" role="status">+{game.awards[i].toLocaleString()} chips</div>
      )}
      {!complete && p.bet > 0 && (
        <div className="seat-bet">
          <span aria-hidden="true" /> <strong>{p.bet.toLocaleString()}</strong>
        </div>
      )}
    </div>
  );
}
