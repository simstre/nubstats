"use client";

import { useEffect, useState, useCallback } from "react";
import { GameMode, PubgPlayerStats, TRACKED_PLAYERS, PLAYER_COLORS } from "@/lib/types";
import { Leaderboard } from "./Leaderboard";
import { PlayerStatsPanel } from "./PlayerStatsPanel";
import { HistoryChart } from "./HistoryChart";
import { MatchHistory } from "./MatchHistory";
import { WeaponStats } from "./WeaponStats";
import { DeathStats } from "./DeathStats";

interface Snapshot {
  player_name: string;
  game_mode: string;
  stats: PubgPlayerStats;
  fetched_at: string;
}

type Tab = "leaderboard" | "players" | "matches" | "weapons" | "deaths" | "history";

function seasonLabel(seasonId: string): string {
  if (seasonId === "lifetime") return "Lifetime";
  const match = seasonId.match(/pc-2018-(\d+)$/);
  if (match) return `Season ${parseInt(match[1])}`;
  const match2 = seasonId.match(/(\d{4})-(\d+)$/);
  if (match2) return `Season ${parseInt(match2[2])}`;
  return seasonId;
}

export function Dashboard() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("lifetime");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameMode] = useState<GameMode>("squad");
  const [selectedPlayer, setSelectedPlayer] = useState(TRACKED_PLAYERS[0]);
  const [tab, setTab] = useState<Tab>("leaderboard");

  const loadStats = useCallback(async (season?: string) => {
    try {
      const seasonParam = season || selectedSeason;
      const url = seasonParam && seasonParam !== "lifetime"
        ? `/api/stats?season=${seasonParam}`
        : "/api/stats";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSnapshots(data.snapshots || []);
      setSeasons(data.seasons || []);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedSeason]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSeasonChange = async (season: string) => {
    setSelectedSeason(season);
    setLoading(true);
    await loadStats(season);
  };

  const lastFetch = snapshots.length > 0
    ? new Date(
        Math.max(...snapshots.map((s) => new Date(s.fetched_at).getTime()))
      )
    : null;

  const sortedSeasons = seasons
    .filter((s) => s !== "lifetime" && s.includes("pc-"))
    .sort()
    .reverse();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-yellow-400">PUBG</span> NUB Tracker
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Squad TPP &bull;{" "}
                {TRACKED_PLAYERS.map((name, i) => (
                  <span key={name}>
                    <span style={{ color: PLAYER_COLORS[name] }}>{name}</span>
                    {i < TRACKED_PLAYERS.length - 1 && " \u00B7 "}
                  </span>
                ))}
                {lastFetch && ` | Updated ${lastFetch.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1 w-fit flex-wrap">
          {(
            [
              { key: "leaderboard", label: "Leaderboard" },
              { key: "players", label: "Player Stats" },
              { key: "matches", label: "Recent Matches" },
              { key: "weapons", label: "Weapons" },
              { key: "deaths", label: "Deaths" },
              { key: "history", label: "History" },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === t.key
                  ? "bg-yellow-500 text-black"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Season selector (dropdown) */}
        {tab !== "history" && tab !== "matches" && tab !== "weapons" && tab !== "deaths" && sortedSeasons.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Season:</span>
            <select
              value={selectedSeason}
              onChange={(e) => handleSeasonChange(e.target.value)}
              className="bg-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 cursor-pointer"
            >
              <option value="lifetime">Lifetime</option>
              {sortedSeasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(s)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Player selector (for player tab) */}
        {tab === "players" && (
          <div className="flex gap-2 flex-wrap">
            {TRACKED_PLAYERS.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedPlayer(name)}
                className={`px-4 py-2 rounded-md text-sm transition font-semibold ${
                  selectedPlayer === name
                    ? "ring-1 bg-zinc-700"
                    : "bg-zinc-800 hover:bg-zinc-700"
                }`}
                style={{
                  color: PLAYER_COLORS[name],
                  borderColor: selectedPlayer === name ? PLAYER_COLORS[name] : undefined,
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-zinc-500 text-lg animate-pulse">Loading stats...</div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">Failed to load stats</p>
            <p className="text-zinc-500 text-sm mb-4">{error}</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{"\u{1F3AF}"}</div>
            <h2 className="text-xl font-bold mb-2">No Stats Yet</h2>
            <p className="text-zinc-500 mb-6">
              Stats are fetched daily at 11:00 UTC via cron.
            </p>
          </div>
        ) : (
          <>
            {tab === "leaderboard" && (
              <Leaderboard snapshots={snapshots} gameMode={gameMode} seasonTitle={seasonLabel(selectedSeason)} />
            )}
            {tab === "players" && (
              <PlayerStatsPanel
                playerName={selectedPlayer}
                snapshots={snapshots}
                gameMode={gameMode}
                seasonTitle={seasonLabel(selectedSeason)}
              />
            )}
            {tab === "matches" && <MatchHistory />}
            {tab === "weapons" && <WeaponStats />}
            {tab === "deaths" && <DeathStats />}
            {tab === "history" && <HistoryChart gameMode={gameMode} />}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600 mt-8">
        PUBG NUB Tracker &mdash; Stats auto-fetched daily at 11:00 UTC via Vercel Cron
      </footer>
    </div>
  );
}
