import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateSeed } from "@/lib/id";
import { generateShuffledDeck } from "@/lib/deck";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { roomId, playerId } = req.body || {};
  if (!roomId || !playerId)
    return res.status(400).json({ error: "roomId and playerId required" });

  // Verify host
  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status, host_player_id, settings")
    .eq("id", roomId)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  if (room.host_player_id !== playerId)
    return res.status(403).json({ error: "Only host can start" });
  if (room.status !== "lobby")
    return res.status(400).json({ error: "Already started" });

  const { data: players, error: playersErr } = await supabaseAdmin
    .from("players")
    .select("id, team")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });
  if (playersErr) return res.status(500).json({ error: playersErr.message });
  if (!players || players.length < 2)
    return res.status(400).json({ error: "Need at least 2 players" });

  const seed = generateSeed();
  const deck = generateShuffledDeck(seed);
  const handSize = (room.settings?.hand_size ?? 5) | 0;

  // Round-robin deal
  const hands = new Map();
  for (const p of players) hands.set(p.id, []);
  let cursor = 0;
  for (let r = 0; r < handSize; r++) {
    for (const p of players) {
      hands.get(p.id).push(deck[cursor++]);
    }
  }

  // Build persisted turn order (round-robin by team, by seat order)
  const grouped = {
    A: players.filter((p) => p.team === "A"),
    B: players.filter((p) => p.team === "B"),
    C: players.filter((p) => p.team === "C"),
  };
  const teamOrder = ["A", "B", "C"].filter((t) => grouped[t].length > 0);
  const maxLen = Math.max(...teamOrder.map((t) => grouped[t].length));
  const turnOrder = [];
  for (let i = 0; i < maxLen; i++) {
    for (const t of teamOrder) {
      if (grouped[t][i]) turnOrder.push(grouped[t][i].id);
    }
  }

  // Create game
  // Validate teams are balanced
  const numTeams = room.settings?.teams ?? 2;
  const teamCounts = { A: 0, B: 0, C: 0 };
  for (const p of players) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
  const activeCounts =
    numTeams === 2
      ? [teamCounts.A, teamCounts.B]
      : [teamCounts.A, teamCounts.B, teamCounts.C];
  const balanced = activeCounts.every((c) => c === activeCounts[0] && c > 0);
  if (!balanced)
    return res.status(400).json({ error: "Teams must be balanced" });

  const { data: game, error: gameErr } = await supabaseAdmin
    .from("games")
    .insert({
      room_id: roomId,
      seed,
      turn_index: 0,
      current_team: players.find((p) => p.id === turnOrder[0])?.team ?? "A",
      deck_cursor: cursor,
      discard_count: 0,
      // If the column doesn't exist, Postgres will ignore; safe to include.
      turn_order: turnOrder,
    })
    .select()
    .single();
  if (gameErr) return res.status(500).json({ error: gameErr.message });

  // Persist hands
  const inserts = Array.from(hands.entries()).map(([player_id, cards]) => ({
    game_id: game.id,
    player_id,
    cards,
  }));
  const { error: handsErr } = await supabaseAdmin.from("hands").insert(inserts);
  if (handsErr) return res.status(500).json({ error: handsErr.message });

  // Mark room active
  const { error: roomUpdErr } = await supabaseAdmin
    .from("rooms")
    .update({ status: "active" })
    .eq("id", roomId);
  if (roomUpdErr) return res.status(500).json({ error: roomUpdErr.message });

  return res.status(200).json({ game_id: game.id });
}
