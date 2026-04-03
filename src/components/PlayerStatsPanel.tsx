"use client";

import { computeStats, GameMode, GAME_MODE_LABELS, PLAYER_COLORS, PubgPlayerStats } from "@/lib/types";
import { StatCard } from "./StatCard";

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
}

export function PlayerStatsPanel({
  playerName,
  snapshots,
  gameMode,
  seasonTitle,
}: PlayerStatsPanelProps) {
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
    </div>
  );
}
