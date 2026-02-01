import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { roomId, playerId } = req.body || {};
  if (!roomId || !playerId)
    return res.status(400).json({ error: "roomId and playerId required" });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status, host_player_id")
    .eq("id", roomId)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  if (room.host_player_id === playerId)
    return res.status(400).json({ error: "Host must end the room" });
  if (room.status !== "lobby")
    return res.status(400).json({ error: "Cannot leave after start" });

  const { error: delErr } = await supabaseAdmin
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.status(200).json({ ok: true });
}
