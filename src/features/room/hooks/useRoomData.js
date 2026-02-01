import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { validateRoomCode } from "@/lib/id";

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
  const [nameError, setNameError] = useState(false);
  const deepLinkHandledRef = useRef(false);

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
  }, [code, playerId, router, setPlayerId]);

  const submitNameJoin = useCallback(async () => {
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
    } catch {
      alert("Failed to join");
    } finally {
      setNameSubmitting(false);
    }
  }, [code, setPlayerId, tempName]);

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
  }, [
    code,
    playerId,
    refreshGameState,
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
    },
    [playerId, room, setRoom]
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
      await fetch("/api/play-again", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId }),
      });
    } catch {}
  }, [playerId, room]);

  return {
    loading,
    starting,
    askNameOpen,
    tempName,
    nameSubmitting,
    nameError,
    setTempName,
    setNameError,
    submitNameJoin,
    startGame,
    switchTeam,
    updateSettings,
    handleEndGame,
    handlePlayAgain,
  };
};
