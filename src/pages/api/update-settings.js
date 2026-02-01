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

  if (newSettings.teams === 2) {
    const { data: players, error: playersErr } = await supabaseAdmin
      .from("players")
      .select("id, team, seat_index")
      .eq("room_id", roomId);
    if (playersErr) return res.status(500).json({ error: playersErr.message });

    const cPlayers = (players || [])
      .filter((p) => p.team === "C")
      .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0));
    if (cPlayers.length) {
      let countA = players.filter((p) => p.team === "A").length;
      let countB = players.filter((p) => p.team === "B").length;
      const toA = [];
      const toB = [];

      for (const p of cPlayers) {
        if (countA <= countB) {
          toA.push(p.id);
          countA += 1;
        } else {
          toB.push(p.id);
          countB += 1;
        }
      }

      if (toA.length) {
        const { error: updAErr } = await supabaseAdmin
          .from("players")
          .update({ team: "A" })
          .in("id", toA)
          .eq("room_id", roomId);
        if (updAErr) return res.status(500).json({ error: updAErr.message });
      }

      if (toB.length) {
        const { error: updBErr } = await supabaseAdmin
          .from("players")
          .update({ team: "B" })
          .in("id", toB)
          .eq("room_id", roomId);
        if (updBErr) return res.status(500).json({ error: updBErr.message });
      }
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from("rooms")
    .update({ settings: newSettings })
    .eq("id", roomId);
  if (updErr) return res.status(500).json({ error: updErr.message });
  return res.status(200).json({ ok: true });
}
