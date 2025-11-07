import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BoardGrid from "@/components/BoardGrid";
import layout from "@/data/boardLayout";
import { parseCard } from "@/lib/deck";
import { Copy, Users, Check, Settings } from "lucide-react";
import { ALL_LINES } from "@/lib/lines";

export default function RoomPage() {
  const router = useRouter();
  const { code } = router.query;
  const playerId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    return url.searchParams.get("pid");
  }, []);

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [game, setGame] = useState(null);
  const [moves, setMoves] = useState([]);
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [targetSquare, setTargetSquare] = useState(null);
  const [posting, setPosting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    let mounted = true;
    (async () => {
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();
      if (!mounted) return;
      setRoom(roomRow || null);
      if (roomRow) {
        const { data: ps } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomRow.id)
          .order("seat_index", { ascending: true });
        if (!mounted) return;
        setPlayers(ps || []);
        const { data: gs } = await supabase
          .from("games")
          .select("*")
          .eq("room_id", roomRow.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const g = gs && gs.length ? gs[0] : null;
        setGame(g);
        if (g && playerId) {
          const { data: handRow } = await supabase
            .from("hands")
            .select("cards")
            .eq("game_id", g.id)
            .eq("player_id", playerId)
            .single();
          setHand(handRow?.cards || []);
          const { data: ms } = await supabase
            .from("moves")
            .select("turn_index, move_type, coord, team, card, created_at")
            .eq("game_id", g.id)
            .order("turn_index", { ascending: true });
          setMoves(ms || []);
        }
      }
      setLoading(false);
    })();

    const roomSub = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${code}`,
        },
        (payload) => {
          if (payload.new) setRoom(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (row?.room_id !== room?.id) return;
          supabase
            .from("players")
            .select("*")
            .eq("room_id", room?.id)
            .order("seat_index", { ascending: true })
            .then(({ data }) => setPlayers(data || []));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (row?.room_id !== room?.id) return;
          supabase
            .from("games")
            .select("*")
            .eq("room_id", room?.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .then(({ data }) => setGame(data && data.length ? data[0] : null));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hands" },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (!game || row?.game_id !== game.id || row?.player_id !== playerId)
            return;
          supabase
            .from("hands")
            .select("cards")
            .eq("game_id", game.id)
            .eq("player_id", playerId)
            .single()
            .then(({ data }) => setHand(data?.cards || []));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moves" },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (!game || row?.game_id !== game.id) return;
          supabase
            .from("moves")
            .select("turn_index, move_type, coord, team, card, created_at")
            .eq("game_id", game.id)
            .order("turn_index", { ascending: true })
            .then(({ data }) => setMoves(data || []));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(roomSub);
    };
  }, [code, room?.id, game, playerId]);

  const isHost = room && playerId && room.host_player_id === playerId;
  const me = useMemo(
    () => players.find((p) => p.id === playerId) || null,
    [players, playerId]
  );
  const myTurn =
    game && me && game.current_team === me.team && room?.status === "active";

  function coordOfIndex(idx) {
    const r = Math.floor(idx / 10);
    const c = idx % 10;
    return `${r},${c}`;
  }

  function computeChips() {
    const m = new Map();
    for (const mv of moves) {
      if (mv.move_type === "place") {
        const [r, c] = mv.coord.split(",").map((n) => parseInt(n, 10));
        m.set(r * 10 + c, mv.team);
      } else if (mv.move_type === "remove") {
        const [r, c] = mv.coord.split(",").map((n) => parseInt(n, 10));
        m.delete(r * 10 + c);
      }
    }
    return m;
  }

  function cornerIndex(idx) {
    const r = Math.floor(idx / 10);
    const c = idx % 10;
    return (
      (r === 0 && c === 0) ||
      (r === 0 && c === 9) ||
      (r === 9 && c === 0) ||
      (r === 9 && c === 9)
    );
  }

  function computeSequenceSets(chips) {
    function nonCorner(line) {
      return line.filter((i) => !cornerIndex(i));
    }
    function acceptedLines(team) {
      const used = new Set();
      const acc = [];
      for (const line of ALL_LINES) {
        // is this line complete for team?
        let ok = true;
        for (const idx of line) {
          if (cornerIndex(idx)) continue;
          if (chips.get(idx) !== team) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        // overlap check against previously accepted lines
        let overlap = 0;
        for (const idx of nonCorner(line)) {
          if (used.has(idx)) overlap++;
          if (overlap > 1) break;
        }
        if (overlap <= 1) {
          acc.push(line);
          for (const idx of nonCorner(line)) used.add(idx);
        }
      }
      return acc;
    }
    const aLines = acceptedLines("A");
    const bLines = acceptedLines("B");
    const cLines = acceptedLines("C");
    const seqA = new Set();
    const seqB = new Set();
    const seqC = new Set();
    for (const line of aLines) for (const i of nonCorner(line)) seqA.add(i);
    for (const line of bLines) for (const i of nonCorner(line)) seqB.add(i);
    for (const line of cLines) for (const i of nonCorner(line)) seqC.add(i);
    return { seqA, seqB, seqC };
  }

  function isOneEyed(card) {
    const { rank, suit } = parseCard(card);
    return rank === "J" && (suit === "spade" || suit === "heart");
  }
  function isTwoEyed(card) {
    const { rank, suit } = parseCard(card);
    return rank === "J" && (suit === "club" || suit === "diamond");
  }

  function allowedPositionsForCard(card) {
    const { rank, suit } = parseCard(card);
    if (rank === "J") return [];
    const positions = [];
    for (let i = 0; i < layout.length; i++) {
      const cell = layout[i];
      if (cell.type === "card" && cell.rank === rank && cell.suit === suit)
        positions.push(i);
    }
    return positions;
  }

  function allowedIndicesForSelectedCard() {
    if (!selectedCard) return new Set();
    const chips = computeChips();
    const mine = me?.team;
    const opp = mine === "A" ? "B" : "A";
    const set = new Set();
    if (isTwoEyed(selectedCard)) {
      for (let i = 0; i < 100; i++) {
        if (!chips.has(i) && !cornerIndex(i)) set.add(i);
      }
      return set;
    }
    if (isOneEyed(selectedCard)) {
      for (let [i, team] of chips.entries()) {
        if (team === opp && !cornerIndex(i)) set.add(i);
      }
      return set;
    }
    const positions = allowedPositionsForCard(selectedCard);
    for (const i of positions) {
      if (!chips.has(i)) set.add(i);
    }
    return set;
  }

  function isCardDead(card) {
    if (!card) return false;
    const chips = computeChips();
    const positions = allowedPositionsForCard(card);
    return (
      positions.length > 0 &&
      positions.every((i) => {
        const r = Math.floor(i / 10);
        const c = i % 10;
        const isCorner =
          (r === 0 && c === 0) ||
          (r === 0 && c === 9) ||
          (r === 9 && c === 0) ||
          (r === 9 && c === 9);
        return isCorner || chips.has(i);
      })
    );
  }

  function onSquareClick(idx) {
    if (!myTurn || !selectedCard || posting) return;
    const allowed = allowedIndicesForSelectedCard();
    if (!allowed.has(idx)) return;
    setTargetSquare(idx);
  }

  async function onConfirmMove() {
    if (!myTurn || !selectedCard || targetSquare == null || posting) return;
    const moveType = isOneEyed(selectedCard) ? "remove" : "place";
    try {
      setPosting(true);
      const res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          gameId: game.id,
          playerId,
          clientTurnIndex: game.turn_index,
          moveType,
          card: selectedCard,
          coord: coordOfIndex(targetSquare),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Move failed");
      setSelectedCard(null);
      setTargetSquare(null);
    } catch (e) {
      alert(e.message || "Move failed");
    } finally {
      setPosting(false);
    }
  }

  async function onDead() {
    if (!myTurn || !selectedCard || posting) return;
    try {
      setPosting(true);
      const res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          gameId: game.id,
          playerId,
          clientTurnIndex: game.turn_index,
          moveType: "dead",
          card: selectedCard,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dead failed");
      setSelectedCard(null);
      setTargetSquare(null);
    } catch (e) {
      alert(e.message || "Dead failed");
    } finally {
      setPosting(false);
    }
  }

  const startGame = async () => {
    if (!room || !playerId) return;
    setStarting(true);
    try {
      const res = await fetch("/api/start-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
    } catch (e) {
      alert(e.message || "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  async function switchTeam(nextTeam) {
    if (!room || !playerId || !["A", "B", "C"].includes(nextTeam)) return;
    try {
      await fetch("/api/switch-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId, team: nextTeam }),
      });
    } catch {}
  }

  async function updateSettings(newSettings) {
    if (!room || !playerId || !isHost) return;
    try {
      await fetch("/api/update-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          playerId,
          settings: newSettings,
        }),
      });
    } catch {}
  }

  function copyCode() {
    if (!room) return;
    try {
      navigator.clipboard?.writeText(room.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  }

  function copyInvite() {
    if (!room) return;
    try {
      const url = `${location.origin}/room/${room.code}`;
      navigator.clipboard?.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {}
  }

  const content = () => {
    if (loading)
      return (
        <div className="min-h-dvh grid place-items-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      );
    if (!room)
      return (
        <div className="min-h-dvh grid place-items-center">
          <div className="text-red-400 text-sm">Room not found</div>
        </div>
      );
    if (room.status === "lobby") {
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

      return (
        <div className="h-dvh overflow-y-auto text-white px-4 py-6">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-1 bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
                SneakyLink
              </h1>
              <p className="text-sm text-gray-400">
                {isHost ? "You're the host" : ""}
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      ROOM CODE
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-mono font-bold tracking-widest">
                        {room.code}
                      </span>
                      <button
                        onClick={copyCode}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      >
                        {codeCopied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={copyInvite}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    {linkCopied && <Check className="w-4 h-4" />}
                    Share Link
                  </button>
                </div>
              </div>

              <div
                className={`grid gap-3 ${
                  numTeams === 3 ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
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
                  <div className="py-3 px-1.5 space-y-1.5 min-h-[100px]">
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
                  <div className="py-3 px-1.5 space-y-1.5 min-h-[100px]">
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
                    <div className="py-3 px-1.5 space-y-1.5 min-h-[100px]">
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
              </div>

              {me ? (
                <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-gray-400">Your team</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => switchTeam("A")}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          myTeam === "A"
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                        }`}
                      >
                        Team A
                      </button>
                      <button
                        onClick={() => switchTeam("B")}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          myTeam === "B"
                            ? "bg-sky-600 text-white"
                            : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                        }`}
                      >
                        Team B
                      </button>
                      {numTeams === 3 && (
                        <button
                          onClick={() => switchTeam("C")}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            myTeam === "C"
                              ? "bg-rose-600 text-white"
                              : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                          }`}
                        >
                          Team C
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

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
                          onClick={() => updateSettings({ teams: 2 })}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            numTeams === 2
                              ? "bg-emerald-600 text-white"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          2
                        </button>
                        <button
                          onClick={() => updateSettings({ teams: 3 })}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            numTeams === 3
                              ? "bg-emerald-600 text-white"
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
                          onClick={() => updateSettings({ win_sequences: 1 })}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            (room.settings?.win_sequences ?? 2) === 1
                              ? "bg-emerald-600 text-white"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          1
                        </button>
                        <button
                          onClick={() => updateSettings({ win_sequences: 2 })}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            (room.settings?.win_sequences ?? 2) === 2
                              ? "bg-emerald-600 text-white"
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
                    onClick={startGame}
                    disabled={starting || !balanced}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold shadow-xl disabled:shadow-none transition-all"
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
        </div>
      );
    }
    // Check if game is finished
    if (game?.finished_at) {
      const chips = computeChips();
      const { seqA, seqB, seqC } = computeSequenceSets(chips);
      const winSeqCount = room?.settings?.win_sequences ?? 2;
      const nonCorner = (line) => line.filter((i) => !cornerIndex(i));
      const acceptedCount = (team) => {
        const used = new Set();
        let count = 0;
        for (const line of ALL_LINES) {
          let ok = true;
          for (const idx of line) {
            if (cornerIndex(idx)) continue;
            if (chips.get(idx) !== team) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          let overlap = 0;
          for (const idx of nonCorner(line)) {
            if (used.has(idx)) overlap++;
            if (overlap > 1) break;
          }
          if (overlap <= 1) {
            count++;
            for (const idx of nonCorner(line)) used.add(idx);
          }
        }
        return count;
      };
      const aCount = acceptedCount("A");
      const bCount = acceptedCount("B");
      const cCount = acceptedCount("C");

      let winner = null;
      if (aCount >= winSeqCount) winner = "A";
      else if (bCount >= winSeqCount) winner = "B";
      else if (cCount >= winSeqCount) winner = "C";

      const winnerName = winner
        ? players.find((p) => p.team === winner)?.name || `Team ${winner}`
        : "Unknown";
      const winnerColor =
        winner === "A" ? "emerald" : winner === "B" ? "sky" : "rose";
      const isWinner = me?.team === winner;

      return (
        <div className="h-dvh overflow-hidden text-white">
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-md text-center">
              <div className="mb-8">
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                    winnerColor === "emerald"
                      ? "bg-emerald-500/20 ring-4 ring-emerald-500/30"
                      : winnerColor === "sky"
                      ? "bg-sky-500/20 ring-4 ring-sky-500/30"
                      : "bg-rose-500/20 ring-4 ring-rose-500/30"
                  }`}
                >
                  <span className="text-4xl">🎉</span>
                </div>
                <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
                  {isWinner ? "You Won!" : "Game Over"}
                </h1>
                <p
                  className={`text-xl font-semibold mb-1 ${
                    winnerColor === "emerald"
                      ? "text-emerald-400"
                      : winnerColor === "sky"
                      ? "text-sky-400"
                      : "text-rose-400"
                  }`}
                >
                  Team {winner} Wins!
                </p>
                <p className="text-gray-400 text-sm">
                  {winnerName} completed {winSeqCount} sequence
                  {winSeqCount > 1 ? "s" : ""}
                </p>
              </div>

              <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-6 border border-white/5 mb-6">
                <h3 className="text-sm text-gray-400 mb-3">Final Scores</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-emerald-500/10">
                    <span className="text-emerald-400 font-semibold">
                      Team A
                    </span>
                    <span className="text-emerald-400 font-bold">{aCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-sky-500/10">
                    <span className="text-sky-400 font-semibold">Team B</span>
                    <span className="text-sky-400 font-bold">{bCount}</span>
                  </div>
                  {(room?.settings?.teams ?? 2) === 3 && (
                    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-rose-500/10">
                      <span className="text-rose-400 font-semibold">
                        Team C
                      </span>
                      <span className="text-rose-400 font-bold">{cCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push("/")}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    const chips = computeChips();
    const { seqA, seqB, seqC } = computeSequenceSets(chips);
    const turnPlayer = players.find((p) => p.team === game?.current_team);
    const teamColor =
      game?.current_team === "A"
        ? "text-emerald-500"
        : game?.current_team === "B"
        ? "text-sky-500"
        : "text-rose-500";
    const myTeamColor =
      me?.team === "A" ? "emerald" : me?.team === "B" ? "sky" : "rose";
    const allowed = selectedCard ? allowedIndicesForSelectedCard() : null;
    const canConfirm =
      selectedCard &&
      targetSquare != null &&
      myTurn &&
      allowed?.has(targetSquare);
    const canDead = selectedCard && isCardDead(selectedCard) && myTurn;
    const highlight = new Set();
    if (targetSquare != null) highlight.add(targetSquare);

    return (
      <>
        <Header centerLabel="SneakyLink" />
        <div className="min-h-[calc(100dvh-85px)] grid place-items-center pt-2 pb-[calc(env(safe-area-inset-bottom)+120px)]">
          <BoardGrid
            chips={chips}
            onSquareClick={onSquareClick}
            highlight={highlight}
            allowed={allowed}
            seqA={seqA}
            seqB={seqB}
            seqC={seqC}
            highlightColor={myTeamColor}
          />
        </div>
        <Footer
          hand={hand}
          selectedCard={selectedCard}
          onCardSelect={(c) => {
            setSelectedCard(c === selectedCard ? null : c);
            setTargetSquare(null);
          }}
          onConfirmMove={onConfirmMove}
          onDeadCard={onDead}
          canConfirm={canConfirm}
          canDead={canDead}
          turnUsername={turnPlayer?.name || `Team ${game?.current_team}`}
          teamColorClass={teamColor}
          myTurn={myTurn}
        />
      </>
    );
  };

  return (
    <main className="h-dvh overflow-hidden text-neutral-100">{content()}</main>
  );
}
