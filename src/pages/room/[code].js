import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import layout from "@/data/boardLayout";
import { parseCard, formatCard } from "@/lib/deck";
import { useResumeSync } from "@/features/room/hooks/useResumeSync";
import { useGameData } from "@/features/room/hooks/useGameData";
import { useMoveActions } from "@/features/room/hooks/useMoveActions";
import GameView from "@/features/room/views/GameView";
import LobbyView from "@/features/room/views/LobbyView";
import RoomGate from "@/features/room/views/RoomGate";
import {
  buildPlayersByTurn,
  buildSidebarScores,
  buildSidebarTeams,
  getTurnPlayer,
  groupPlayersByTeam,
} from "@/features/room/selectors/roomSelectors";
import { validateRoomCode } from "@/lib/id";
import { Play } from "lucide-react";

const POSITIONS_BY_CARD = (() => {
  const map = new Map();
  for (let i = 0; i < layout.length; i++) {
    const cell = layout[i];
    if (cell.type !== "card") continue;
    const key = formatCard(cell.rank, cell.suit);
    const list = map.get(key);
    if (list) {
      list.push(i);
    } else {
      map.set(key, [i]);
    }
  }
  return map;
})();

const isOneEyed = (card) => {
  const { rank, suit } = parseCard(card);
  return rank === "J" && (suit === "spade" || suit === "heart");
};

const isTwoEyed = (card) => {
  const { rank, suit } = parseCard(card);
  return rank === "J" && (suit === "club" || suit === "diamond");
};

const allowedPositionsForCard = (card) => {
  const { rank } = parseCard(card);
  if (rank === "J") return [];
  return POSITIONS_BY_CARD.get(card) ?? [];
};

export default function RoomPage() {
  const router = useRouter();
  const rawCode = router.query?.code;
  const code = typeof rawCode === "string" ? rawCode.toUpperCase() : undefined;
  const [playerId, setPlayerId] = useState(null);

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const wakeLockRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [askNameOpen, setAskNameOpen] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [tempName, setTempName] = useState("");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const deepLinkHandledRef = useRef(false);

  const isHost = room && playerId && room.host_player_id === playerId;
  const me = useMemo(
    () => players.find((p) => p.id === playerId) || null,
    [players, playerId]
  );

  const {
    game,
    setGame,
    hand,
    setHand,
    selectedCard,
    setSelectedCard,
    targetSquare,
    setTargetSquare,
    glowData,
    highlight,
    chips,
    seqA,
    seqB,
    seqC,
    allowed,
    isSelectedCardDead,
    refreshGameState,
  } = useGameData({
    room,
    playerId,
    meTeam: me?.team,
    isOneEyed,
    isTwoEyed,
    allowedPositionsForCard,
  });

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

        if (roomRow.status !== "lobby") {
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
        } else {
          setGame(null);
          setHand([]);
          setShowGameOver(false);
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
              setHand([]);
              setSelectedCard(null);
              setTargetSquare(null);
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

  useResumeSync({
    roomId: room?.id,
    playerId,
    onResume: refreshGameState,
  });

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
  const currentRoomId = room?.id;

  const groupedPlayers = useMemo(
    () => groupPlayersByTeam(players),
    [players]
  );

  const playersByTurnSafe = useMemo(
    () => buildPlayersByTurn(groupedPlayers),
    [groupedPlayers]
  );

  const sidebarTeams = useMemo(
    () =>
      buildSidebarTeams({
        game,
        players,
        playerId,
        hostId: room?.host_player_id,
        teamsSetting: room?.settings?.teams ?? 2,
      }),
    [game, players, playerId, room?.host_player_id, room?.settings?.teams]
  );

  const sidebarScores = useMemo(
    () =>
      buildSidebarScores({
        game,
        chips,
        teamsSetting: room?.settings?.teams ?? 2,
      }),
    [game, chips, room?.settings?.teams]
  );

  const turnPlayer = useMemo(
    () => getTurnPlayer(playersByTurnSafe, game),
    [playersByTurnSafe, game]
  );

  const onSquareClick = useCallback((idx) => {
    if (!myTurn || !selectedCard || posting || turnPlayer?.id !== me?.id)
      return;
    if (!allowed || !allowed.has(idx)) return;
    setTargetSquare(idx);
  }, [allowed, me?.id, myTurn, posting, selectedCard, turnPlayer]);

  const teamColor =
    (turnPlayer?.team === "A"
      ? "text-emerald-500"
      : turnPlayer?.team === "B"
      ? "text-sky-500"
      : "text-rose-500") || "text-emerald-500";
  const myTeamColor =
    me?.team === "A" ? "emerald" : me?.team === "B" ? "sky" : "rose";
  const isMyTurn =
    game &&
    me &&
    turnPlayer &&
    turnPlayer.id === me.id &&
    room?.status === "active";
  const canConfirm =
    selectedCard &&
    targetSquare != null &&
    isMyTurn &&
    allowed?.has(targetSquare);
  const canDead =
    selectedCard &&
    isSelectedCardDead &&
    isMyTurn &&
    !posting &&
    targetSquare == null;

  const { onConfirmMove, onDead } = useMoveActions({
    game,
    hand,
    selectedCard,
    targetSquare,
    myTurn,
    posting,
    roomId: currentRoomId,
    playerId,
    players,
    setGame,
    setHand,
    setSelectedCard,
    setTargetSquare,
    setPosting,
    isOneEyed,
  });

  const handleCardSelect = useCallback(
    (card) => {
      setSelectedCard(card === selectedCard ? null : card);
      setTargetSquare(null);
    },
    [selectedCard]
  );

  const footerProps = useMemo(
    () => ({
      hand,
      selectedCard,
      onCardSelect: handleCardSelect,
      onConfirmMove,
      onDeadCard: onDead,
      canConfirm,
      canDead,
      turnUsername: turnPlayer?.name || `Team ${game?.current_team}`,
      teamColorClass: teamColor,
      myTeamColor,
      myTurn: isMyTurn,
    }),
    [
      canConfirm,
      canDead,
      game?.current_team,
      handleCardSelect,
      hand,
      isMyTurn,
      myTeamColor,
      onConfirmMove,
      onDead,
      selectedCard,
      teamColor,
      turnPlayer?.name,
    ]
  );

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
      return (
        <LobbyView
          room={room}
          players={players}
          playerId={playerId}
          isHost={isHost}
          me={me}
          codeCopied={codeCopied}
          linkCopied={linkCopied}
          onCopyCode={copyCode}
          onCopyInvite={copyInvite}
          onSwitchTeam={switchTeam}
          onUpdateSettings={updateSettings}
          onStartGame={startGame}
          starting={starting}
        />
      );
    }

    if (!playerId) {
      return (
        <RoomGate
          gameFinished={!!game?.finished_at}
          onBack={() => router.push("/")}
        />
      );
    }

    const grouped = groupedPlayers;

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

    const boardProps = {
      chips,
      onSquareClick,
      highlight,
      allowed,
      seqA,
      seqB,
      seqC,
      highlightColor: myTeamColor,
      lastMoveData: glowData,
    };

    const gameOverOverlayProps = {
      winner,
      isWinner,
      activeTeams,
      isSolo,
      soloWinnerName,
      grouped,
      sidebarScores,
    };

    return (
      <GameView
        sidebarProps={sidebarProps}
        rulesOpen={rulesOpen}
        onOpenRules={() => setRulesOpen(true)}
        onCloseRules={() => setRulesOpen(false)}
        onOpenSidebar={() => setSidebarOpen(true)}
        boardProps={boardProps}
        footerProps={footerProps}
        gameFinished={!!game?.finished_at}
        gameOverControls={gameOverControls}
        showGameOver={showGameOver}
        onCloseGameOver={() => setShowGameOver(false)}
        gameOverOverlayProps={gameOverOverlayProps}
      />
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
