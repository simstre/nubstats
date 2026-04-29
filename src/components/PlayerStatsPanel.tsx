"use client";

import { useEffect, useState } from "react";
import { computeStats, GameMode, GAME_MODE_LABELS, PLAYER_COLORS, PubgPlayerStats } from "@/lib/types";
import { StatCard } from "./StatCard";
import type { PlayerFF } from "./Dashboard";

const MAP_DISPLAY_NAMES: Record<string, string> = {
  Baltic_Main: "Erangel",
  Erangel_Main: "Erangel",
  Desert_Main: "Miramar",
  Savage_Main: "Sanhok",
  DihorOtok_Main: "Vikendi",
  Range_Main: "Camp Jackal",
  Summerland_Main: "Karakin",
  Tiger_Main: "Taego",
  Kiki_Main: "Deston",
  Heaven_Main: "Haven",
  Chimera_Main: "Paramo",
  Neon_Main: "Rondo",
};

interface MapStatsRow {
  map_name: string;
  games: number;
  total_kills: number;
  avg_kills: number;
  total_damage: number;
  avg_damage: number;
  wins: number;
  best_kills: number;
  best_damage: number;
  best_place: number;
}

interface Snapshot {
  player_name: string;
  game_mode: string;
  stats: PubgPlayerStats;
}

interface PlayerStatsPanelProps {
  playerName: string;
  snapshots: Snapshot[];
  gameMode: GameMode;
  seasonTitle: string;
  ff?: PlayerFF;
}

export function PlayerStatsPanel({
  playerName,
  snapshots,
  gameMode,
  seasonTitle,
  ff,
}: PlayerStatsPanelProps) {
  const [mapStats, setMapStats] = useState<MapStatsRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMapStats(null);
    fetch(`/api/map-stats?player=${encodeURIComponent(playerName)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.error) setMapStats(json.maps as MapStatsRow[]);
      })
      .catch(() => { /* panel just won't render */ });
    return () => { cancelled = true; };
  }, [playerName]);

  const snap = snapshots.find(
    (s) => s.player_name === playerName && s.game_mode === gameMode
  );

  if (!snap || snap.stats.roundsPlayed === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No {GAME_MODE_LABELS[gameMode]} data for {playerName}
      </div>
    );
  }

  const s = computeStats(snap.stats);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">
        <span style={{ color: PLAYER_COLORS[playerName] }}>{playerName}</span>
        <span className="text-zinc-500"> &mdash; {GAME_MODE_LABELS[gameMode]} &mdash; {seasonTitle}</span>
      </h3>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.03] p-4">
      <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">Performance</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="K/D Ratio" value={s.kd} highlight />
        <StatCard label="Win Rate" value={`${s.winRate}%`} highlight />
        <StatCard label="Avg Damage / Game" value={s.avgDamage} highlight />
        <StatCard label="Headshot %" value={`${s.headshotRate}%`} highlight />
        <StatCard label="Kills / Game" value={s.killsPerGame} highlight />
        <StatCard label="Top 10 Rate" value={`${s.top10Rate}%`} highlight />
        <StatCard label="Assists / Game" value={s.assistsPerGame} highlight />
        <StatCard label="Knocks / Game" value={s.dbnosPerGame} highlight />
        <StatCard label="Revives / Game" value={s.revivesPerGame} highlight />
        <StatCard label="Heals / Game" value={s.healsPerGame} highlight />
        <StatCard label="Boosts / Game" value={s.boostsPerGame} highlight />
        <StatCard
          label="Avg Survival"
          value={`${Math.floor(s.avgTimeSurvived / 60)}m ${Math.round(s.avgTimeSurvived % 60)}s`}
          highlight
        />
        <StatCard label="Longest Kill" value={`${s.longestKill.toFixed(0)}m`} highlight />
        <StatCard label="Max Kill Streak" value={s.maxKillStreaks} highlight />
        <StatCard label="Best Game Kills" value={s.roundMostKills} highlight />
      </div>
      </div>

      <MapPerformance maps={mapStats} />

      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/20 p-4">
      <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Totals</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Kills" value={s.kills.toLocaleString()} />
        <StatCard label="Wins" value={s.wins.toLocaleString()} />
        <StatCard label="Losses" value={s.losses.toLocaleString()} />
        <StatCard label="Top 10s" value={s.top10s.toLocaleString()} />
        <StatCard label="Games Played" value={s.roundsPlayed.toLocaleString()} />
        <StatCard label="Assists" value={s.assists.toLocaleString()} />
        <StatCard label="Headshot Kills" value={s.headshotKills.toLocaleString()} />
        <StatCard label="DBNOs" value={s.dBNOs.toLocaleString()} />
        <StatCard label="Revives" value={s.revives.toLocaleString()} />
        <StatCard
          label="Total Damage"
          value={s.damageDealt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        />
        <StatCard
          label="Longest Survived"
          value={`${Math.floor(s.longestTimeSurvived / 60)}m`}
        />
        <StatCard label="Hours Played" value={`${s.totalHoursPlayed.toLocaleString()}h`} />
        <StatCard label="Boosts Used" value={s.boosts.toLocaleString()} />
        <StatCard label="Heals Used" value={s.heals.toLocaleString()} />
        <StatCard label="Walk Distance" value={`${(s.walkDistance / 1000).toFixed(1)}km`} />
        <StatCard label="Ride Distance" value={`${(s.rideDistance / 1000).toFixed(1)}km`} />
        <StatCard label="Swim Distance" value={`${(s.swimDistance / 1000).toFixed(1)}km`} />
        <StatCard label="Total Distance" value={`${(s.totalDistance / 1000).toFixed(1)}km`} />
        <StatCard label="Vehicles Destroyed" value={s.vehicleDestroys} />
        <StatCard label="Road Kills" value={s.roadKills} />
        <StatCard label="Weapons Acquired" value={s.weaponsAcquired.toLocaleString()} />
        <StatCard label="Team Kills" value={s.teamKills} />
        <StatCard label="Suicides" value={s.suicides} />
      </div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
        <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-1">Friendly Fire Dealt</h4>
        <p className="text-xs text-zinc-500 mb-3">All-time, from match telemetry. Kills shown above as &ldquo;Team Kills&rdquo; (season-filtered).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Damage Dealt" value={(ff?.dealt.damage ?? 0).toFixed(0)} />
          <StatCard label="Knocked Teammate" value={(ff?.dealt.knocks ?? 0).toLocaleString()} />
        </div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
        <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-1">Friendly Fire Taken</h4>
        <p className="text-xs text-zinc-500 mb-3">All-time, from match telemetry. Not season-filtered.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Damage Taken" value={(ff?.taken.damage ?? 0).toFixed(0)} />
          <StatCard label="Knocked by Teammate" value={(ff?.taken.knocks ?? 0).toLocaleString()} />
          <StatCard label="Killed by Teammate" value={(ff?.taken.kills ?? 0).toLocaleString()} />
        </div>
      </div>
    </div>
  );
}

function MapPerformance({ maps }: { maps: MapStatsRow[] | null }) {
  if (maps === null) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
        <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-1">Map Performance</h4>
        <p className="text-xs text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
        <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-1">Map Performance</h4>
        <p className="text-xs text-zinc-500">No per-map data yet. Stats are built from processed matches only.</p>
      </div>
    );
  }

  const sorted = [...maps].sort((a, b) => b.games - a.games);
  const bestAvgDmg = Math.max(...maps.map((m) => m.avg_damage));
  const bestAvgKills = Math.max(...maps.map((m) => m.avg_kills));
  const bestWinRate = Math.max(...maps.map((m) => m.wins / m.games));

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-1">Map Performance</h4>
      <p className="text-xs text-zinc-500 mb-3">Per-map averages from stored matches. Green highlights the best map for each metric.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-700/50">
              <th className="text-left py-2 pr-3 font-medium">Map</th>
              <th className="text-right py-2 px-3 font-medium">Games</th>
              <th className="text-right py-2 px-3 font-medium">Avg Damage</th>
              <th className="text-right py-2 px-3 font-medium">Avg Kills</th>
              <th className="text-right py-2 px-3 font-medium">Win Rate</th>
              <th className="text-right py-2 px-3 font-medium">Wins</th>
              <th className="text-right py-2 pl-3 font-medium">Best Place</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const winRate = (m.wins / m.games) * 100;
              const isBestDmg = m.avg_damage === bestAvgDmg;
              const isBestKills = m.avg_kills === bestAvgKills;
              const isBestWR = m.wins / m.games === bestWinRate && m.wins > 0;
              const display = MAP_DISPLAY_NAMES[m.map_name] || m.map_name;
              return (
                <tr key={m.map_name} className="border-b border-zinc-800/50 last:border-0">
                  <td className="py-2 pr-3 font-medium">{display}</td>
                  <td className="text-right py-2 px-3 text-zinc-300">{m.games}</td>
                  <td className={`text-right py-2 px-3 ${isBestDmg ? "text-emerald-400 font-semibold" : "text-zinc-300"}`}>
                    {m.avg_damage.toFixed(0)}
                  </td>
                  <td className={`text-right py-2 px-3 ${isBestKills ? "text-emerald-400 font-semibold" : "text-zinc-300"}`}>
                    {m.avg_kills.toFixed(2)}
                  </td>
                  <td className={`text-right py-2 px-3 ${isBestWR ? "text-emerald-400 font-semibold" : "text-zinc-300"}`}>
                    {winRate.toFixed(1)}%
                  </td>
                  <td className="text-right py-2 px-3 text-zinc-300">{m.wins}</td>
                  <td className="text-right py-2 pl-3 text-zinc-300">#{m.best_place}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
