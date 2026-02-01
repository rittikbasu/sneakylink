import { countMaxSequences } from "@/lib/sequences";

export const groupPlayersByTeam = (players) => ({
  A: [...players]
    .filter((p) => p.team === "A")
    .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
  B: [...players]
    .filter((p) => p.team === "B")
    .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
  C: [...players]
    .filter((p) => p.team === "C")
    .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)),
});

export const buildPlayersByTurn = (groupedPlayers) => {
  const teamOrder = ["A", "B", "C"].filter(
    (t) => groupedPlayers[t].length > 0
  );
  const maxLen = Math.max(...teamOrder.map((t) => groupedPlayers[t].length));
  const playersByTurn = [];
  for (let i = 0; i < maxLen; i++) {
    for (const t of teamOrder) {
      if (groupedPlayers[t][i]) playersByTurn.push(groupedPlayers[t][i]);
    }
  }
  return playersByTurn;
};

export const getTurnPlayer = (playersByTurn, game) => {
  if (!playersByTurn.length || !game) return null;
  return playersByTurn[game.turn_index % playersByTurn.length];
};

export const buildSidebarTeams = ({
  game,
  players,
  playerId,
  hostId,
  teamsSetting,
}) => {
  if (!game) return null;
  const buildTeam = (team) =>
    players
      .filter((p) => p.team === team)
      .map((p) => ({
        id: p.id,
        name: p.name,
        isYou: p.id === playerId,
        isHost: p.id === hostId,
      }));
  const teams = {
    A: buildTeam("A"),
    B: buildTeam("B"),
    C: [],
  };
  if (teamsSetting === 3) {
    teams.C = buildTeam("C");
  }
  return teams;
};

export const buildSidebarScores = ({ game, chips, teamsSetting }) => {
  if (!game) return null;
  const occ = new Map();
  for (const [i, t] of chips.entries()) {
    occ.set(i, { team: t });
  }
  const scores = {
    A: countMaxSequences(occ, "A"),
    B: countMaxSequences(occ, "B"),
  };
  if (teamsSetting === 3) {
    scores.C = countMaxSequences(occ, "C");
  }
  return scores;
};
