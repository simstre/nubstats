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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="K/D Ratio" value={s.kd} highlight />
        <StatCard label="Win Rate" value={`${s.winRate}%`} highlight />
        <StatCard label="Avg Damage / Game" value={s.avgDamage} highlight />
        <StatCard label="Headshot %" value={`${s.headshotRate}%`} highlight />
        <StatCard label="Kills / Game" value={s.killsPerGame} highlight />
        <StatCard label="Top 10 Rate" value={`${s.top10Rate}%`} highlight />

        <StatCard label="Kills" value={s.kills.toLocaleString()} />
        <StatCard label="Losses" value={s.losses.toLocaleString()} />
        <StatCard label="Wins" value={s.wins.toLocaleString()} />
        <StatCard label="Top 10s" value={s.top10s.toLocaleString()} />
        <StatCard label="Games Played" value={s.roundsPlayed.toLocaleString()} />
        <StatCard label="Assists" value={s.assists.toLocaleString()} />
        <StatCard label="Assists / Game" value={s.assistsPerGame} />
        <StatCard label="Knocks / Game" value={s.dbnosPerGame} />
        <StatCard label="Revives / Game" value={s.revivesPerGame} />
        <StatCard label="Heals / Game" value={s.healsPerGame} />
        <StatCard label="Boosts / Game" value={s.boostsPerGame} />
        <StatCard label="Headshot Kills" value={s.headshotKills.toLocaleString()} />
        <StatCard label="DBNOs" value={s.dBNOs.toLocaleString()} />
        <StatCard label="Revives" value={s.revives.toLocaleString()} />
        <StatCard label="Longest Kill" value={`${s.longestKill.toFixed(0)}m`} />
        <StatCard
          label="Total Damage"
          value={s.damageDealt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        />
        <StatCard
          label="Avg Survival"
          value={`${Math.floor(s.avgTimeSurvived / 60)}m ${Math.round(s.avgTimeSurvived % 60)}s`}
        />
        <StatCard label="Max Kill Streak" value={s.maxKillStreaks} />
        <StatCard label="Best Game Kills" value={s.roundMostKills} />
        <StatCard
          label="Longest Survived"
          value={`${Math.floor(s.longestTimeSurvived / 60)}m`}
        />
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
  );
}
