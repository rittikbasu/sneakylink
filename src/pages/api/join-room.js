import { validateRoomCode } from "@/lib/id";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/uuid";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const {
    name,
    code,
    player_id: rejoinPlayerId,
    client_id: clientIdRaw,
  } = req.body || {};
  if (!code) return res.status(400).json({ error: "Code is required" });
  const normalizedCode = String(code).toUpperCase();
  if (!validateRoomCode(normalizedCode))
    return res.status(400).json({ error: "Invalid room code" });
  const clientId = String(clientIdRaw || "").trim();
  if (!isUuid(clientId))
    return res.status(400).json({ error: "client_id is required" });
  const normalizeName = (s) =>
    String(s || "")
      .trim()
      .slice(0, 16);

  // Prefer the most recently created room with this code
  // (handles edge case of code collision with an old finished room)
  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, code, status, settings")
    .eq("code", normalizedCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (roomErr || !room)
    return res.status(404).json({ error: "Room not found" });

  // Rejoin path: prefer client_id if available
  const { data: existingByClient, error: existingByClientErr } =
    await supabaseAdmin
      .from("players")
      .select("id")
      .eq("room_id", room.id)
      .eq("client_id", clientId)
      .limit(1);
  if (existingByClientErr)
    return res.status(500).json({ error: existingByClientErr.message });
  if (existingByClient && existingByClient.length) {
    return res.status(200).json({
      code: room.code,
      room_id: room.id,
      player_id: existingByClient[0].id,
    });
  }

  // Legacy rejoin path: if client provides a known player_id, allow entry regardless of room status
  if (rejoinPlayerId) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("players")
      .select("id, client_id")
      .eq("id", rejoinPlayerId)
      .eq("room_id", room.id)
      .limit(1);
    if (existingErr)
      return res.status(500).json({ error: existingErr.message });
    if (existing && existing.length) {
      const row = existing[0];
      if (row.client_id && row.client_id !== clientId) {
        return res.status(409).json({ error: "Player already claimed" });
      }
      if (!row.client_id) {
        await supabaseAdmin
          .from("players")
          .update({ client_id: clientId })
          .eq("id", row.id)
          .eq("room_id", room.id)
          .is("client_id", null);
      }
      return res.status(200).json({
        code: room.code,
        room_id: room.id,
        player_id: row.id,
      });
    }
    return res.status(404).json({ error: "Player not found in this room" });
  }

  if (!name) return res.status(400).json({ error: "Name is required to join" });
  const normalizedName = normalizeName(name);
  if (!normalizedName) return res.status(400).json({ error: "Invalid name" });
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
      name: normalizedName,
      team,
      seat_index,
      is_host: false,
      client_id: clientId,
    })
    .select()
    .single();
  if (playerErr) return res.status(500).json({ error: playerErr.message });

  return res
    .status(200)
    .json({ code: room.code, room_id: room.id, player_id: player.id });
}
