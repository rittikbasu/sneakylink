import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { roomId, playerId, team } = req.body || {};
  if (!roomId || !playerId || !team)
    return res.status(400).json({ error: "roomId, playerId, team required" });
  if (!["A", "B", "C"].includes(team))
    return res.status(400).json({ error: "Invalid team" });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status")
    .eq("id", roomId)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });
  if (room.status !== "lobby")
    return res.status(400).json({ error: "Cannot switch teams after start" });

  const { error: updErr } = await supabaseAdmin
    .from("players")
    .update({ team })
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (updErr) return res.status(500).json({ error: updErr.message });
  return res.status(200).json({ ok: true });
}
