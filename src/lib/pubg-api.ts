import { PubgPlayerStats, GameMode, GAME_MODES } from "./types";

const API_BASE = "https://api.pubg.com";
const API_KEY = process.env.PUBG_API_KEY!;
const PLATFORM = process.env.PUBG_PLATFORM || "steam";

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    Accept: "application/vnd.api+json",
  };
}

export async function getPlayerByName(
  name: string
): Promise<{ id: string; name: string; clanId?: string } | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/players?filter[playerNames]=${name}`,
    { headers: headers() }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Failed to fetch player ${name}: ${res.status} ${body}`);
    return null;
  }
  const data = await res.json();
  if (!data.data || data.data.length === 0) return null;
  return {
    id: data.data[0].id,
    name: data.data[0].attributes.name,
    clanId: data.data[0].attributes.clanId || undefined,
  };
}

export interface ClanInfo {
  id: string;
  clanName: string;
  clanTag: string;
  clanLevel: number;
  clanMemberCount: number;
}

export async function getClanInfo(clanId: string): Promise<ClanInfo | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/clans/${clanId}`,
    { headers: headers() }
  );
  if (!res.ok) {
    console.error(`Failed to fetch clan ${clanId}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  return {
    id: data.data.id,
    ...data.data.attributes,
  };
}

export async function getPlayerWithMatches(
  name: string
): Promise<{ id: string; name: string; matchIds: string[] } | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/players?filter[playerNames]=${name}`,
    { headers: headers() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.data || data.data.length === 0) return null;
  const p = data.data[0];
  const matchIds = (p.relationships?.matches?.data || []).map(
    (m: { id: string }) => m.id
  );
  return { id: p.id, name: p.attributes.name, matchIds };
}

export interface MatchData {
  id: string;
  mapName: string;
  gameMode: string;
  duration: number;
  createdAt: string;
  participants: MatchParticipant[];
}

export interface MatchParticipant {
  name: string;
  playerId: string;
  kills: number;
  damageDealt: number;
  assists: number;
  dBNOs: number;
  headshotKills: number;
  longestKill: number;
  revives: number;
  boosts: number;
  heals: number;
  timeSurvived: number;
  walkDistance: number;
  rideDistance: number;
  swimDistance: number;
  winPlace: number;
  killPlace: number;
  teamId: number;
}

export async function getMatch(matchId: string): Promise<MatchData | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/matches/${matchId}`,
    { headers: headers() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const attrs = data.data.attributes;

  const participants: MatchParticipant[] = [];
  for (const inc of data.included || []) {
    if (inc.type === "participant") {
      const s = inc.attributes.stats;
      participants.push({
        name: s.name,
        playerId: s.playerId,
        kills: s.kills,
        damageDealt: s.damageDealt,
        assists: s.assists,
        dBNOs: s.DBNOs,
        headshotKills: s.headshotKills,
        longestKill: s.longestKill,
        revives: s.revives,
        boosts: s.boosts,
        heals: s.heals,
        timeSurvived: s.timeSurvived,
        walkDistance: s.walkDistance,
        rideDistance: s.rideDistance,
        swimDistance: s.swimDistance,
        winPlace: s.winPlace,
        killPlace: s.killPlace,
        teamId: s.teamId || 0,
      });
    }
  }

  return {
    id: data.data.id,
    mapName: attrs.mapName,
    gameMode: attrs.gameMode,
    duration: attrs.duration,
    createdAt: attrs.createdAt,
    participants,
  };
}

export async function getCurrentSeason(): Promise<string | null> {
  const seasons = await getAllSeasons();
  const current = seasons.find((s) => s.isCurrent);
  return current?.id || null;
}

export async function getAllSeasons(): Promise<{ id: string; isCurrent: boolean }[]> {
  const res = await fetch(`${API_BASE}/shards/${PLATFORM}/seasons`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data
    .filter((s: { id: string }) => s.id.includes("pc-"))
    .map((s: { id: string; attributes: { isCurrentSeason: boolean } }) => ({
      id: s.id,
      isCurrent: s.attributes.isCurrentSeason,
    }));
}

export async function getLifetimeStats(
  playerId: string
): Promise<Record<GameMode, PubgPlayerStats> | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/players/${playerId}/seasons/lifetime`,
    { headers: headers() }
  );
  if (!res.ok) {
    console.error(`Failed to fetch lifetime stats: ${res.status}`);
    return null;
  }
  const data = await res.json();
  const gameModeStats = data.data.attributes.gameModeStats;
  const result: Partial<Record<GameMode, PubgPlayerStats>> = {};
  for (const mode of GAME_MODES) {
    if (gameModeStats[mode]) {
      result[mode] = gameModeStats[mode] as PubgPlayerStats;
    }
  }
  return result as Record<GameMode, PubgPlayerStats>;
}

export async function getSeasonStats(
  playerId: string,
  seasonId: string
): Promise<Record<GameMode, PubgPlayerStats> | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/players/${playerId}/seasons/${seasonId}`,
    { headers: headers() }
  );
  if (!res.ok) {
    console.error(`Failed to fetch season stats: ${res.status}`);
    return null;
  }
  const data = await res.json();
  const gameModeStats = data.data.attributes.gameModeStats;
  const result: Partial<Record<GameMode, PubgPlayerStats>> = {};
  for (const mode of GAME_MODES) {
    if (gameModeStats[mode]) {
      result[mode] = gameModeStats[mode] as PubgPlayerStats;
    }
  }
  return result as Record<GameMode, PubgPlayerStats>;
}

export async function getRankedStats(
  playerId: string,
  seasonId: string
): Promise<Record<string, PubgPlayerStats> | null> {
  const res = await fetch(
    `${API_BASE}/shards/${PLATFORM}/players/${playerId}/seasons/${seasonId}/ranked`,
    { headers: headers() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data.attributes.rankedGameModeStats || null;
}
