import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BoardGrid from "@/components/BoardGrid";
import Sidebar from "@/components/Sidebar";
import RulesModal from "@/components/RulesModal";
import layout from "@/data/boardLayout";
import { parseCard } from "@/lib/deck";
import { Copy, Users, Check, Settings, Trophy, Frown } from "lucide-react";
import { ALL_LINES } from "@/lib/lines";

export default function RoomPage() {
  const router = useRouter();
  const rawCode = router.query?.code;
  const code = typeof rawCode === "string" ? rawCode.toUpperCase() : undefined;
  const playerId =
    typeof router.query?.pid === "string" ? router.query.pid : null;

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
  const wakeLockRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [askNameOpen, setAskNameOpen] = useState(false);
  const [tempName, setTempName] = useState("");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const deepLinkHandledRef = useRef(false);

  // If no pid in URL, try to restore from localStorage; else prompt for name
  useEffect(() => {
    if (!code) return;
    if (playerId) return;
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    (async () => {
      try {
        const savedPid = localStorage.getItem(`seq_pid:${code}`);
        if (savedPid) {
          router.replace(`/room/${code}?pid=${savedPid}`);
          return;
        }
      } catch {}
      try {
        const savedName = localStorage.getItem("seq_name");
        if (savedName && savedName.trim()) {
          setNameSubmitting(true);
          const res = await fetch("/api/join-room", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: savedName.trim(), code }),
          });
          const d = await res.json();
          if (res.ok) {
            try {
              localStorage.setItem(`seq_pid:${d.code}`, d.player_id);
            } catch {}
            router.replace(`/room/${d.code}?pid=${d.player_id}`);
            return;
          }
        }
      } catch {}
      // Fallback: prompt for name
      setAskNameOpen(true);
    })();
  }, [code, playerId, router]);

  async function submitNameJoin() {
    if (!tempName.trim()) {
      setNameError(true);
      return;
    }
    setNameSubmitting(true);
    try {
      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to join");
        return;
      }
      try {
        localStorage.setItem("seq_name", tempName.trim());
        localStorage.setItem(`seq_pid:${data.code}`, data.player_id);
      } catch {}
      setAskNameOpen(false);
      router.replace(`/room/${data.code}?pid=${data.player_id}`);
    } catch (e) {
      alert("Failed to join");
    } finally {
      setNameSubmitting(false);
    }
  }

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
        { event: "INSERT", schema: "public", table: "moves" },
        (payload) => {
          const row = payload.new;
          if (!game || row?.game_id !== game.id) return;
          setMoves((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            // Avoid duplicates by turn_index
            if (!next.find((m) => m.turn_index === row.turn_index)) {
              next.push({
                turn_index: row.turn_index,
                move_type: row.move_type,
                coord: row.coord,
                team: row.team,
                card: row.card,
                created_at: row.created_at,
                player_id: row.player_id,
              });
              next.sort((a, b) => a.turn_index - b.turn_index);
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(roomSub);
    };
  }, [code, room?.id, game, playerId]);

  // Screen Wake Lock - keep screen on during game
  useEffect(() => {
    // Only enable wake lock when in a room (lobby or active game)
    if (!room) return;

    const requestWakeLock = async () => {
      try {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
          const sentinel = await navigator.wakeLock.request("screen");
          // Re-acquire if the wake lock is released by the UA (low power, etc.)
          sentinel.addEventListener("release", () => {
            if (document.visibilityState === "visible") {
              // fire and forget
              requestWakeLock().catch(() => {});
            }
          });
          wakeLockRef.current = sentinel;
        }
      } catch (e) {
        // Wake lock request failed - silently fail
        // This can happen if battery is low or permission denied
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };

    // Request wake lock immediately
    requestWakeLock();

    // Re-request when page becomes visible again
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      try {
        wakeLockRef.current?.release();
      } catch {}
      wakeLockRef.current = null;
    };
  }, [room]);

  const isHost = room && playerId && room.host_player_id === playerId;
  const me = useMemo(
    () => players.find((p) => p.id === playerId) || null,
    [players, playerId]
  );
  const highlight = useMemo(() => {
    if (targetSquare == null) return new Set();
    const s = new Set();
    s.add(targetSquare);
    return s;
  }, [targetSquare]);
  const playersBySeat = useMemo(
    () =>
      [...players].sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
    [players]
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

  // Client-side copy of server winner evaluation to avoid mismatch
  function isCorner(idx) {
    const r = Math.floor(idx / 10);
    const c = idx % 10;
    return (
      (r === 0 && c === 0) ||
      (r === 0 && c === 9) ||
      (r === 9 && c === 0) ||
      (r === 9 && c === 9)
    );
  }
  function countSequencesWithOverlapConstraintClient(
    occBefore,
    occAfter,
    team
  ) {
    const existingLines = [];
    for (const line of ALL_LINES) {
      let ok = true;
      for (const idx of line) {
        if (isCorner(idx)) continue;
        const o = occBefore.get(idx);
        if (!o || o.team !== team) {
          ok = false;
          break;
        }
      }
      if (ok) existingLines.push(line);
    }
    const used = new Set();
    const nonCorner = (line) => line.filter((i) => !isCorner(i));
    for (const line of existingLines) {
      for (const idx of nonCorner(line)) used.add(idx);
    }
    const candidate = [];
    for (const line of ALL_LINES) {
      // complete in after state?
      let ok = true;
      for (const idx of line) {
        if (isCorner(idx)) continue;
        const o = occAfter.get(idx);
        if (!o || o.team !== team) {
          ok = false;
          break;
        }
      }
      if (ok) candidate.push(line);
    }
    // remove those already existing
    const existingKey = new Set(existingLines.map((l) => l.join("-")));
    const newOnly = candidate.filter((l) => !existingKey.has(l.join("-")));
    let accepted = 0;
    for (const line of newOnly) {
      let overlap = 0;
      for (const idx of nonCorner(line)) {
        if (used.has(idx)) overlap++;
        if (overlap > 1) break;
      }
      if (overlap <= 1) {
        accepted++;
        for (const idx of nonCorner(line)) used.add(idx);
      }
    }
    return existingLines.length + accepted;
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
      const res = await fetch("/api/update-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          playerId,
          settings: newSettings,
        }),
      });
      // Optimistic UI: reflect change immediately; realtime will confirm
      if (res.ok) {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                settings: { ...(prev.settings || {}), ...newSettings },
              }
            : prev
        );
      }
    } catch {}
  }

  function copyCode() {
    if (!room) return;
    copyTextToClipboard(room.code)
      .then((ok) => {
        if (ok) {
          setCodeCopied(true);
          setTimeout(() => setCodeCopied(false), 2000);
        } else {
          alert("Copy failed");
        }
      })
      .catch(() => alert("Copy failed"));
  }

  function copyInvite() {
    if (!room) return;
    const url = `${location.origin}/room/${room.code}`;
    copyTextToClipboard(url)
      .then((ok) => {
        if (ok) {
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
        } else {
          alert("Copy failed");
        }
      })
      .catch(() => alert("Copy failed"));
  }

  async function copyTextToClipboard(text) {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return !!ok;
    } catch {}
    return false;
  }

  async function handleEndGame() {
    if (!room || !game || !playerId || !isHost) return;
    const confirmed = confirm(
      "Are you sure you want to end this game? This cannot be undone."
    );
    if (!confirmed) return;

    setSidebarOpen(false);
    try {
      const res = await fetch("/api/end-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          gameId: game.id,
          playerId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to end game");
      }
    } catch (e) {
      alert("Failed to end game");
    }
  }

  const content = () => {
    if (loading)
      return (
        <div className="min-h-dvh grid place-items-center">
          <div className="text-zinc-500 text-2xl">Loading...</div>
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
                        onClick={copyCode}
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
                        onClick={copyInvite}
                        className="text-lg text-blue-500 font-semibold flex items-center gap-2"
                      >
                        {linkCopied && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                        <span>Copy Link</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`grid gap-3 ${
                  numTeams === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
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
                    <div className="flex gap-2 flex-nowrap">
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
                              ? "bg-rose-600/80 text-white"
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
                              ? "bg-blue-600 text-white"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          2
                        </button>
                        <button
                          onClick={() => updateSettings({ teams: 3 })}
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
                          onClick={() => updateSettings({ win_sequences: 1 })}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            (room.settings?.win_sequences ?? 2) === 1
                              ? "bg-blue-600 text-white"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          1
                        </button>
                        <button
                          onClick={() => updateSettings({ win_sequences: 2 })}
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
                    onClick={startGame}
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
        </div>
      );
    }
    // Check if game is finished
    if (game?.finished_at) {
      const chips = computeChips();
      const { seqA, seqB, seqC } = computeSequenceSets(chips);
      const winSeqCount = room?.settings?.win_sequences ?? 2;
      // Compute final counts (display)
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

      // Authoritative winner calculation aligned with server:
      // take last placing move, compare before/after with overlap rule.
      const lastPlace = [...moves]
        .filter((m) => m.move_type === "place")
        .sort((a, b) => b.turn_index - a.turn_index)[0];
      let winner = null;
      if (lastPlace) {
        const occBefore = new Map();
        const occAfter = new Map();
        for (const mv of moves) {
          if (mv.turn_index >= lastPlace.turn_index) continue;
          if (mv.move_type === "place") {
            const [r, c] = mv.coord.split(",").map((n) => parseInt(n, 10));
            occBefore.set(r * 10 + c, { team: mv.team });
            occAfter.set(r * 10 + c, { team: mv.team });
          } else if (mv.move_type === "remove") {
            const [r, c] = mv.coord.split(",").map((n) => parseInt(n, 10));
            occBefore.delete(r * 10 + c);
            occAfter.delete(r * 10 + c);
          }
        }
        // add last move to after
        const [lr, lc] = lastPlace.coord.split(",").map((n) => parseInt(n, 10));
        occAfter.set(lr * 10 + lc, { team: lastPlace.team });
        // lock corners
        [0, 9, 90, 99].forEach((i) => {
          occBefore.set(i, { team: "corner" });
          occAfter.set(i, { team: "corner" });
        });
        const seqAfter = countSequencesWithOverlapConstraintClient(
          occBefore,
          occAfter,
          lastPlace.team
        );
        if (seqAfter >= winSeqCount) winner = lastPlace.team;
      }

      const aPlayers = players.filter((p) => p.team === "A");
      const bPlayers = players.filter((p) => p.team === "B");
      const cPlayers = players.filter((p) => p.team === "C");
      const activeTeams = room?.settings?.teams ?? 2;
      const isSolo =
        (activeTeams === 2 && aPlayers.length === 1 && bPlayers.length === 1) ||
        (activeTeams === 3 &&
          aPlayers.length === 1 &&
          bPlayers.length === 1 &&
          cPlayers.length === 1);
      const soloWinnerName = players.find((p) => p.team === winner)?.name;
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
                <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
                  {isWinner ? "You Won!" : winner ? "Game Over!" : "Game Ended"}
                </h1>
                <p
                  className={`text-xl font-semibold mb-1 ${
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

              <div className="bg-zinc-900/60 backdrop-blur rounded-2xl p-6 border border-white/5 mb-6">
                <h3 className="text-xl text-gray-300 mb-4">Final Scores</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-emerald-500/10">
                    <span className="text-emerald-400 font-semibold">
                      {(isSolo ? aPlayers[0]?.name : "Team A") || "Team A"}
                    </span>
                    <span className="text-emerald-400 font-bold">{aCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-sky-500/10">
                    <span className="text-sky-400 font-semibold">
                      {(isSolo ? bPlayers[0]?.name : "Team B") || "Team B"}
                    </span>
                    <span className="text-sky-400 font-bold">{bCount}</span>
                  </div>
                  {(room?.settings?.teams ?? 2) === 3 && (
                    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-rose-500/10">
                      <span className="text-rose-400 font-semibold">
                        {(isSolo ? cPlayers[0]?.name : "Team C") || "Team C"}
                      </span>
                      <span className="text-rose-400 font-bold">{cCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push("/")}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20"
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
    // Build round-robin order by team to prevent consecutive teammates
    const grouped = {
      A: [...players]
        .filter((p) => p.team === "A")
        .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
      B: [...players]
        .filter((p) => p.team === "B")
        .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
      C: [...players]
        .filter((p) => p.team === "C")
        .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
    };
    const teamOrder = ["A", "B", "C"].filter((t) => grouped[t].length > 0);
    const maxLen = Math.max(...teamOrder.map((t) => grouped[t].length));
    const playersByTurn = [];
    for (let i = 0; i < maxLen; i++) {
      for (const t of teamOrder) {
        if (grouped[t][i]) playersByTurn.push(grouped[t][i]);
      }
    }
    const turnPlayer =
      playersByTurn.length && game
        ? playersByTurn[game.turn_index % playersByTurn.length]
        : null;
    const teamColor =
      (turnPlayer?.team === "A"
        ? "text-emerald-500"
        : turnPlayer?.team === "B"
        ? "text-sky-500"
        : "text-rose-500") || "text-emerald-500";
    const myTeamColor =
      me?.team === "A" ? "emerald" : me?.team === "B" ? "sky" : "rose";
    const allowed = selectedCard ? allowedIndicesForSelectedCard() : null;
    const myTurn =
      game &&
      me &&
      turnPlayer &&
      turnPlayer.id === me.id &&
      room?.status === "active";
    const canConfirm =
      selectedCard &&
      targetSquare != null &&
      myTurn &&
      allowed?.has(targetSquare);
    const canDead =
      selectedCard &&
      isCardDead(selectedCard) &&
      myTurn &&
      !posting &&
      targetSquare == null;

    // Compute teams and scores for sidebar
    const sidebarTeams = game
      ? {
          A: players
            .filter((p) => p.team === "A")
            .map((p) => ({
              id: p.id,
              name: p.name,
              isYou: p.id === playerId,
              isHost: p.id === room.host_player_id,
            })),
          B: players
            .filter((p) => p.team === "B")
            .map((p) => ({
              id: p.id,
              name: p.name,
              isYou: p.id === playerId,
              isHost: p.id === room.host_player_id,
            })),
          C:
            (room?.settings?.teams ?? 2) === 3
              ? players
                  .filter((p) => p.team === "C")
                  .map((p) => ({
                    id: p.id,
                    name: p.name,
                    isYou: p.id === playerId,
                    isHost: p.id === room.host_player_id,
                  }))
              : [],
        }
      : null;

    // Calculate actual sequence counts using same logic as server
    const calculateSequenceCount = (team) => {
      const used = new Set();
      let count = 0;
      const nonCorner = (line) => line.filter((i) => !cornerIndex(i));
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

    const sidebarScores = game
      ? (room?.settings?.teams ?? 2) === 3
        ? {
            A: calculateSequenceCount("A"),
            B: calculateSequenceCount("B"),
            C: calculateSequenceCount("C"),
          }
        : {
            A: calculateSequenceCount("A"),
            B: calculateSequenceCount("B"),
          }
      : null;

    return (
      <>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          teams={sidebarTeams}
          scores={sidebarScores}
          isHost={isHost}
          onShowRules={() => {
            setSidebarOpen(false);
            setRulesOpen(true);
          }}
          onEndGame={handleEndGame}
        />
        <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
        <Header
          centerLabel="SneakyLink"
          onMenuClick={() => setSidebarOpen(true)}
          onRulesClick={() => setRulesOpen(true)}
        />
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
          myTeamColor={myTeamColor}
          myTurn={myTurn}
        />
      </>
    );
  };

  return (
    <main className="h-dvh overflow-hidden text-neutral-100">
      {content()}
      {/* Global Name prompt modal (covers all stages) */}
      {askNameOpen && !playerId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm z-50 rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_70%,black_100%)] backdrop-blur p-5 shadow-xl">
            <div className="mb-4">
              <div className="text-lg font-semibold bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
                Enter your name
              </div>
              <div className="text-sm text-zinc-500">
                You need a name to join this room
              </div>
            </div>
            <div className="space-y-3">
              <input
                className={`w-full rounded-xl bg-zinc-800/80 text-white placeholder-zinc-600 border focus:outline-none focus:ring-1 px-4 py-3 ${
                  nameError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/50"
                    : "border-zinc-700/50 focus:border-blue-500/50 focus:ring-blue-500/50"
                }`}
                value={tempName}
                onChange={(e) => {
                  const v = e.target.value.replace(/\s+/g, "").slice(0, 16);
                  setTempName(v);
                  if (nameError && e.target.value.trim()) setNameError(false);
                }}
                placeholder="Eg. Alex"
                autoFocus
                maxLength={16}
              />
              <button
                onClick={submitNameJoin}
                disabled={nameSubmitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold"
              >
                {nameSubmitting ? "Joining..." : "Join Game"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
