import { Trophy, Frown } from "lucide-react";

export default function GameOverOverlay({
  show,
  onClose,
  winner,
  isWinner,
  activeTeams,
  isSolo,
  soloWinnerName,
  grouped,
  sidebarScores,
}) {
  return (
    <>
      <div
        className={
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 " +
          (show
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none")
        }
        onClick={onClose}
      />
      <div
        className={
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md z-50 flex flex-col rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_70%,black_100%)] backdrop-blur transition duration-300 transform " +
          (show
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none")
        }
      >
        <div className="flex items-center p-4 border-b border-white/10 shrink-0">
          <h2 className="text-xl font-bold bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
            Game Results
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                isWinner
                  ? "bg-amber-500/20 ring-4 ring-amber-500/30"
                  : "bg-zinc-500/15 ring-4 ring-zinc-500/30"
              }`}
            >
              {isWinner ? (
                <Trophy className="w-10 h-10 text-yellow-500" />
              ) : (
                <Frown className="w-10 h-10 text-zinc-300" />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">
              {isWinner ? "You Won!" : winner ? "Game Over!" : "Game Ended"}
            </h1>
            <p
              className={`text-lg font-semibold ${
                winner === "A"
                  ? "text-emerald-400"
                  : winner === "B"
                  ? "text-sky-400"
                  : winner === "C"
                  ? "text-rose-400"
                  : "text-gray-400"
              }`}
            >
              {winner
                ? isSolo
                  ? `${soloWinnerName || `Team ${winner}`} Wins`
                  : `Team ${winner} Wins`
                : "No winner"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Final Scores
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 font-semibold">
                  {(isSolo ? grouped.A[0]?.name : "Team A") || "Team A"}
                </span>
                <span className="text-emerald-400 font-bold text-lg">
                  {sidebarScores?.A}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <span className="text-sky-400 font-semibold">
                  {(isSolo ? grouped.B[0]?.name : "Team B") || "Team B"}
                </span>
                <span className="text-sky-400 font-bold text-lg">
                  {sidebarScores?.B}
                </span>
              </div>
              {activeTeams === 3 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <span className="text-rose-400 font-semibold">
                    {(isSolo ? grouped.C[0]?.name : "Team C") || "Team C"}
                  </span>
                  <span className="text-rose-400 font-bold text-lg">
                    {sidebarScores?.C}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30"
          >
            View Board
          </button>
        </div>
      </div>
    </>
  );
}
