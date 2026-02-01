import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { computeSequenceSets, isCornerIndex } from "@/lib/boardRules";

export const useGameData = ({
  room,
  playerId,
  meTeam,
  isOneEyed,
  isTwoEyed,
  allowedPositionsForCard,
  setShowGameOver,
}) => {
  const [game, setGameState] = useState(null);
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [targetSquare, setTargetSquare] = useState(null);
  const [glowData, setGlowData] = useState(null);

  const glowTimeoutRef = useRef(null);
  const lastMoveRef = useRef(null);
  const lastGlowTurnRef = useRef(null);
  const roomIdRef = useRef(null);
  const roomStatusRef = useRef(null);
  const playerIdRef = useRef(null);
  const gameRef = useRef(null);
  const lastSyncRef = useRef(0);
  const syncInFlightRef = useRef(false);

  const setGame = useCallback(
    (updater) => {
      let finishTransition = null;
      setGameState((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater ?? null;
        const prevFinished = !!prev?.finished_at;
        const nextFinished = !!next?.finished_at;
        if (prevFinished !== nextFinished) {
          finishTransition = nextFinished;
        }
        return next;
      });

      if (finishTransition === true) {
        setSelectedCard(null);
        setTargetSquare(null);
        setShowGameOver?.(true);
      } else if (finishTransition === false) {
        setShowGameOver?.(false);
      }
    },
    [setShowGameOver]
  );

  const refreshGameState = useCallback(async (reason = "resume") => {
    const roomId = roomIdRef.current;
    const roomStatus = roomStatusRef.current;
    const pid = playerIdRef.current;
    const currentGame = gameRef.current;
    if (!roomId || !pid) return;
    if (roomStatus === "lobby") return;
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
  }, [setGame]);

  useEffect(() => {
    roomIdRef.current = room?.id || null;
  }, [room?.id]);

  useEffect(() => {
    roomStatusRef.current = room?.status || null;
  }, [room?.status]);

  useEffect(() => {
    playerIdRef.current = playerId || null;
  }, [playerId]);

  useEffect(() => {
    gameRef.current = game || null;
  }, [game]);

  useEffect(() => {
    if (!game?.id || !playerId) return;

    const fetchGameState = async () => {
      setHand([]);
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
  }, [game?.id, playerId, refreshGameState]);

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

  const highlight = useMemo(() => {
    if (targetSquare == null) return new Set();
    const s = new Set();
    s.add(targetSquare);
    return s;
  }, [targetSquare]);

  const chips = useMemo(() => {
    const m = new Map();
    if (game?.board_state) {
      for (const [k, v] of Object.entries(game.board_state)) {
        m.set(parseInt(k, 10), v.team);
      }
    }
    return m;
  }, [game?.board_state]);

  const { seqA, seqB, seqC } = useMemo(
    () => computeSequenceSets(chips),
    [chips]
  );

  const allowed = useMemo(() => {
    if (!selectedCard) return null;
    const isLocked = (idx) => seqA.has(idx) || seqB.has(idx) || seqC.has(idx);

    const set = new Set();
    if (isTwoEyed(selectedCard)) {
      for (let i = 0; i < 100; i++) {
        if (!chips.has(i) && !isCornerIndex(i)) set.add(i);
      }
      return set;
    }
    if (isOneEyed(selectedCard)) {
      for (let [i, team] of chips.entries()) {
        if (team !== meTeam && !isCornerIndex(i) && !isLocked(i)) set.add(i);
      }
      return set;
    }
    const positions = allowedPositionsForCard(selectedCard);
    for (const i of positions) {
      if (!chips.has(i)) set.add(i);
    }
    return set;
  }, [
    selectedCard,
    chips,
    meTeam,
    seqA,
    seqB,
    seqC,
    isOneEyed,
    isTwoEyed,
    allowedPositionsForCard,
  ]);

  const isSelectedCardDead = useMemo(() => {
    if (!selectedCard) return false;
    const positions = allowedPositionsForCard(selectedCard);
    return (
      positions.length > 0 &&
      positions.every((i) => isCornerIndex(i) || chips.has(i))
    );
  }, [selectedCard, chips, allowedPositionsForCard]);

  return {
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
  };
};
