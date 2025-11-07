import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  
  const { roomId, gameId, playerId } = req.body || {};
  if (!roomId || !gameId || !playerId)
    return res.status(400).json({ error: "Missing fields" });

  // Verify host
  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, host_player_id, status")
    .eq("id", roomId)
    .single();
  
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  
  if (room.host_player_id !== playerId)
    return res.status(403).json({ error: "Only host can end game" });
  
  if (room.status !== "active")
    return res.status(400).json({ error: "No active game to end" });

  // End the game
  const { error: gameUpdErr } = await supabaseAdmin
    .from("games")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", gameId);
  
  if (gameUpdErr)
    return res.status(500).json({ error: gameUpdErr.message });

  // Update room status
  const { error: roomUpdErr } = await supabaseAdmin
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", roomId);
  
  if (roomUpdErr)
    return res.status(500).json({ error: roomUpdErr.message });

  return res.status(200).json({ ok: true });
}

