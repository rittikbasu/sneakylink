import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { roomId, playerId, targetPlayerId } = req.body || {};
  if (!roomId || !playerId || !targetPlayerId)
    return res
      .status(400)
      .json({ error: "roomId, playerId, targetPlayerId required" });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status, host_player_id")
    .eq("id", roomId)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  if (room.host_player_id !== playerId)
    return res.status(403).json({ error: "Only host can kick players" });
  if (room.status !== "lobby")
    return res.status(400).json({ error: "Cannot kick after start" });
  if (targetPlayerId === room.host_player_id)
    return res.status(400).json({ error: "Host cannot be kicked" });

  const { error: delErr } = await supabaseAdmin
    .from("players")
    .delete()
    .eq("id", targetPlayerId)
    .eq("room_id", roomId);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.status(200).json({ ok: true });
}
