import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { validateRoomCode } from "@/lib/id";
import { getClientId } from "@/lib/clientId";

export const useRoomData = ({
  code,
  router,
  playerId,
  setPlayerId,
  room,
  setRoom,
  players,
  setPlayers,
  game,
  setGame,
  setHand,
  setSelectedCard,
  setTargetSquare,
  setShowGameOver,
  onEndGameConfirmed,
  refreshGameState,
}) => {
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [askNameOpen, setAskNameOpen] = useState(false);
  const [tempName, setTempName] = useState("");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [resolvingPlayer, setResolvingPlayer] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [kickedNotice, setKickedNotice] = useState(false);
  const kickCheckRef = useRef({ inFlight: false, lastAt: 0 });
  // Track per-code so navigating from /room/ABC to /room/DEF resets properly
  const deepLinkCodeRef = useRef(null);

  // When the room code changes (client-side navigation between rooms),
  // clear stale state from the previous room so auto-join runs fresh.
  const prevCodeRef = useRef(null);
  useEffect(() => {
    if (prevCodeRef.current !== null && prevCodeRef.current !== code) {
      setPlayerId(null);
      setKickedNotice(false);
      setAskNameOpen(false);
    }
    prevCodeRef.current = code;
  }, [code, setPlayerId]);

  const lastRoomSyncRef = useRef(0);
  const roomSyncInFlightRef = useRef(false);

  const refreshRoomState = useCallback(async (reason = "resume", force = false) => {
    if (!code) return;
    if (!validateRoomCode(code)) return;
    if (roomSyncInFlightRef.current) return;
    const now = Date.now();
    if (!force && now - lastRoomSyncRef.current < 2000) return;
    roomSyncInFlightRef.current = true;
    lastRoomSyncRef.current = now;

    try {
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let ps = [];
      if (roomRow) {
        const { data } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomRow.id)
          .order("seat_index", { ascending: true });
        ps = data || [];
      }

      // Batch both updates in the same tick to prevent
      // an intermediate render with new room but stale players
      setRoom(roomRow || null);
      setPlayers(ps);
    } finally {
      roomSyncInFlightRef.current = false;
    }
  }, [code, setPlayers, setRoom]);

  const joinRoomWithClient = useCallback(
    async ({ name, playerId: legacyPlayerId } = {}) => {
      if (!code) return { ok: false, data: { error: "Missing code" } };
      const clientId = getClientId();
      const payload = { code, client_id: clientId };
      if (name) payload.name = name;
      if (legacyPlayerId) payload.player_id = legacyPlayerId;

      try {
        const res = await fetch("/api/join-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0, data: { error: "Network error" } };
      }
    },
    [code]
  );

  useEffect(() => {
    if (!code) return;
    if (!validateRoomCode(code)) return;
    if (playerId) return;
    if (deepLinkCodeRef.current === code) return;
    deepLinkCodeRef.current = code;
    let cancelled = false;

    (async () => {
      setResolvingPlayer(true);
      // Attempt rejoin / auto-join using client_id
      try {
        const legacyPid = localStorage.getItem(`seq_pid:${code}`);
        if (legacyPid) {
          const { ok, data } = await joinRoomWithClient({
            playerId: legacyPid,
          });
          if (cancelled) return;
          if (ok) {
            setPlayerId(data.player_id);
            setAskNameOpen(false);
            setKickedNotice(false);
            refreshRoomState("legacy-rejoin", true);
            try {
              localStorage.removeItem(`seq_pid:${code}`);
            } catch {}
            return;
          }
          const legacyErr = data?.error;
          if (legacyErr === "Player not found in this room") {
            try {
              localStorage.removeItem(`seq_pid:${code}`);
            } catch {}
          }
        }

        const savedName = localStorage.getItem("seq_name");
        const trimmedName = savedName?.trim();
        if (trimmedName) setNameSubmitting(true);

        const { ok, data } = await joinRoomWithClient({
          name: trimmedName || undefined,
        });
        if (cancelled) return;

        if (ok) {
          setPlayerId(data.player_id);
          setAskNameOpen(false);
          setKickedNotice(false);
          refreshRoomState("auto-join", true);
          return;
        }

        const err = data?.error;
        if (err === "Name is required to join") {
          setAskNameOpen(true);
        } else if (err === "Game already started") {
          // RoomGate will handle the UI
        } else if (err === "Room not found") {
          // Let the room loader handle it
        } else {
          setAskNameOpen(true);
        }
      } finally {
        if (!cancelled) {
          setNameSubmitting(false);
          setResolvingPlayer(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, joinRoomWithClient, playerId, refreshRoomState, setPlayerId]);

  useEffect(() => {
    if (!room || room.status === "lobby") return;
    if (playerId || resolvingPlayer) return;
    let cancelled = false;

    (async () => {
      setResolvingPlayer(true);
      const { ok, data } = await joinRoomWithClient();
      if (cancelled) return;
      if (ok) {
        setPlayerId(data.player_id);
        refreshRoomState("active-rejoin", true);
      }
      setResolvingPlayer(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    joinRoomWithClient,
    playerId,
    refreshRoomState,
    resolvingPlayer,
    room,
    setPlayerId,
  ]);

  const submitNameJoin = useCallback(async () => {
    if (!tempName.trim()) {
      setNameError(true);
      return;
    }
    setNameSubmitting(true);
    try {
      const { ok, data } = await joinRoomWithClient({
        name: tempName.trim(),
      });
      if (!ok) {
        alert(data.error || "Failed to join");
        return;
      }
      try {
        localStorage.setItem("seq_name", tempName.trim());
      } catch {}
      setAskNameOpen(false);
      setKickedNotice(false);
      setPlayerId(data.player_id);
      refreshRoomState("name-join", true);
    } catch {
      alert("Failed to join");
    } finally {
      setNameSubmitting(false);
    }
  }, [joinRoomWithClient, refreshRoomState, setPlayerId, tempName]);

  // 1. Initial Load & Room Subscription (Stable)
  useEffect(() => {
    if (!code) return;
    if (!validateRoomCode(code)) {
      setLoading(false);
      return;
    }
    let mounted = true;

    (async () => {
      // Fetch ALL data before setting any state to prevent intermediate
      // renders where room is set but players list is stale (which causes
      // the kicked-detection to fire false positives + duplicate players)
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!mounted) return;

      let ps = [];
      let g = null;
      let handCards = null;

      if (roomRow) {
        const { data: playersData } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomRow.id)
          .order("seat_index", { ascending: true });
        if (!mounted) return;
        ps = playersData || [];

        if (roomRow.status !== "lobby") {
          const { data: gs } = await supabase
            .from("games")
            .select("*")
            .eq("room_id", roomRow.id)
            .order("created_at", { ascending: false })
            .limit(1);
          g = gs && gs.length ? gs[0] : null;

          if (g && playerId) {
            const { data: handRow } = await supabase
              .from("hands")
              .select("cards")
              .eq("game_id", g.id)
              .eq("player_id", playerId)
              .single();
            handCards = handRow?.cards || [];
          }
        }
      }

      if (!mounted) return;

      // Batch ALL state updates in the same synchronous tick so React
      // renders them together — no intermediate "room=lobby, players=stale"
      setRoom(roomRow || null);
      setPlayers(ps);
      if (roomRow && roomRow.status !== "lobby") {
        setGame(g);
        if (handCards !== null) {
          setHand(handCards);
        }
      } else {
        setGame(null);
        setHand([]);
        setShowGameOver(false);
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
          // On reconnect, refresh both room AND game state
          // (realtime doesn't replay events missed while disconnected)
          refreshRoomState("room-subscribe");
          refreshGameState("room-subscribe");
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(roomSub);
    };
  }, [
    code,
    playerId,
    refreshGameState,
    refreshRoomState,
    setGame,
    setHand,
    setRoom,
    setPlayers,
    setSelectedCard,
    setShowGameOver,
    setTargetSquare,
  ]);

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
  }, [refreshGameState, room?.id, setGame, setPlayers]);

  const startGame = useCallback(async () => {
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
  }, [playerId, room]);

  const switchTeam = useCallback(
    async (nextTeam) => {
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
    },
    [playerId, players, room, setPlayers]
  );

  const updateSettings = useCallback(
    async (newSettings) => {
      if (!room || !playerId || room.host_player_id !== playerId) return;

      const prevRoom = { ...room };
      const prevPlayers = players;
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              settings: { ...(prev.settings || {}), ...newSettings },
            }
          : prev
      );
      let migratedPlayers = null;
      if (newSettings.teams === 2 && prevPlayers?.length) {
        const cPlayers = [...prevPlayers]
          .filter((p) => p.team === "C")
          .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0));
        if (cPlayers.length) {
          let countA = prevPlayers.filter((p) => p.team === "A").length;
          let countB = prevPlayers.filter((p) => p.team === "B").length;
          const migrations = new Map();

          for (const p of cPlayers) {
            if (countA <= countB) {
              migrations.set(p.id, "A");
              countA += 1;
            } else {
              migrations.set(p.id, "B");
              countB += 1;
            }
          }

          migratedPlayers = prevPlayers.map((p) =>
            migrations.has(p.id)
              ? { ...p, team: migrations.get(p.id) }
              : p
          );
          setPlayers(migratedPlayers);
        }
      }

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
        if (migratedPlayers) setPlayers(prevPlayers);
      }
    },
    [playerId, players, room, setPlayers, setRoom]
  );

  const handleEndGame = useCallback(async () => {
    if (!room || !game || !playerId || room.host_player_id !== playerId) return;
    const confirmed = confirm(
      "Are you sure you want to end this game? This cannot be undone."
    );
    if (!confirmed) return;

    onEndGameConfirmed?.();
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
    } catch {
      alert("Failed to end game");
    }
  }, [game, onEndGameConfirmed, playerId, room]);

  const handlePlayAgain = useCallback(async () => {
    if (!room || room.host_player_id !== playerId) return;
    try {
      const res = await fetch("/api/play-again", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to start new round");
      }
    } catch {
      alert("Failed to start new round. Please try again.");
    }
  }, [playerId, room]);

  const leaveRoom = useCallback(async () => {
    if (!room || !playerId) return false;
    if (room.host_player_id === playerId) return false;
    if (room.status !== "lobby") {
      alert("You can only leave while in the lobby.");
      return false;
    }

    try {
      const res = await fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to leave room");
        return false;
      }
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      setPlayerId(null);
      router.push("/");
      return true;
    } catch {
      alert("Failed to leave room");
      return false;
    }
  }, [playerId, room, router, setPlayerId, setPlayers]);

  const endRoom = useCallback(async () => {
    if (!room || !playerId) return false;
    if (room.host_player_id !== playerId) return false;
    if (room.status !== "lobby") {
      alert("You can only end the room while in the lobby.");
      return false;
    }

    try {
      const res = await fetch("/api/end-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to end room");
        return false;
      }
      setPlayers([]);
      setRoom(null);
      setPlayerId(null);
      router.push("/");
      return true;
    } catch {
      alert("Failed to end room");
      return false;
    }
  }, [playerId, room, router, setPlayerId, setPlayers, setRoom]);

  const dismissKickedNotice = useCallback(() => {
    setKickedNotice(false);
  }, []);

  const kickPlayer = useCallback(
    async (targetPlayerId) => {
      if (!room || !playerId) return false;
      if (room.host_player_id !== playerId) return false;
      if (!targetPlayerId || targetPlayerId === playerId) return false;

      const prevPlayers = players;
      setPlayers((prev) => prev.filter((p) => p.id !== targetPlayerId));

      try {
        const res = await fetch("/api/kick-player", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: room.id,
            playerId,
            targetPlayerId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data.error || "Failed to kick player");
          setPlayers(prevPlayers);
          return false;
        }
        return true;
      } catch {
        alert("Failed to kick player");
        setPlayers(prevPlayers);
        return false;
      }
    },
    [playerId, players, room, setPlayers]
  );

  useEffect(() => {
    if (loading) return;
    if (room?.status !== "lobby") return;
    if (!playerId) return;
    const stillHere = players.some((p) => p.id === playerId);
    if (stillHere) return;
    const now = Date.now();
    if (kickCheckRef.current.inFlight) return;
    if (now - kickCheckRef.current.lastAt < 1500) return;
    kickCheckRef.current.inFlight = true;
    kickCheckRef.current.lastAt = now;

    (async () => {
      const { ok, data } = await joinRoomWithClient();
      kickCheckRef.current.inFlight = false;

      if (ok) {
        setPlayerId(data.player_id);
        refreshRoomState("kick-check", true);
        return;
      }

      const err = data?.error;
      if (err === "Name is required to join") {
        setPlayerId(null);
        setKickedNotice(true);
        setAskNameOpen(true);
      }
    })();
  }, [
    joinRoomWithClient,
    loading,
    playerId,
    players,
    refreshRoomState,
    room?.status,
    setPlayerId,
  ]);

  return {
    loading,
    starting,
    askNameOpen,
    tempName,
    nameSubmitting,
    nameError,
    kickedNotice,
    resolvingPlayer,
    setTempName,
    setNameError,
    submitNameJoin,
    startGame,
    switchTeam,
    updateSettings,
    handleEndGame,
    handlePlayAgain,
    dismissKickedNotice,
    leaveRoom,
    endRoom,
    kickPlayer,
    refreshRoomState,
  };
};
