export interface PubgPlayerStats {
  wins: number;
  losses: number;
  kills: number;
  roundMostKills: number;
  assists: number;
  headshotKills: number;
  damageDealt: number;
  longestKill: number;
  timeSurvived: number;
  roundsPlayed: number;
  top10s: number;
  dBNOs: number;
  revives: number;
  boosts: number;
  heals: number;
  vehicleDestroys: number;
  roadKills: number;
  dailyKills: number;
  weeklyKills: number;
  bestRankPoint: number;
  rankPoints: number;
  rankPointsTitle: string;
  swimDistance: number;
  walkDistance: number;
  rideDistance: number;
  weaponsAcquired: number;
  suicides: number;
  teamKills: number;
  maxKillStreaks: number;
  longestTimeSurvived: number;
  mostSurvivalTime: number;
  days: number;
  dailyWins: number;
  weeklyWins: number;
}

export type GameMode = "squad";

export const GAME_MODES: GameMode[] = ["squad"];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  squad: "Squad TPP",
};

export interface PlayerSnapshot {
  id: number;
  player_name: string;
  pubg_id: string;
  fetched_at: string;
  game_mode: GameMode;
  stats: PubgPlayerStats;
}

export interface Player {
  name: string;
  pubgId: string;
}

export const TRACKED_PLAYERS = ["Silvertibby", "alhole", "RetroGames84", "Musaz", "EmitMaj", "xxXDRAMAXxx"];

export const PLAYER_COLORS: Record<string, string> = {
  Silvertibby: "#facc15",  // yellow
  alhole: "#38bdf8",       // sky blue
  RetroGames84: "#f87171", // red
  Musaz: "#4ade80",        // green
  EmitMaj: "#c084fc",      // purple
  xxXDRAMAXxx: "#fb923c",  // orange
};

export interface ComputedStats extends PubgPlayerStats {
  kd: number;
  winRate: number;
  avgDamage: number;
  headshotRate: number;
  avgTimeSurvived: number;
  totalDistance: number;
  killsPerGame: number;
  assistsPerGame: number;
  dbnosPerGame: number;
  revivesPerGame: number;
  healsPerGame: number;
  boostsPerGame: number;
  top10Rate: number;
}

export function computeStats(raw: PubgPlayerStats): ComputedStats {
  const roundsPlayed = raw.roundsPlayed || 1;
  return {
    ...raw,
    kd: raw.losses === 0 ? raw.kills : parseFloat((raw.kills / raw.losses).toFixed(2)),
    winRate: parseFloat(((raw.wins / roundsPlayed) * 100).toFixed(1)),
    avgDamage: parseFloat((raw.damageDealt / roundsPlayed).toFixed(1)),
    headshotRate:
      raw.kills === 0
        ? 0
        : parseFloat(((raw.headshotKills / raw.kills) * 100).toFixed(1)),
    avgTimeSurvived: parseFloat((raw.timeSurvived / roundsPlayed).toFixed(0)),
    totalDistance: parseFloat(
      (raw.walkDistance + raw.rideDistance + raw.swimDistance).toFixed(0)
    ),
    killsPerGame: parseFloat((raw.kills / roundsPlayed).toFixed(2)),
    assistsPerGame: parseFloat((raw.assists / roundsPlayed).toFixed(2)),
    dbnosPerGame: parseFloat((raw.dBNOs / roundsPlayed).toFixed(2)),
    revivesPerGame: parseFloat((raw.revives / roundsPlayed).toFixed(2)),
    healsPerGame: parseFloat((raw.heals / roundsPlayed).toFixed(1)),
    boostsPerGame: parseFloat((raw.boosts / roundsPlayed).toFixed(1)),
    top10Rate: parseFloat(((raw.top10s / roundsPlayed) * 100).toFixed(1)),
  };
}
