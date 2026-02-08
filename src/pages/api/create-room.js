import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateRoomCode } from "@/lib/id";
import { isUuid } from "@/lib/uuid";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { name, settings, client_id: clientIdRaw } = req.body || {};
  const normalizeName = (s) =>
    String(s || "")
      .trim()
      .slice(0, 16);
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return res.status(400).json({ error: "Name is required" });
  }
  const clientId = String(clientIdRaw || "").trim();
  if (!isUuid(clientId)) {
    return res.status(400).json({ error: "client_id is required" });
  }
  const roomSettings = {
    hand_size: 5,
    teams: 2,
    win_sequences: 2,
    ...(settings || {}),
  };

  // Retry loop to handle potential room code collisions
  let room = null;
  let roomErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateRoomCode(6);
    const { data, error } = await supabaseAdmin
      .from("rooms")
      .insert({ code, status: "lobby", settings: roomSettings })
      .select()
      .single();
    if (!error) {
      room = data;
      roomErr = null;
      break;
    }
    // If it's a unique constraint violation, retry with a new code
    if (error.code === "23505") {
      roomErr = error;
      continue;
    }
    // For any other error, bail immediately
    roomErr = error;
    break;
  }
  if (roomErr || !room)
    return res.status(500).json({ error: roomErr?.message || "Failed to create room" });

  const { data: player, error: playerErr } = await supabaseAdmin
    .from("players")
    .insert({
      room_id: room.id,
      name: normalizedName,
      team: "A",
      seat_index: 0,
      is_host: true,
      client_id: clientId,
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
