import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateRoomCode } from "@/lib/id";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { name, settings } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  const code = generateRoomCode(6);
  const roomSettings = {
    hand_size: 5,
    teams: 2,
    win_sequences: 2,
    ...(settings || {}),
  };

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .insert({ code, status: "lobby", settings: roomSettings })
    .select()
    .single();
  if (roomErr) return res.status(500).json({ error: roomErr.message });

  const { data: player, error: playerErr } = await supabaseAdmin
    .from("players")
    .insert({
      room_id: room.id,
      name: name.trim(),
      team: "A",
      seat_index: 0,
      is_host: true,
    })
    .select()
    .single();
  if (playerErr) return res.status(500).json({ error: playerErr.message });

  await supabaseAdmin
    .from("rooms")
    .update({ host_player_id: player.id })
    .eq("id", room.id);

  return res
    .status(200)
    .json({ code: room.code, room_id: room.id, player_id: player.id });
}
