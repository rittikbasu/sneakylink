import { useEffect, useRef, useState } from "react";
import PlayingCard from "@/components/PlayingCard";
import { parseCard } from "@/lib/deck";
// no icons currently used

export default function Footer({
  hand = [],
  selectedCard = null,
  onCardSelect,
  onConfirmMove,
  onDeadCard,
  canConfirm = false,
  canDead = false,
  turnUsername = "",
  teamColorClass = "",
  myTurn = false,
  myTeamColor = undefined,
}) {
  const [cellPx, setCellPx] = useState(null);
  const cardsBoxRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      const firstCell = document.querySelector("#board-grid > div");
      if (firstCell) {
        const rect = firstCell.getBoundingClientRect();
        setCellPx(rect.width);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 backdrop-blur">
      <div className="w-full max-w-screen-sm sm:max-w-3xl md:max-w-5xl mx-auto px-3 sm:px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        {/* Heading row */}
        <div className="flex items-center gap-2 mb-1">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 select-none">
            Your cards
          </div>
          <div className="w-px h-3 bg-neutral-500/30" />
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 select-none">
            <span className={teamColorClass}>
              {myTurn ? "Your" : turnUsername + "'s"}
            </span>{" "}
            turn
          </div>
        </div>

        {/* Cards + Button row */}
        <div className="flex items-center gap-2">
          {/* Left: Your cards */}
          <div
            ref={cardsBoxRef}
            className="flex-1 min-w-0 overflow-x-auto overflow-y-visible scrollbar-none -mx-1.5 px-1.5"
          >
            <div className="flex items-center gap-1 gap-x-2 sm:gap-1.5 snap-x snap-mandatory py-0.5">
              {hand.map((cardStr, i) => {
                const { rank, suit } = parseCard(cardStr);
                const isSelected = selectedCard === cardStr;
                const ringColorClass =
                  myTeamColor === "emerald"
                    ? "ring-emerald-500"
                    : myTeamColor === "sky"
                    ? "ring-sky-500"
                    : myTeamColor === "rose"
                    ? "ring-rose-500"
                    : "ring-blue-500";
                return (
                  <button
                    key={`${cardStr}-${i}`}
                    type="button"
                    onClick={() => onCardSelect?.(cardStr)}
                    style={
                      cellPx
                        ? { width: `${Math.max(40, Math.min(cellPx, 56))}px` }
                        : undefined
                    }
                    className={
                      (cellPx ? "" : "w-10 sm:w-12 md:w-14 ") +
                      "shrink-0 snap-center relative focus:outline-none"
                    }
                  >
                    <PlayingCard
                      type="card"
                      rank={rank}
                      suit={suit}
                      interactive={false}
                    />
                    {isSelected && (
                      <div
                        className={`absolute inset-0 ring-2 rounded-md pointer-events-none ${ringColorClass}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Action button - aligned with cards */}
          {canDead ? (
            <button
              type="button"
              onClick={onDeadCard}
              style={
                cellPx
                  ? {
                      height: `${Math.max(56, Math.min(cellPx * 1.4, 78))}px`,
                    }
                  : undefined
              }
              className={
                (cellPx ? "" : "h-14 sm:h-16 md:h-[78px] ") +
                "shrink-0 w-24 sm:w-28 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors flex items-center justify-center"
              }
            >
              <span className="text-center leading-tight">
                Dead
                <br />
                Card?
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmMove}
              disabled={!canConfirm}
              style={
                cellPx
                  ? {
                      height: `${Math.max(56, Math.min(cellPx * 1.4, 78))}px`,
                    }
                  : undefined
              }
              className={
                (cellPx ? "" : "h-14 sm:h-16 md:h-[78px] ") +
                "shrink-0 w-28 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-semibold transition-colors flex items-center justify-center"
              }
            >
              <span className="text-center leading-tight">
                Confirm
                <br />
                Move?
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
