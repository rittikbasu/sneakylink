import { X, Users, Target } from "lucide-react";
import QuestionIcon from "./QuestionIcon";

const TEAM_CONFIG = {
  A: {
    name: "Team A",
    color: "emerald",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/5",
    borderColor: "border-emerald-500/20",
    badgeBg: "bg-emerald-500/20",
    dotColor: "bg-emerald-500",
  },
  B: {
    name: "Team B",
    color: "sky",
    textColor: "text-sky-400",
    bgColor: "bg-sky-500/5",
    borderColor: "border-sky-500/20",
    badgeBg: "bg-sky-500/20",
    dotColor: "bg-sky-500",
  },
  C: {
    name: "Team C",
    color: "rose",
    textColor: "text-rose-400",
    bgColor: "bg-rose-500/5",
    borderColor: "border-rose-500/20",
    badgeBg: "bg-rose-500/20",
    dotColor: "bg-rose-500",
  },
};

function TeamBlock({ teamKey, players, score, config }) {
  if (!players || players.length === 0) return null;

  return (
    <div
      className={`rounded-xl ${config.bgColor} border ${config.borderColor} overflow-hidden`}
    >
      {/* Team Header with Score */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
          <span className={`font-semibold ${config.textColor} text-sm`}>
            {config.name}
          </span>
        </div>
        {score !== undefined && (
          <div className={`${config.textColor} text-sm font-bold tabular-nums`}>
            {score}
          </div>
        )}
      </div>

      {/* Players */}
      <div className="px-2 pb-2 space-y-1">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/5"
          >
            <span className="text-sm text-gray-300 truncate min-w-0 flex-1">
              {player.name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {player.isYou && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${config.badgeBg} ${config.textColor} font-medium uppercase`}
                >
                  You
                </span>
              )}
              {player.isHost && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 font-medium uppercase">
                  Host
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
  teams,
  scores,
  isHost,
  onShowRules,
  onEndGame,
  winSequences = 2,
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
          <div className="flex-1 p-4 space-y-5">
            {/* Sequences to win */}
            <div className="rounded-xl bg-zinc-900/60 border border-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-gray-400">
                    Sequences to win
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white tabular-nums">
                    {winSequences}
                  </span>
                </div>
              </div>
            </div>

            {/* Teams Section */}
            {teams && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    Teams
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <TeamBlock
                    teamKey="A"
                    players={teams.A}
                    score={scores?.A}
                    config={TEAM_CONFIG.A}
                  />
                  <TeamBlock
                    teamKey="B"
                    players={teams.B}
                    score={scores?.B}
                    config={TEAM_CONFIG.B}
                  />
                  {teams.C && teams.C.length > 0 && (
                    <TeamBlock
                      teamKey="C"
                      players={teams.C}
                      score={scores?.C}
                      config={TEAM_CONFIG.C}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 flex gap-2">
            <button
              onClick={onShowRules}
              className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-700 text-zinc-200 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <QuestionIcon className="w-4 h-4 text-zinc-400" />
              Show Rules
            </button>
            {isHost && onEndGame && (
              <button
                onClick={onEndGame}
                className="flex-1 py-3 rounded-lg bg-red-600/80 hover:bg-red-600 text-zinc-200 font-semibold transition-colors"
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
