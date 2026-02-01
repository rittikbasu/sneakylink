import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BoardGrid from "@/components/BoardGrid";
import Sidebar from "@/components/Sidebar";
import RulesModal from "@/components/RulesModal";
import layout from "@/data/boardLayout";
import { parseCard } from "@/lib/deck";
import { validateRoomCode } from "@/lib/id";
import {
  Copy,
  Users,
  Check,
  Settings,
  Trophy,
  Frown,
  Play,
  Share2,
} from "lucide-react";
import { ALL_LINES } from "@/lib/lines";
import { countMaxSequences } from "@/lib/sequences";

export default function RoomPage() {
  const router = useRouter();
  const rawCode = router.query?.code;
  const code = typeof rawCode === "string" ? rawCode.toUpperCase() : undefined;
  const [playerId, setPlayerId] = useState(null);

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [game, setGame] = useState(null);
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [targetSquare, setTargetSquare] = useState(null);
  const [glowData, setGlowData] = useState(null);
  const glowTimeoutRef = useRef(null);
  const lastMoveRef = useRef(null);
  const lastGlowTurnRef = useRef(null);
  const [posting, setPosting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const wakeLockRef = useRef(null);
  const lastSyncRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [askNameOpen, setAskNameOpen] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [tempName, setTempName] = useState("");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const deepLinkHandledRef = useRef(false);
  const roomIdRef = useRef(null);
  const playerIdRef = useRef(null);
  const gameRef = useRef(null);

  const refreshGameState = useCallback(async (reason = "resume") => {
    const roomId = roomIdRef.current;
    const pid = playerIdRef.current;
    const currentGame = gameRef.current;
    if (!roomId || !pid) return;
      if (syncInFlightRef.current) return;
      const now = Date.now();
      if (now - lastSyncRef.current < 1000) return;
      syncInFlightRef.current = true;
      lastSyncRef.current = now;

      try {
        const { data: gs } = await supabase
          .from("games")
          .select(
            "id, room_id, turn_index, current_team, board_state, last_move, finished_at, winner_team, created_at"
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(1);
        const g = gs && gs.length ? gs[0] : null;
        if (!g) return;

        const needsHandRefresh =
          !currentGame ||
          currentGame.id !== g.id ||
          currentGame.turn_index !== g.turn_index;

        setGame((prev) => {
          if (!prev || g.created_at >= prev.created_at) return g;
          return prev;
        });

        if (needsHandRefresh) {
          const { data: handRow } = await supabase
            .from("hands")
            .select("cards")
            .eq("game_id", g.id)
            .eq("player_id", pid)
            .single();
          setHand(handRow?.cards || []);
        }
      } catch {
        // Best-effort; realtime will eventually reconcile.
      } finally {
        syncInFlightRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    roomIdRef.current = room?.id || null;
  }, [room?.id]);

  useEffect(() => {
    playerIdRef.current = playerId || null;
  }, [playerId]);

  useEffect(() => {
    gameRef.current = game || null;
  }, [game]);

  useEffect(() => {
    if (!code) return;
    if (!validateRoomCode(code)) return;
    if (playerId) return;
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    // 1. URL Param (Legacy/Direct)
    const urlPid =
      typeof router.query?.pid === "string" ? router.query.pid : null;
    if (urlPid) {
      setPlayerId(urlPid);
      try {
        localStorage.setItem(`seq_pid:${code}`, urlPid);
      } catch {}
      router.replace(`/room/${code}`, undefined, { shallow: true });
      return;
    }

    // 2. LocalStorage
    try {
      const savedPid = localStorage.getItem(`seq_pid:${code}`);
      if (savedPid) {
        setPlayerId(savedPid);
        return;
      }
    } catch {}

    // 3. Auto-Join with saved name
    (async () => {
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
            setPlayerId(d.player_id);
            return;
          }
        }
      } catch {}
      setAskNameOpen(true);
      setNameSubmitting(false);
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
      setPlayerId(data.player_id);
    } catch (e) {
      alert("Failed to join");
    } finally {
      setNameSubmitting(false);
    }
  }

  // 1. Initial Load & Room Subscription (Stable)
  useEffect(() => {
    if (!code) return;
    if (!validateRoomCode(code)) {
      setLoading(false);
      return;
    }
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
          if (payload.new) {
            setRoom(payload.new);
            if (payload.new.status === "lobby") {
              setGame(null);
              setShowGameOver(false);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          refreshGameState("room-subscribe");
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(roomSub);
    };
  }, [code, playerId]);

  // 2. Players & Games Subscription (Depends on Room ID)
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`lobby:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const type = payload.eventType;
          const rowNew = payload.new;
          const rowOld = payload.old;

          if (type === "INSERT") {
            setPlayers((prev) => {
              const exists = prev.some((p) => p.id === rowNew.id);
              if (exists) return prev;
              const next = [...prev, rowNew];
              next.sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0));
              return next;
            });
          } else if (type === "UPDATE") {
            setPlayers((prev) => {
              const next = prev.map((p) =>
                p.id === rowNew.id ? { ...p, ...rowNew } : p
              );
              next.sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0));
              return next;
            });
          } else if (type === "DELETE") {
            setPlayers((prev) => prev.filter((p) => p.id !== rowOld.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.new) {
            setGame((prev) => {
              if (!prev || payload.new.created_at >= prev.created_at) {
                return payload.new;
              }
              return prev;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          refreshGameState("lobby-subscribe");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // 3. Game-Specific Subscription: Hands & Moves (Depends on Game ID)
  useEffect(() => {
    if (!game?.id || !playerId) return;

    const fetchGameState = async () => {
      const { data: handRow } = await supabase
        .from("hands")
        .select("cards")
        .eq("game_id", game.id)
        .eq("player_id", playerId)
        .single();
      setHand(handRow?.cards || []);
    };

    fetchGameState();

    const channel = supabase
      .channel(`game:${game.id}:${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hands",
          filter: `game_id=eq.${game.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.player_id === playerId) {
            setHand(payload.new.cards || []);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          refreshGameState("game-subscribe");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, playerId]);

  // Screen Wake Lock - keep screen on during game (best effort)
  useEffect(() => {
    if (!room?.id) return;
    if (
      typeof navigator === "undefined" ||
      typeof document === "undefined" ||
      !("wakeLock" in navigator)
    ) {
      return;
    }

    let releaseListener = null;

    const requestWakeLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        wakeLockRef.current = sentinel;

        releaseListener =
          releaseListener ||
          (() => {
            if (document.visibilityState === "visible") {
              requestWakeLock().catch(() => {});
            }
          });
        sentinel.addEventListener("release", releaseListener, { once: true });
      } catch {
        // Silently fail (battery saver, permissions, etc.)
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock().catch(() => {});
      } else if (document.visibilityState === "hidden") {
        try {
          wakeLockRef.current?.release();
        } catch {}
        wakeLockRef.current = null;
      }
    };

    const handleInteraction = () => {
      if (!wakeLockRef.current && document.visibilityState === "visible") {
        requestWakeLock().catch(() => {});
      }
    };

    requestWakeLock().catch(() => {});
    const touchListenerOptions = { passive: true };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("click", handleInteraction);
    document.addEventListener(
      "touchstart",
      handleInteraction,
      touchListenerOptions
    );

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener(
        "touchstart",
        handleInteraction,
        touchListenerOptions
      );
      try {
        wakeLockRef.current?.release();
      } catch {}
      wakeLockRef.current = null;
    };
  }, [room?.id]);

  useEffect(() => {
    if (!room?.id || !playerId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshGameState("visibility");
      }
    };
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refreshGameState("focus");
      }
    };
    const handleOnline = () => {
      refreshGameState("online");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [room?.id, playerId, refreshGameState]);

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

  useEffect(() => {
    const lm = game?.last_move;
    const currentTurn = game?.turn_index ?? null;

    if (!lm || lm.type !== "place" || !lm.coord) {
      lastMoveRef.current = lm || null;
      if (currentTurn != null) lastGlowTurnRef.current = currentTurn;
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
        glowTimeoutRef.current = null;
      }
      setGlowData(null);
      return;
    }

    if (lastGlowTurnRef.current == null) {
      lastGlowTurnRef.current = currentTurn;
      lastMoveRef.current = lm;
      return;
    }

    if (currentTurn === lastGlowTurnRef.current) {
      lastMoveRef.current = lm;
      return;
    }

    lastGlowTurnRef.current = currentTurn;
    lastMoveRef.current = lm;

    if (game?.finished_at) {
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
        glowTimeoutRef.current = null;
      }
      setGlowData(null);
      return;
    }

    const [r, c] = lm.coord.split(",").map((n) => parseInt(n, 10));
    setGlowData({ idx: r * 10 + c, team: lm.team });

    if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    glowTimeoutRef.current = setTimeout(() => {
      setGlowData(null);
      glowTimeoutRef.current = null;
    }, 5000);
  }, [game?.last_move, game?.finished_at, game?.turn_index]);

  useEffect(() => {
    return () => {
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (game?.finished_at) {
      setShowGameOver(true);
      setSelectedCard(null);
      setTargetSquare(null);
    } else {
      setShowGameOver(false);
    }
  }, [game?.finished_at]);

  const myTurn =
    game && me && game.current_team === me.team && room?.status === "active";

  function coordOfIndex(idx) {
    const r = Math.floor(idx / 10);
    const c = idx % 10;
    return `${r},${c}`;
  }

  function computeChips() {
    const m = new Map();
    if (game?.board_state) {
      for (const [k, v] of Object.entries(game.board_state)) {
        m.set(parseInt(k, 10), v.team);
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
    const { seqA, seqB, seqC } = computeSequenceSets(chips);
    const isLocked = (idx) => seqA.has(idx) || seqB.has(idx) || seqC.has(idx);

    const mine = me?.team;
    const set = new Set();
    if (isTwoEyed(selectedCard)) {
      for (let i = 0; i < 100; i++) {
        if (!chips.has(i) && !cornerIndex(i)) set.add(i);
      }
      return set;
    }
    if (isOneEyed(selectedCard)) {
      for (let [i, team] of chips.entries()) {
        if (team !== mine && !cornerIndex(i) && !isLocked(i)) set.add(i);
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

  const groupedPlayers = useMemo(
    () => ({
      A: [...players]
        .filter((p) => p.team === "A")
        .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
      B: [...players]
        .filter((p) => p.team === "B")
        .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
      C: [...players]
        .filter((p) => p.team === "C")
        .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
    }),
    [players]
  );

  const playersByTurnSafe = useMemo(() => {
    const teamOrder = ["A", "B", "C"].filter(
      (t) => groupedPlayers[t].length > 0
    );
    const maxLen = Math.max(...teamOrder.map((t) => groupedPlayers[t].length));
    const pbt = [];
    for (let i = 0; i < maxLen; i++) {
      for (const t of teamOrder) {
        if (groupedPlayers[t][i]) pbt.push(groupedPlayers[t][i]);
      }
    }
    return pbt;
  }, [groupedPlayers]);

  function onSquareClick(idx) {
    const turnPlayer =
      playersByTurnSafe.length && game
        ? playersByTurnSafe[game.turn_index % playersByTurnSafe.length]
        : null;

    if (!myTurn || !selectedCard || posting || turnPlayer?.id !== me?.id)
      return;
    const allowed = allowedIndicesForSelectedCard();
    if (!allowed.has(idx)) return;
    setTargetSquare(idx);
  }

  async function onConfirmMove() {
    if (!myTurn || !selectedCard || targetSquare == null || posting) return;
    const moveType = isOneEyed(selectedCard) ? "remove" : "place";

    const prevGame = { ...game };
    const prevHand = [...hand];
    const prevSelectedCard = selectedCard;
    const prevTargetSquare = targetSquare;

    const me = players.find((p) => p.id === playerId);
    const nextBoard = { ...game.board_state };
    if (moveType === "place") {
      nextBoard[targetSquare] = { team: me.team };
    } else {
      delete nextBoard[targetSquare];
    }

    setGame((prev) => ({
      ...prev,
      board_state: nextBoard,
      last_move: {
        coord: coordOfIndex(targetSquare),
        type: moveType,
        team: me.team,
      },
      turn_index: prev.turn_index + 1,
    }));

    const cardIdx = hand.findIndex((c) => c === prevSelectedCard);
    if (cardIdx !== -1) {
      const newHand = [...hand];
      newHand[cardIdx] = "__pending__";
      setHand(newHand);
    }

    setSelectedCard(null);
    setTargetSquare(null);

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
          card: prevSelectedCard,
          coord: coordOfIndex(prevTargetSquare),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Move failed");
    } catch (e) {
      alert(e.message || "Move failed");
      setGame(prevGame);
      setHand(prevHand);
      setSelectedCard(prevSelectedCard);
      setTargetSquare(prevTargetSquare);
    } finally {
      setPosting(false);
    }
  }

  async function onDead() {
    if (!myTurn || !selectedCard || posting) return;
    const prevHand = [...hand];
    const prevSelectedCard = selectedCard;
    const prevTargetSquare = targetSquare;
    try {
      const cardIdx = hand.findIndex((c) => c === prevSelectedCard);
      if (cardIdx !== -1) {
        const newHand = [...hand];
        newHand[cardIdx] = "__pending__";
        setHand(newHand);
      }
      setSelectedCard(null);
      setTargetSquare(null);
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
          coord: coordOfIndex(targetSquare),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dead failed");
    } catch (e) {
      alert(e.message || "Dead failed");
      setHand(prevHand);
      setSelectedCard(prevSelectedCard);
      setTargetSquare(prevTargetSquare);
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

    const prevPlayers = [...players];
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, team: nextTeam } : p))
    );

    try {
      await fetch("/api/switch-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId, team: nextTeam }),
      });
    } catch {
      setPlayers(prevPlayers);
    }
  }

  async function updateSettings(newSettings) {
    if (!room || !playerId || !isHost) return;

    const prevRoom = { ...room };
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            settings: { ...(prev.settings || {}), ...newSettings },
          }
        : prev
    );

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
      if (!res.ok) throw new Error();
    } catch {
      setRoom(prevRoom);
    }
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

    if (navigator.share) {
      navigator
        .share({
          text: "Join my SneakyLink room!",
          url: url,
        })
        .catch(() => {
          copyTextToClipboard(url).then((ok) => {
            if (ok) {
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }
          });
        });
    } else {
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

  async function handlePlayAgain() {
    if (!room || !isHost) return;
    try {
      await fetch("/api/play-again", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId }),
      });
    } catch {}
  }

  const content = () => {
    if (loading)
      return (
        <div className="min-h-dvh grid place-items-center">
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/cards.svg"
              alt="Loading"
              width={128}
              height={128}
              className="brightness-150 animate-flip rotate-20"
            />
          </div>
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
      const canShare = typeof navigator !== "undefined" && !!navigator.share;

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
                          onClick={() => switchTeam("A")}
                          className={`w-full px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                            myTeam === "A"
                              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                              : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                          }`}
                        >
                          Team A
                        </button>
                        <button
                          onClick={() => switchTeam("B")}
                          className={`w-full px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                            myTeam === "B"
                              ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20"
                              : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
                          }`}
                        >
                          Team B
                        </button>
                        <button
                          onClick={() => switchTeam("C")}
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

    if (!playerId) {
      return (
        <div className="h-dvh flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-3xl font-bold mb-4 text-white">
            {game?.finished_at ? "Game Finished" : "Game in Progress"}
          </h1>
          <p className="text-zinc-400 mb-8 max-w-md leading-relaxed">
            {game?.finished_at
              ? "This game has already ended. Please ask the host for a new code."
              : "This game has already started. You can join the next round once the host creates a new lobby."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all"
          >
            Back to Home
          </button>
        </div>
      );
    }

    const chips = computeChips();
    const { seqA, seqB, seqC } = computeSequenceSets(chips);
    const grouped = groupedPlayers;
    const playersByTurn = playersByTurnSafe;
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

    const calculateSequenceCount = (team) => {
      const occ = new Map();
      for (const [i, t] of chips.entries()) {
        occ.set(i, { team: t });
      }
      return countMaxSequences(occ, team);
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

    const winner = game?.winner_team;
    const isWinner = me?.team === winner;
    const activeTeams = room?.settings?.teams ?? 2;
    const isSolo =
      (activeTeams === 2 && grouped.A.length === 1 && grouped.B.length === 1) ||
      (activeTeams === 3 &&
        grouped.A.length === 1 &&
        grouped.B.length === 1 &&
        grouped.C.length === 1);
    const soloWinnerName = grouped[winner]?.[0]?.name;

    const sidebarProps = {
      isOpen: sidebarOpen,
      onClose: () => setSidebarOpen(false),
      teams: sidebarTeams,
      scores: sidebarScores,
      isHost,
      onShowRules: () => {
        setSidebarOpen(false);
        setRulesOpen(true);
      },
      onEndGame: !game?.finished_at ? handleEndGame : undefined,
      winSequences: room?.settings?.win_sequences ?? 2,
    };

    const footerProps = {
      hand,
      selectedCard,
      onCardSelect: (c) => {
        setSelectedCard(c === selectedCard ? null : c);
        setTargetSquare(null);
      },
      onConfirmMove,
      onDeadCard: onDead,
      canConfirm,
      canDead,
      turnUsername: turnPlayer?.name || `Team ${game?.current_team}`,
      teamColorClass: teamColor,
      myTeamColor,
      myTurn,
    };

    const gameOverControls = (
      <>
        {isHost ? (
          <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-10 w-full">
            <button
              onClick={() => router.push("/")}
              className="flex-1 max-w-[160px] h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/50 text-white font-semibold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center"
            >
              Home
            </button>

            <button
              onClick={handlePlayAgain}
              className="relative shrink-0 w-[88px] h-[88px] rounded-full bg-linear-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center group overflow-hidden border border-white/10"
            >
              <div className="absolute inset-0 bg-linear-to-t from-black/10 to-transparent pointer-events-none" />
              <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0">
                <defs>
                  <path
                    id="topCurve"
                    d="M 14,50 A 36,36 0 1,1 86,50"
                    fill="none"
                  />
                  <path
                    id="bottomCurve"
                    d="M 14,50 A 36,36 0 0,0 86,50"
                    fill="none"
                  />
                </defs>
                <text
                  fill="white"
                  fontSize="14"
                  fontWeight="800"
                  letterSpacing="8"
                  className="select-none"
                >
                  <textPath
                    href="#topCurve"
                    startOffset="55%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    PLAY
                  </textPath>
                </text>
                <text
                  fill="white"
                  fontSize="14"
                  fontWeight="800"
                  letterSpacing="8"
                  className="select-none"
                >
                  <textPath
                    href="#bottomCurve"
                    startOffset="52%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    AGAIN
                  </textPath>
                </text>
              </svg>

              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                <Play className="w-4 h-4 fill-white" />
              </div>
            </button>

            {!showGameOver ? (
              <button
                onClick={() => setShowGameOver(true)}
                className="flex-1 max-w-[160px] h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 text-white font-semibold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center"
              >
                Results
              </button>
            ) : (
              <div className="flex-1 max-w-[160px]" />
            )}
          </div>
        ) : (
          <div className="flex gap-4 justify-center w-full">
            <button
              onClick={() => router.push("/")}
              className="flex-1 max-w-xs h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 text-white font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              Home
            </button>
            {!showGameOver && (
              <button
                onClick={() => setShowGameOver(true)}
                className="flex-1 max-w-xs h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 text-white font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                Results
              </button>
            )}
          </div>
        )}
      </>
    );

    return (
      <>
        {/* Mobile sidebar - fixed positioned */}
        <div className="md:hidden">
          <Sidebar {...sidebarProps} variant="mobile" />
        </div>
        <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
        <Header
          centerLabel="SneakyLink"
          onMenuClick={() => setSidebarOpen(true)}
          onRulesClick={() => setRulesOpen(true)}
        />

        {/* Mobile layout */}
        <div className="md:hidden min-h-[calc(100dvh-56px)] grid place-items-center pt-2 pb-[calc(env(safe-area-inset-bottom)+120px)]">
          <BoardGrid
            chips={chips}
            onSquareClick={onSquareClick}
            highlight={highlight}
            allowed={allowed}
            seqA={seqA}
            seqB={seqB}
            seqC={seqC}
            highlightColor={myTeamColor}
            lastMoveData={glowData}
          />
        </div>

        {/* Desktop layout - sidebar left of centered board */}
        <div className="hidden md:flex h-[calc(100dvh-120px)] justify-center items-center p-6">
          <div className="flex gap-4 w-full">
            <div className="self-stretch">
              <Sidebar {...sidebarProps} variant="desktop" />
            </div>
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <BoardGrid
                chips={chips}
                onSquareClick={onSquareClick}
                highlight={highlight}
                allowed={allowed}
                seqA={seqA}
                seqB={seqB}
                seqC={seqC}
                highlightColor={myTeamColor}
                lastMoveData={glowData}
              />
              {!game?.finished_at && <Footer {...footerProps} variant="desktop" />}
              {game?.finished_at && (
                <div className="hidden md:block w-full max-w-screen-sm sm:max-w-3xl md:max-w-[min(calc(100dvw-360px),calc((100dvh-240px)/1.4))] mx-auto">
                  <div className="rounded-xl p-2.5 border border-white/10">
                    <div className="flex items-center">
                      {gameOverControls}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {game?.finished_at && (
          <>
            <div
              className={
                "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 " +
                (showGameOver
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none")
              }
              onClick={() => setShowGameOver(false)}
            />
            <div
              className={
                "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md z-50 flex flex-col rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_70%,black_100%)] backdrop-blur transition duration-300 transform " +
                (showGameOver
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
                    {isWinner
                      ? "You Won!"
                      : winner
                      ? "Game Over!"
                      : "Game Ended"}
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
                  onClick={() => setShowGameOver(false)}
                  className="w-full py-3.5 rounded-xl bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30"
                >
                  View Board
                </button>
              </div>
            </div>
          </>
        )}

        {game?.finished_at ? (
          <div className="fixed inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
            <div className="w-full max-w-screen-sm sm:max-w-3xl mx-auto px-4 h-[88px] flex items-center">
              {gameOverControls}
            </div>
          </div>
        ) : (
          /* Mobile footer - fixed positioned */
          <div className="md:hidden">
            <Footer {...footerProps} variant="mobile" />
          </div>
        )}
      </>
    );
  };

  return (
    <main className="h-dvh overflow-hidden text-neutral-100">
      {content()}
      {askNameOpen && !playerId && room?.status === "lobby" && (
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
