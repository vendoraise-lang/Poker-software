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
  return (
    <div
      className={`seat seat-${i} ${game.actor === i ? "active-seat" : ""} ${p.folded ? "folded" : ""}`}
    >
      <div className="seat-cards">
        {p.cards.length ? (
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
          <span className="busted">Sitting out</span>
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
                ? "Ready"
                : p.profile}
      </div>
      {!complete && p.bet > 0 && (
        <div className="seat-bet">
          <span>▰</span> {p.bet}
        </div>
      )}
    </div>
  );
}
