import { X, Users, Trophy, ScrollText } from "lucide-react";

export default function Sidebar({
  isOpen,
  onClose,
  teams,
  scores,
  isHost,
  onShowRules,
  onEndGame,
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 " +
          (isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none")
        }
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={
          "fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 overflow-y-auto border-r border-white/10 " +
          "bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_60%,black_100%)] backdrop-blur " +
          "transition-all duration-300 " +
          (isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "-translate-x-full opacity-0 pointer-events-none")
        }
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
              Game Info
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 space-y-6">
            {/* Scores Section */}
            {scores && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    Scores
                  </h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10">
                    <span className="text-emerald-400 font-semibold">
                      Team A
                    </span>
                    <span className="text-emerald-400 font-bold text-lg">
                      {scores.A}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-sky-500/10">
                    <span className="text-sky-400 font-semibold">Team B</span>
                    <span className="text-sky-400 font-bold text-lg">
                      {scores.B}
                    </span>
                  </div>
                  {scores.C !== undefined && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-500/10">
                      <span className="text-rose-400 font-semibold">
                        Team C
                      </span>
                      <span className="text-rose-400 font-bold text-lg">
                        {scores.C}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Teams Section */}
            {teams && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    Teams
                  </h3>
                </div>
                <div className="space-y-3">
                  {/* Team A */}
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                    <div className="text-emerald-400 font-semibold mb-2 text-sm">
                      Team A
                    </div>
                    <div className="space-y-1">
                      {teams.A.map((player) => (
                        <div
                          key={player.id}
                          className="text-sm text-gray-300 px-2 py-1 rounded bg-white/5"
                        >
                          {player.name}
                          {player.isYou && (
                            <span className="ml-2 text-[10px] text-emerald-400">
                              (YOU)
                            </span>
                          )}
                          {player.isHost && (
                            <span className="ml-2 text-[10px] text-gray-500">
                              (HOST)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-3">
                    <div className="text-sky-400 font-semibold mb-2 text-sm">
                      Team B
                    </div>
                    <div className="space-y-1">
                      {teams.B.map((player) => (
                        <div
                          key={player.id}
                          className="text-sm text-gray-300 px-2 py-1 rounded bg-white/5"
                        >
                          {player.name}
                          {player.isYou && (
                            <span className="ml-2 text-[10px] text-sky-400">
                              (YOU)
                            </span>
                          )}
                          {player.isHost && (
                            <span className="ml-2 text-[10px] text-gray-500">
                              (HOST)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team C */}
                  {teams.C && teams.C.length > 0 && (
                    <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
                      <div className="text-rose-400 font-semibold mb-2 text-sm">
                        Team C
                      </div>
                      <div className="space-y-1">
                        {teams.C.map((player) => (
                          <div
                            key={player.id}
                            className="text-sm text-gray-300 px-2 py-1 rounded bg-white/5"
                          >
                            {player.name}
                            {player.isYou && (
                              <span className="ml-2 text-[10px] text-rose-400">
                                (YOU)
                              </span>
                            )}
                            {player.isHost && (
                              <span className="ml-2 text-[10px] text-gray-500">
                                (HOST)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <button
              onClick={onShowRules}
              className="w-full py-3 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-zinc-200 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <ScrollText className="w-4 h-4 text-zinc-400" />
              Show Rules
            </button>
            {isHost && (
              <button
                onClick={onEndGame}
                className="w-full py-3 rounded-lg bg-red-600/80 hover:bg-red-600 text-zinc-200 font-semibold transition-colors"
              >
                End Game
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
