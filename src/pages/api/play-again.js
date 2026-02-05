import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { roomId, playerId } = req.body || {};
  if (!roomId || !playerId)
    return res.status(400).json({ error: "Missing fields" });

  // Verify host
  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, host_player_id, status, settings")
    .eq("id", roomId)
    .single();

  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });

  if (room.host_player_id !== playerId)
    return res.status(403).json({ error: "Only host can play again" });

  // Reset room status to lobby and clear stale ended_by_host flag
  const cleanSettings = { ...(room.settings || {}) };
  delete cleanSettings.ended_by_host;

  const { error: updErr } = await supabaseAdmin
    .from("rooms")
    .update({ status: "lobby", settings: cleanSettings })
    .eq("id", roomId);

  if (updErr)
    return res.status(500).json({ error: updErr.message });

  return res.status(200).json({ ok: true });
}
