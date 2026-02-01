import { useState } from "react";
import { Copy, Users, Check, Settings, Share2, X } from "lucide-react";

export default function LobbyView({
  room,
  players,
  playerId,
  isHost,
  me,
  codeCopied,
  linkCopied,
  onCopyCode,
  onCopyInvite,
  onSwitchTeam,
  onUpdateSettings,
  onStartGame,
  starting,
  onKickPlayer,
}) {
  const numTeams = room.settings?.teams ?? 2;
  const aPlayers = players.filter((p) => p.team === "A");
  const bPlayers = players.filter((p) => p.team === "B");
  const cPlayers = players.filter((p) => p.team === "C");
  const teamCounts =
    numTeams === 2
      ? [aPlayers.length, bPlayers.length]
      : [aPlayers.length, bPlayers.length, cPlayers.length];
  const balanced = teamCounts.every((c) => c === teamCounts[0] && c > 0);
  const myTeam = me?.team;
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const [kickTarget, setKickTarget] = useState(null);
  const [kicking, setKicking] = useState(false);

  const confirmKick = async () => {
    if (!kickTarget || !onKickPlayer) return;
    setKicking(true);
    const ok = await onKickPlayer(kickTarget.id);
    setKicking(false);
    if (ok) setKickTarget(null);
  };

  return (
    <div className="h-dvh overflow-y-auto text-white px-4 py-6">
      <div className="max-w-2xl lg:max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1 bg-linear-to-b from-white/90 via-blue-200 to-blue-500 bg-clip-text text-transparent">
            SneakyLink
          </h1>
        </div>

        <div className="space-y-4">
          {isHost && (
            <div className="text-sm pl-1 tracking-wider text-gray-500">
              You&apos;re the host
            </div>
          )}
          <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  ROOM CODE
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold tracking-widest">
                    {room.code}
                  </span>
                  <button
                    onClick={onCopyCode}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    {codeCopied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Link to this game
                </div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={onCopyInvite}
                    className="text-xl text-blue-500 font-semibold flex items-center gap-2"
                  >
                    {linkCopied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : canShare ? (
                      <Share2 className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                    <span>{canShare ? "Share Link" : "Copy Link"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-linear-to-br from-emerald-950/50 to-emerald-900/20 rounded-2xl border border-emerald-900/40 overflow-hidden">
              <div className="bg-emerald-950/30 px-3 py-2 border-b border-emerald-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-emerald-400 text-sm">
                      Team A
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400/70 text-xs">
                    <Users className="w-3 h-3" />
                    <span>{aPlayers.length}</span>
                  </div>
                </div>
              </div>
              <div
                className={`py-3 px-1.5 space-y-1.5 ${
                  numTeams === 3 ? "min-h-[123px]" : "min-h-[100px]"
                }`}
              >
                {aPlayers.length > 0 ? (
                  aPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5"
                    >
                      <div className="text-sm font-medium truncate">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.id === playerId && (
                          <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                            YOU
                          </div>
                        )}
                        {p.is_host && p.id !== playerId && (
                          <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                            HOST
                          </div>
                        )}
                        {isHost && p.id !== playerId && (
                          <button
                            type="button"
                            onClick={() => setKickTarget(p)}
                            className="w-5 h-5 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center"
                            aria-label={`Kick ${p.name}`}
                            title={`Kick ${p.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-[84px] grid place-items-center text-gray-600 text-sm">
                    Empty
                  </div>
                )}
              </div>
            </div>

            <div className="bg-linear-to-br from-sky-950/50 to-sky-900/20 rounded-2xl border border-sky-900/40 overflow-hidden">
              <div className="bg-sky-950/30 px-3 py-2 border-b border-sky-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-sky-500" />
                    <span className="font-semibold text-sky-400 text-sm">
                      Team B
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sky-400/70 text-xs">
                    <Users className="w-3 h-3" />
                    <span>{bPlayers.length}</span>
                  </div>
                </div>
              </div>
              <div
                className={`py-3 px-1.5 space-y-1.5 ${
                  numTeams === 3 ? "min-h-[123px]" : "min-h-[100px]"
                }`}
              >
                {bPlayers.length > 0 ? (
                  bPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5"
                    >
                      <div className="text-sm font-medium truncate">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.id === playerId && (
                          <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-medium">
                            YOU
                          </div>
                        )}
                        {p.is_host && p.id !== playerId && (
                          <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-medium">
                            HOST
                          </div>
                        )}
                        {isHost && p.id !== playerId && (
                          <button
                            type="button"
                            onClick={() => setKickTarget(p)}
                            className="w-5 h-5 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center"
                            aria-label={`Kick ${p.name}`}
                            title={`Kick ${p.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-[84px] grid place-items-center text-gray-600 text-sm">
                    Empty
                  </div>
                )}
              </div>
            </div>

            {numTeams === 3 && (
              <div className="bg-linear-to-br from-rose-950/50 to-rose-900/20 rounded-2xl border border-rose-900/40 overflow-hidden">
                <div className="bg-rose-950/30 px-3 py-2 border-b border-rose-900/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="font-semibold text-rose-400 text-sm">
                        Team C
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-rose-400/70 text-xs">
                      <Users className="w-3 h-3" />
                      <span>{cPlayers.length}</span>
                    </div>
                  </div>
                </div>
                <div
                  className={`py-3 px-1.5 space-y-1.5 ${
                    numTeams === 3 ? "min-h-[123px]" : "min-h-[100px]"
                  }`}
                >
                  {cPlayers.length > 0 ? (
                    cPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5"
                      >
                        <div className="text-sm font-medium truncate">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.id === playerId && (
                            <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-medium">
                              YOU
                            </div>
                          )}
                          {p.is_host && p.id !== playerId && (
                            <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-medium">
                              HOST
                            </div>
                          )}
                          {isHost && p.id !== playerId && (
                            <button
                              type="button"
                              onClick={() => setKickTarget(p)}
                              className="w-5 h-5 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center"
                              aria-label={`Kick ${p.name}`}
                              title={`Kick ${p.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-[84px] grid place-items-center text-gray-600 text-sm">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )}

            {numTeams === 3 && me && (
              <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full">
                <div className="px-3 py-2 border-zinc-800/40">
                  <span className="text-zinc-400 text-sm">Your Team</span>
                </div>
                <div className="pb-3 px-1.5 flex-1 flex flex-col">
                  <div className="flex-1 flex flex-col justify-evenly gap-1.5 w-full px-1">
                    <button
                      onClick={() => onSwitchTeam("A")}
                      className={`w-full px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        myTeam === "A"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                          : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                      }`}
                    >
                      Team A
                    </button>
                    <button
                      onClick={() => onSwitchTeam("B")}
                      className={`w-full px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        myTeam === "B"
                          ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20"
                          : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                      }`}
                    >
                      Team B
                    </button>
                    <button
                      onClick={() => onSwitchTeam("C")}
                      className={`w-full px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        myTeam === "C"
                          ? "bg-rose-600/80 text-white shadow-lg shadow-rose-600/20"
                          : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                      }`}
                    >
                      Team C
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {me && numTeams === 2 && (
            <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-sm text-gray-400">Your team</div>
                <div className="flex gap-2 flex-nowrap">
                  <button
                    onClick={() => onSwitchTeam("A")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      myTeam === "A"
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                    }`}
                  >
                    Team A
                  </button>
                  <button
                    onClick={() => onSwitchTeam("B")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      myTeam === "B"
                        ? "bg-sky-600 text-white"
                        : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                    }`}
                  >
                    Team B
                  </button>
                </div>
              </div>
            </div>
          )}

          {isHost ? (
            <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Game Settings</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Teams</span>
                  <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                    <button
                      onClick={() => onUpdateSettings({ teams: 2 })}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        numTeams === 2
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      2
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ teams: 3 })}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        numTeams === 3
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      3
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">
                    Sequences to win
                  </span>
                  <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                    <button
                      onClick={() => onUpdateSettings({ win_sequences: 1 })}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        (room.settings?.win_sequences ?? 2) === 1
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      1
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ win_sequences: 2 })}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        (room.settings?.win_sequences ?? 2) === 2
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      2
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isHost ? (
            <div className="space-y-3">
              {!balanced && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-center">
                  <p className="text-xs text-amber-400">
                    Teams must be balanced to start
                  </p>
                </div>
              )}
              <button
                onClick={onStartGame}
                disabled={starting || !balanced}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold shadow-xl disabled:shadow-none transition-all"
              >
                {starting ? "Starting..." : "Start Game"}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 px-4 py-6 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
                <span className="text-sm">Waiting for host to start</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {kickTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_70%,black_100%)] p-5 shadow-xl">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white">
                Kick {kickTarget.name}?
              </div>
              <div className="text-sm text-zinc-500">
                They can rejoin with the room code.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKickTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold"
                disabled={kicking}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmKick}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold"
                disabled={kicking}
              >
                {kicking ? "Kicking..." : "Kick"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
