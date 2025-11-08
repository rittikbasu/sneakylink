import React, { memo } from "react";
import layout from "@/data/boardLayout";
import PlayingCard from "@/components/PlayingCard";
import { hapticTap } from "@/lib/haptics";

function BoardGridInner({
  chips = new Map(),
  onSquareClick,
  highlight = new Set(),
  allowed = null,
  seqA = new Set(),
  seqB = new Set(),
  seqC = new Set(),
  highlightColor = "emerald",
}) {
  return (
    <div className="w-full max-w-screen-sm sm:max-w-3xl md:max-w-5xl mx-auto px-2 sm:px-4">
      <div className="rounded-xl p-2 sm:p-3 bg-linear-to-b from-black via-blue-900/40 to-blue-950/20 ring-1 ring-white/10 shadow-[0_0_24px_4px_rgba(59,130,246,0.10)]">
        <div id="board-grid" className="grid grid-cols-10 gap-1.5 sm:gap-2">
          {layout.map((cell, idx) => {
            const chip = chips.get(idx);
            const isAllowed = allowed ? allowed.has(idx) : true;
            const canClick = typeof onSquareClick === "function" && isAllowed;
            const isHighlight = highlight.has(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (canClick) {
                    hapticTap();
                    onSquareClick(idx);
                  }
                }}
                className={`relative group focus:outline-none ${
                  canClick ? "cursor-pointer" : "cursor-default"
                } ${allowed ? (isAllowed ? "" : "opacity-50") : ""}`}
              >
                <PlayingCard {...cell} />
                {/* Sequence tint */}
                {seqA.has(idx) ? (
                  <div className="absolute inset-0 rounded-md bg-emerald-500/15 pointer-events-none" />
                ) : null}
                {seqB.has(idx) ? (
                  <div className="absolute inset-0 rounded-md bg-sky-500/15 pointer-events-none" />
                ) : null}
                {seqC.has(idx) ? (
                  <div className="absolute inset-0 rounded-md bg-rose-500/15 pointer-events-none" />
                ) : null}
                {/* Chip border (team ownership) */}
                {chip ? (
                  <div
                    className={`absolute inset-px sm:inset-[1.5px] rounded-md ring-2 pointer-events-none ${
                      chip === "A"
                        ? "ring-emerald-500"
                        : chip === "B"
                        ? "ring-sky-500"
                        : "ring-rose-500"
                    }`}
                  />
                ) : null}
                {/* Highlight overlay */}
                {isHighlight ? (
                  <div
                    className={`absolute inset-0 ring-2 rounded-md pointer-events-none ${
                      highlightColor === "emerald"
                        ? "ring-emerald-400/80"
                        : highlightColor === "sky"
                        ? "ring-sky-400/80"
                        : "ring-rose-400/80"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const areEqual = (prev, next) => {
  // Shallow compare props likely to change; Maps/Sets reference compare is fine if caller memoizes.
  return (
    prev.chips === next.chips &&
    prev.onSquareClick === next.onSquareClick &&
    prev.highlight === next.highlight &&
    prev.allowed === next.allowed &&
    prev.seqA === next.seqA &&
    prev.seqB === next.seqB &&
    prev.seqC === next.seqC &&
    prev.highlightColor === next.highlightColor
  );
};

const BoardGrid = memo(BoardGridInner, areEqual);
export default BoardGrid;
