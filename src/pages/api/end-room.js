import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { roomId, playerId } = req.body || {};
  if (!roomId || !playerId)
    return res.status(400).json({ error: "roomId and playerId required" });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status, host_player_id, settings")
    .eq("id", roomId)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  if (room.host_player_id !== playerId)
    return res.status(403).json({ error: "Only host can end room" });
  if (room.status !== "lobby")
    return res.status(400).json({ error: "Cannot end after start" });

  const newSettings = { ...(room.settings || {}), ended_by_host: true };
  const { error: roomUpdErr } = await supabaseAdmin
    .from("rooms")
    .update({ status: "finished", settings: newSettings })
    .eq("id", roomId);
  if (roomUpdErr) return res.status(500).json({ error: roomUpdErr.message });

  return res.status(200).json({ ok: true });
}
