import type { Card as PokerCard } from "@/lib/poker";
export default function Card({
  card,
  hidden = false,
  small = false,
}: {
  card?: PokerCard;
  hidden?: boolean;
  small?: boolean;
}) {
  return (
    <div
      role="img"
      className={`playing-card ${small ? "small" : ""} ${hidden ? "card-back" : ""} ${!hidden && card && (card.suit === 1 || card.suit === 2) ? "red" : ""}`}
      aria-label={
        hidden
          ? "Hidden card"
          : card
            ? `${card.rank === 14 ? "Ace" : card.rank === 13 ? "King" : card.rank === 12 ? "Queen" : card.rank === 11 ? "Jack" : card.rank} of ${["spades", "hearts", "diamonds", "clubs"][card.suit]}`
            : "Undealt card"
      }
    >
      {hidden ? (
        <span className="card-mark">♧</span>
      ) : card ? (
        <>
          <b>
            {({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[
              card.rank
            ] ?? card.rank}
          </b>
          <span>{["♠", "♥", "♦", "♣"][card.suit]}</span>
        </>
      ) : (
        <span className="empty-card">+</span>
      )}
    </div>
  );
}
