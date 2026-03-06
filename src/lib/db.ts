import { Pool, QueryResultRow } from "pg";
import { GameMode, PubgPlayerStats } from "./types";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: (string | number)[]
) {
  const result = await pool.query<T>(text, params);
  return result;
}

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      pubg_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stat_snapshots (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(255) NOT NULL,
      pubg_id VARCHAR(255) NOT NULL,
      fetched_at TIMESTAMP DEFAULT NOW(),
      season_id VARCHAR(255) NOT NULL,
      game_mode VARCHAR(50) NOT NULL,
      stats JSONB NOT NULL,
      UNIQUE(player_name, season_id, game_mode, fetched_at)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_player
    ON stat_snapshots(player_name)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_fetched
    ON stat_snapshots(fetched_at)
  `);
}

export async function upsertPlayer(name: string, pubgId: string) {
  await query(
    `INSERT INTO players (name, pubg_id)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET pubg_id = $2`,
    [name, pubgId]
  );
}

export async function insertSnapshot(
  playerName: string,
  pubgId: string,
  seasonId: string,
  gameMode: GameMode,
  stats: PubgPlayerStats
) {
  await query(
    `INSERT INTO stat_snapshots (player_name, pubg_id, season_id, game_mode, stats)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerName, pubgId, seasonId, gameMode, JSON.stringify(stats)]
  );
}

export async function getLatestSnapshots(playerName: string) {
  const result = await query(
    `SELECT DISTINCT ON (game_mode) *
     FROM stat_snapshots
     WHERE player_name = $1
     ORDER BY game_mode, fetched_at DESC`,
    [playerName]
  );
  return result.rows;
}

export async function getPlayerHistory(
  playerName: string,
  gameMode: GameMode
) {
  const result = await query(
    `SELECT DISTINCT ON (season_id) *
     FROM stat_snapshots
     WHERE player_name = $1 AND game_mode = $2 AND season_id != 'lifetime'
     ORDER BY season_id ASC, fetched_at DESC`,
    [playerName, gameMode]
  );
  return result.rows;
}

export async function getAllLatestSnapshots() {
  const result = await query(
    `SELECT DISTINCT ON (player_name, game_mode) *
     FROM stat_snapshots
     WHERE season_id = 'lifetime'
     ORDER BY player_name, game_mode, fetched_at DESC`
  );
  return result.rows;
}

export async function getPlayers() {
  const result = await query(`SELECT * FROM players ORDER BY name`);
  return result.rows;
}

export async function getSeasonsList() {
  const result = await query(
    `SELECT DISTINCT season_id FROM stat_snapshots ORDER BY season_id ASC`
  );
  return result.rows.map((r) => r.season_id as string);
}

export async function initWeaponTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS weapon_stats (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(255) NOT NULL,
      weapon VARCHAR(255) NOT NULL,
      kills INTEGER DEFAULT 0,
      knocks INTEGER DEFAULT 0,
      damage REAL DEFAULT 0,
      headshots INTEGER DEFAULT 0,
      hits INTEGER DEFAULT 0,
      matches_used INTEGER DEFAULT 0,
      total_kill_distance REAL DEFAULT 0,
      longest_kill_distance REAL DEFAULT 0,
      UNIQUE(player_name, weapon)
    )
  `);

  // Add columns if table already exists (migration)
  await query(`ALTER TABLE weapon_stats ADD COLUMN IF NOT EXISTS total_kill_distance REAL DEFAULT 0`);
  await query(`ALTER TABLE weapon_stats ADD COLUMN IF NOT EXISTS longest_kill_distance REAL DEFAULT 0`);

  await query(`
    CREATE TABLE IF NOT EXISTS processed_matches (
      match_id VARCHAR(255) PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS death_stats (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(255) NOT NULL,
      cause VARCHAR(255) NOT NULL,
      deaths INTEGER DEFAULT 0,
      UNIQUE(player_name, cause)
    )
  `);
}

export async function isMatchProcessed(matchId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM processed_matches WHERE match_id = $1`,
    [matchId]
  );
  return result.rows.length > 0;
}

export async function markMatchProcessed(matchId: string) {
  await query(
    `INSERT INTO processed_matches (match_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [matchId]
  );
}

export async function upsertWeaponStat(
  playerName: string,
  weapon: string,
  kills: number,
  knocks: number,
  damage: number,
  headshots: number,
  hits: number,
  matchesUsed: number,
  totalKillDistance: number,
  longestKillDistance: number
) {
  await query(
    `INSERT INTO weapon_stats (player_name, weapon, kills, knocks, damage, headshots, hits, matches_used, total_kill_distance, longest_kill_distance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (player_name, weapon)
     DO UPDATE SET
       kills = weapon_stats.kills + $3,
       knocks = weapon_stats.knocks + $4,
       damage = weapon_stats.damage + $5,
       headshots = weapon_stats.headshots + $6,
       hits = weapon_stats.hits + $7,
       matches_used = weapon_stats.matches_used + $8,
       total_kill_distance = weapon_stats.total_kill_distance + $9,
       longest_kill_distance = GREATEST(weapon_stats.longest_kill_distance, $10)`,
    [playerName, weapon, kills, knocks, damage, headshots, hits, matchesUsed, totalKillDistance, longestKillDistance]
  );
}

export async function getWeaponStats(playerName?: string) {
  if (playerName) {
    const result = await query(
      `SELECT * FROM weapon_stats WHERE player_name = $1 ORDER BY damage DESC`,
      [playerName]
    );
    return result.rows;
  }
  const result = await query(
    `SELECT weapon,
       SUM(kills)::int as kills,
       SUM(knocks)::int as knocks,
       SUM(damage)::real as damage,
       SUM(headshots)::int as headshots,
       SUM(hits)::int as hits,
       SUM(matches_used)::int as matches_used
     FROM weapon_stats
     GROUP BY weapon
     ORDER BY damage DESC`
  );
  return result.rows;
}

export async function getAllWeaponStats() {
  const result = await query(
    `SELECT * FROM weapon_stats ORDER BY player_name, damage DESC`
  );
  return result.rows;
}

export async function upsertDeathStat(
  playerName: string,
  cause: string,
  deaths: number
) {
  await query(
    `INSERT INTO death_stats (player_name, cause, deaths)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_name, cause)
     DO UPDATE SET deaths = death_stats.deaths + $3`,
    [playerName, cause, deaths]
  );
}

export async function getAllDeathStats() {
  const result = await query(
    `SELECT * FROM death_stats ORDER BY player_name, deaths DESC`
  );
  return result.rows;
}

export async function getExistingBackfillSeasons(): Promise<Set<string>> {
  const result = await query(
    `SELECT DISTINCT player_name, season_id FROM stat_snapshots WHERE season_id != 'lifetime'`
  );
  const set = new Set<string>();
  for (const row of result.rows) {
    set.add(`${row.player_name}::${row.season_id}`);
  }
  return set;
}

export async function getSnapshotsBySeason(seasonId: string) {
  const result = await query(
    `SELECT DISTINCT ON (player_name, game_mode) *
     FROM stat_snapshots
     WHERE season_id = $1
     ORDER BY player_name, game_mode, fetched_at DESC`,
    [seasonId]
  );
  return result.rows;
}
