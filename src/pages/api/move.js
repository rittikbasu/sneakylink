import { supabaseAdmin } from "@/lib/supabaseAdmin";
import layout from "@/data/boardLayout";
import { generateShuffledDeck, parseCard, shuffleWithSeed } from "@/lib/deck";
import { ALL_LINES } from "@/lib/lines";

function coordToIndex(coord) {
  // coord format: "r,c" 0-based
  const [r, c] = coord.split(",").map((n) => parseInt(n, 10));
  return r * 10 + c;
}

function indexToCoord(idx) {
  const r = Math.floor(idx / 10);
  const c = idx % 10;
  return `${r},${c}`;
}

function isCorner(idx) {
  return idx === 0 || idx === 9 || idx === 90 || idx === 99;
}

function computeOccupancy(moves) {
  const occ = new Map(); // idx -> { team }
  for (const m of moves) {
    if (m.move_type === "place") {
      const idx = coordToIndex(m.coord);
      occ.set(idx, { team: m.team });
    } else if (m.move_type === "remove") {
      const idx = coordToIndex(m.coord);
      occ.delete(idx);
    }
  }
  // Corners are considered pre-filled/locked (immutable)
  occ.set(0, { team: "corner" });
  occ.set(9, { team: "corner" });
  occ.set(90, { team: "corner" });
  occ.set(99, { team: "corner" });
  return occ;
}

function countSequencesForTeam(occ, team) {
  let count = 0;
  for (const line of ALL_LINES) {
    let ok = true;
    for (const idx of line) {
      if (isCorner(idx)) continue;
      const o = occ.get(idx);
      if (!o || o.team !== team) {
        ok = false;
        break;
      }
    }
    if (ok) count++;
  }
  return count;
}

// Helper: list all complete lines for a team (ignoring corners)
function completeLinesForTeam(occ, team) {
  const lines = [];
  for (const line of ALL_LINES) {
    let ok = true;
    for (const idx of line) {
      if (isCorner(idx)) continue;
      const o = occ.get(idx);
      if (!o || o.team !== team) {
        ok = false;
        break;
      }
    }
    if (ok) lines.push(line);
  }
  return lines;
}

function nonCornerIndices(line) {
  const out = [];
  for (const idx of line) {
    if (!isCorner(idx)) out.push(idx);
  }
  return out;
}

// Find maximum number of valid sequences (overlap <= 1 chip)
function countMaxSequences(occ, team) {
  const candidates = completeLinesForTeam(occ, team);
  if (candidates.length === 0) return 0;

  let maxFound = 0;

  function search(idx, usedChips, count) {
    if (idx === candidates.length) {
      maxFound = Math.max(maxFound, count);
      return;
    }
    // Optimization: if current + remaining < maxFound, stop
    if (count + (candidates.length - idx) <= maxFound) return;

    const line = candidates[idx];
    const nc = nonCornerIndices(line);

    // Check overlap with currently selected chips
    let overlap = 0;
    for (const i of nc) {
      if (usedChips.has(i)) overlap++;
    }

    // Option 1: Include this line (if valid)
    if (overlap <= 1) {
      const nextChips = new Set(usedChips);
      for (const i of nc) nextChips.add(i);
      search(idx + 1, nextChips, count + 1);
    }

    // Option 2: Skip this line
    search(idx + 1, usedChips, count);
  }

  search(0, new Set(), 0);
  return maxFound;
}

function isIndexInLockedSequence(occ, idx, team) {
  // Build accepted lines under the one-common-chip rule
  const used = new Set();
  const accepted = [];
  for (const line of ALL_LINES) {
    let ok = true;
    for (const p of line) {
      if (isCorner(p)) continue;
      const o = occ.get(p);
      if (!o || o.team !== team) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let overlap = 0;
    for (const p of line) {
      if (isCorner(p)) continue;
      if (used.has(p)) overlap++;
      if (overlap > 1) break;
    }
    if (overlap <= 1) {
      accepted.push(line);
      for (const p of line) if (!isCorner(p)) used.add(p);
    }
  }
  // Check if idx is in any accepted line (non-corner)
  for (const line of accepted) {
    if (!isCorner(idx) && line.includes(idx)) return true;
  }
  return false;
}

function allowedPositionsForCard(card) {
  const { rank, suit } = parseCard(card);
  if (rank === "J") return []; // handled separately by jack rules
  const positions = [];
  for (let i = 0; i < layout.length; i++) {
    const cell = layout[i];
    if (cell.type === "card" && cell.rank === rank && cell.suit === suit)
      positions.push(i);
  }
  return positions;
}

function isOneEyedJack(card) {
  const { rank, suit } = parseCard(card);
  return rank === "J" && (suit === "spade" || suit === "heart");
}

function isTwoEyedJack(card) {
  const { rank, suit } = parseCard(card);
  return rank === "J" && (suit === "club" || suit === "diamond");
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { roomId, gameId, playerId, clientTurnIndex, moveType, card, coord } =
    req.body || {};
  if (!roomId || !gameId || !playerId || clientTurnIndex == null || !moveType) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // Pull game state
  const { data: game, error: gameErr } = await supabaseAdmin
    .from("games")
    .select(
      "id, room_id, turn_index, current_team, draw_pile, discard_pile, board_state, turn_order"
    )
    .eq("id", gameId)
    .single();
  if (gameErr || !game)
    return res.status(404).json({ error: "Game not found" });
  if (game.room_id !== roomId)
    return res.status(400).json({ error: "Room mismatch" });
  if (clientTurnIndex !== game.turn_index)
    return res.status(409).json({ error: "Turn out of date" });

  // Player and team
  const { data: player, error: playerErr } = await supabaseAdmin
    .from("players")
    .select("id, team")
    .eq("id", playerId)
    .single();
  if (playerErr || !player)
    return res.status(404).json({ error: "Player not found" });

  // Current hand
  const { data: handRow, error: handErr } = await supabaseAdmin
    .from("hands")
    .select("id, cards")
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .single();
  if (handErr || !handRow)
    return res.status(404).json({ error: "Hand not found" });

  const hand = [...(handRow.cards || [])];
  const hasCard = card ? hand.includes(card) : false;

  // Board State (from JSON to Map)
  const boardState = game.board_state || {};
  const occ = new Map();
  for (const [k, v] of Object.entries(boardState)) {
    occ.set(parseInt(k, 10), v);
  }

  let drawPile = game.draw_pile;
  let discardPile = game.discard_pile || [];

  function drawOne() {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) return null;
      // Reshuffle discards
      // We don't need seed anymore for shuffle if we use a simple robust shuffle.
      // But we imported shuffleWithSeed. Let's use it with a random seed or timestamp.
      // Or just Math.random().
      // Since we want determinism mostly for debugging but random is fine here.
      // Let's use a timestamp-based seed.
      const seedReshuffle = `reshuffle_${Date.now()}`;
      drawPile = shuffleWithSeed(discardPile, seedReshuffle);
      discardPile = [];
    }
    return drawPile.shift();
  }

  // Build player turn order:
  // Prefer persisted game.turn_order; fallback to grouped round-robin.
  let turnOrder = [];
  if (Array.isArray(game.turn_order) && game.turn_order.length > 0) {
    const { data: allPlayers } = await supabaseAdmin
      .from("players")
      .select("id, team")
      .eq("room_id", game.room_id);
    const byId = new Map((allPlayers || []).map((p) => [p.id, p]));
    turnOrder = game.turn_order
      .map((pid) => ({ id: pid, team: byId.get(pid)?.team }))
      .filter((p) => p.team);
  } else {
    const { data: turnPlayers, error: turnPlayersErr } = await supabaseAdmin
      .from("players")
      .select("id, team, seat_index")
      .eq("room_id", game.room_id)
      .order("seat_index", { ascending: true });
    if (turnPlayersErr || !turnPlayers || turnPlayers.length === 0) {
      return res.status(400).json({ error: "No players in room" });
    }
    const grouped = {
      A: turnPlayers.filter((p) => p.team === "A"),
      B: turnPlayers.filter((p) => p.team === "B"),
      C: turnPlayers.filter((p) => p.team === "C"),
    };
    const teamOrder = ["A", "B", "C"].filter((t) => grouped[t].length > 0);
    const maxLen = Math.max(...teamOrder.map((t) => grouped[t].length));
    for (let i = 0; i < maxLen; i++) {
      for (const t of teamOrder) {
        if (grouped[t][i]) turnOrder.push(grouped[t][i]);
      }
    }
  }
  const currentIndex = game.turn_index % turnOrder.length;
  const expectedPlayerId = turnOrder[currentIndex].id;
  const nextTeam = turnOrder[(currentIndex + 1) % turnOrder.length].team;

  // Enforce exact player turn
  if (playerId !== expectedPlayerId) {
    return res.status(403).json({ error: "Not your turn" });
  }

  if (moveType === "place") {
    if (!card || !coord)
      return res.status(400).json({ error: "card and coord required" });
    if (!hasCard) return res.status(400).json({ error: "Card not in hand" });
    const idx = coordToIndex(coord);
    if (isCorner(idx))
      return res.status(400).json({ error: "Corner is immutable" });
    if (occ.has(idx)) return res.status(400).json({ error: "Square occupied" });
    if (isTwoEyedJack(card)) {
      // any empty non-corner is fine
    } else {
      const allowed = allowedPositionsForCard(card);
      if (!allowed.includes(idx))
        return res.status(400).json({ error: "Card does not match square" });
    }
    // Apply: remove card from hand, draw new (preserve slot position)
    const cardIndex = hand.indexOf(card);
    hand.splice(cardIndex, 1);
    discardPile.push(card);
    const draw = drawOne();
    if (draw) {
      hand.splice(cardIndex, 0, draw);
    }
    // Persist transactionally-ish (best effort in sequence): insert move, update hand, update game turn
    const { error: insErr } = await supabaseAdmin.from("moves").insert({
      game_id: gameId,
      player_id: playerId,
      turn_index: game.turn_index,
      move_type: "place",
      team: player.team,
      card,
      coord,
    });
    if (insErr) return res.status(500).json({ error: insErr.message });
    const { error: handUpdErr } = await supabaseAdmin
      .from("hands")
      .update({ cards: hand })
      .eq("id", handRow.id);
    if (handUpdErr) return res.status(500).json({ error: handUpdErr.message });
    // Sequence detection and potential finish
    const newOcc = new Map(occ);
    // idx is already calculated above
    newOcc.set(idx, { team: player.team });

    boardState[String(idx)] = { team: player.team };

    const seqCount = countMaxSequences(newOcc, player.team);
    let gameUpdate = {
      turn_index: game.turn_index + 1,
      current_team: nextTeam,
      draw_pile: drawPile,
      discard_pile: discardPile,
      board_state: boardState,
      last_move: {
        player_id: playerId,
        type: "place",
        card,
        coord,
        team: player.team,
      },
    };
    const { data: roomRow } = await supabaseAdmin
      .from("rooms")
      .select("settings, id")
      .eq("id", game.room_id)
      .single();
    const needed = (roomRow?.settings?.win_sequences ?? 2) | 0;
    if (seqCount >= needed) {
      gameUpdate = {
        ...gameUpdate,
        finished_at: new Date().toISOString(),
        winner_team: player.team,
      };
      await supabaseAdmin
        .from("rooms")
        .update({ status: "finished" })
        .eq("id", game.room_id);
    }
    const { error: gameUpdErr } = await supabaseAdmin
      .from("games")
      .update(gameUpdate)
      .eq("id", gameId)
      .eq("turn_index", game.turn_index);
    if (gameUpdErr) return res.status(500).json({ error: gameUpdErr.message });
    return res.status(200).json({ ok: true });
  }

  if (moveType === "remove") {
    if (!card || !coord)
      return res.status(400).json({ error: "card and coord required" });
    if (!hasCard) return res.status(400).json({ error: "Card not in hand" });
    if (!isOneEyedJack(card))
      return res.status(400).json({ error: "Removal requires one-eyed jack" });
    const idx = coordToIndex(coord);
    if (isCorner(idx))
      return res.status(400).json({ error: "Cannot remove corner" });
    const target = occ.get(idx);
    if (!target || target.team === player.team)
      return res.status(400).json({ error: "No opponent chip here" });
    if (isIndexInLockedSequence(occ, idx, target.team))
      return res.status(400).json({ error: "Cannot remove locked chip" });
    // Remove: consume card and draw new (preserve slot position)
    const cardIndex = hand.indexOf(card);
    hand.splice(cardIndex, 1);
    discardPile.push(card);
    const draw = drawOne();
    if (draw) {
      hand.splice(cardIndex, 0, draw);
    }
    const { error: insErr } = await supabaseAdmin.from("moves").insert({
      game_id: gameId,
      player_id: playerId,
      turn_index: game.turn_index,
      move_type: "remove",
      team: player.team,
      card,
      coord,
    });
    if (insErr) return res.status(500).json({ error: insErr.message });
    const { error: handUpdErr } = await supabaseAdmin
      .from("hands")
      .update({ cards: hand })
      .eq("id", handRow.id);
    if (handUpdErr) return res.status(500).json({ error: handUpdErr.message });

    delete boardState[String(idx)];

    const { error: gameUpdErr } = await supabaseAdmin
      .from("games")
      .update({
        turn_index: game.turn_index + 1,
        current_team: nextTeam,
        draw_pile: drawPile,
        discard_pile: discardPile,
        board_state: boardState,
        last_move: {
          player_id: playerId,
          type: "remove",
          card,
          coord,
          team: player.team,
        },
      })
      .eq("id", gameId)
      .eq("turn_index", game.turn_index);
    if (gameUpdErr) return res.status(500).json({ error: gameUpdErr.message });
    return res.status(200).json({ ok: true });
  }

  if (moveType === "dead") {
    if (!card) return res.status(400).json({ error: "card required" });
    if (!hasCard) return res.status(400).json({ error: "Card not in hand" });
    // Check both positions for the card are covered (dead)
    const positions = allowedPositionsForCard(card);
    const allCovered =
      positions.length > 0 && positions.every((i) => isCorner(i) || occ.has(i));
    if (!allCovered) return res.status(400).json({ error: "Card is not dead" });
    const cardIndex = hand.indexOf(card);
    hand.splice(cardIndex, 1);
    discardPile.push(card);
    const draw = drawOne();
    if (draw) {
      hand.splice(cardIndex, 0, draw);
    }
    const { error: insErr } = await supabaseAdmin.from("moves").insert({
      game_id: gameId,
      player_id: playerId,
      turn_index: game.turn_index,
      move_type: "dead",
      team: player.team,
      card,
    });
    if (insErr) return res.status(500).json({ error: insErr.message });
    const { error: handUpdErr } = await supabaseAdmin
      .from("hands")
      .update({ cards: hand })
      .eq("id", handRow.id);
    if (handUpdErr) return res.status(500).json({ error: handUpdErr.message });
    const { error: gameUpdErr } = await supabaseAdmin
      .from("games")
      .update({
        turn_index: game.turn_index + 1,
        current_team: nextTeam,
        draw_pile: drawPile,
        discard_pile: discardPile,
        last_move: {
          player_id: playerId,
          type: "dead",
          card,
          team: player.team,
        },
      })
      .eq("id", gameId)
      .eq("turn_index", game.turn_index);
    if (gameUpdErr) return res.status(500).json({ error: gameUpdErr.message });
    return res.status(200).json({ ok: true });
  }

  if (moveType === "timeout") {
    const { error: insErr } = await supabaseAdmin.from("moves").insert({
      game_id: gameId,
      player_id: playerId,
      turn_index: game.turn_index,
      move_type: "timeout",
      team: player.team,
    });
    if (insErr) return res.status(500).json({ error: insErr.message });
    const { error: gameUpdErr } = await supabaseAdmin
      .from("games")
      .update({
        turn_index: game.turn_index + 1,
        current_team: nextTeam,
        last_move: { player_id: playerId, type: "timeout", team: player.team },
      })
      .eq("id", gameId);
    if (gameUpdErr) return res.status(500).json({ error: gameUpdErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown move type" });
}
