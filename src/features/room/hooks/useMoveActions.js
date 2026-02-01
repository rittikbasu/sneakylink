import { useCallback } from "react";
import { indexToCoord } from "@/lib/boardRules";

export const useMoveActions = ({
  game,
  hand,
  selectedCard,
  targetSquare,
  myTurn,
  posting,
  roomId,
  playerId,
  players,
  setGame,
  setHand,
  setSelectedCard,
  setTargetSquare,
  setPosting,
  isOneEyed,
}) => {
  const onConfirmMove = useCallback(async () => {
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
        coord: indexToCoord(targetSquare),
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
          roomId,
          gameId: game.id,
          playerId,
          clientTurnIndex: game.turn_index,
          moveType,
          card: prevSelectedCard,
          coord: indexToCoord(prevTargetSquare),
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
  }, [
    game,
    hand,
    isOneEyed,
    myTurn,
    playerId,
    players,
    posting,
    roomId,
    selectedCard,
    setGame,
    setHand,
    setPosting,
    setSelectedCard,
    setTargetSquare,
    targetSquare,
  ]);

  const onDead = useCallback(async () => {
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
          roomId,
          gameId: game.id,
          playerId,
          clientTurnIndex: game.turn_index,
          moveType: "dead",
          card: selectedCard,
          coord: indexToCoord(targetSquare),
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
  }, [
    game,
    hand,
    myTurn,
    playerId,
    posting,
    roomId,
    selectedCard,
    setHand,
    setPosting,
    setSelectedCard,
    setTargetSquare,
    targetSquare,
  ]);

  return { onConfirmMove, onDead };
};
