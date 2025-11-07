import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { roomId, playerId, settings } = req.body || {};
  if (!roomId || !playerId || !settings)
    return res
      .status(400)
      .json({ error: "roomId, playerId, settings required" });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status, host_player_id, settings")
    .eq("id", roomId)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  if (room.host_player_id !== playerId)
    return res.status(403).json({ error: "Only host can update settings" });
  if (room.status !== "lobby")
    return res
      .status(400)
      .json({ error: "Cannot change settings after start" });

  const newSettings = { ...room.settings, ...settings };
  const { error: updErr } = await supabaseAdmin
    .from("rooms")
    .update({ settings: newSettings })
    .eq("id", roomId);
  if (updErr) return res.status(500).json({ error: updErr.message });
  return res.status(200).json({ ok: true });
}
