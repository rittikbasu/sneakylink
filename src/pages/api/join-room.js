import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { name, code, player_id: rejoinPlayerId } = req.body || {};
  if (!code) return res.status(400).json({ error: "Code is required" });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, code, status, settings")
    .eq("code", code)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });

  // Rejoin path: if client provides a known player_id, allow entry regardless of room status
  if (rejoinPlayerId) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("id", rejoinPlayerId)
      .eq("room_id", room.id)
      .single();
    if (existingErr || !existing)
      return res.status(404).json({ error: "Player not found in this room" });
    return res
      .status(200)
      .json({ code: room.code, room_id: room.id, player_id: rejoinPlayerId });
  }

  if (!name) return res.status(400).json({ error: "Name is required to join" });
  if (room.status !== "lobby")
    return res.status(400).json({ error: "Game already started" });

  const { data: players } = await supabaseAdmin
    .from("players")
    .select("id, team")
    .eq("room_id", room.id);

  const numTeams = room.settings?.teams ?? 2;
  const teamCounts = { A: 0, B: 0, C: 0 };
  for (const p of players || [])
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;

  // Assign to team with fewest players
  let team = "A";
  if (numTeams === 2) {
    team = teamCounts.A <= teamCounts.B ? "A" : "B";
  } else if (numTeams === 3) {
    const min = Math.min(teamCounts.A, teamCounts.B, teamCounts.C);
    if (teamCounts.A === min) team = "A";
    else if (teamCounts.B === min) team = "B";
    else team = "C";
  }
  const seat_index = players?.length || 0;

  const { data: player, error: playerErr } = await supabaseAdmin
    .from("players")
    .insert({
      room_id: room.id,
      name: name.trim(),
      team,
      seat_index,
      is_host: false,
    })
    .select()
    .single();
  if (playerErr) return res.status(500).json({ error: playerErr.message });

  return res
    .status(200)
    .json({ code: room.code, room_id: room.id, player_id: player.id });
}
