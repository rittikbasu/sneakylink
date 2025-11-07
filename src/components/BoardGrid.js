import layout from "@/data/boardLayout";
import PlayingCard from "@/components/PlayingCard";

export default function BoardGrid({
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
      <div className="rounded-xl p-2 sm:p-3 bg-white/60 dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
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
                onClick={() => (canClick ? onSquareClick(idx) : null)}
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
