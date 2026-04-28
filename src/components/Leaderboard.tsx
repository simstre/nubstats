"use client";

import { ComputedStats, computeStats, GameMode, GAME_MODE_LABELS, PLAYER_COLORS, PubgPlayerStats } from "@/lib/types";
import type { PlayerFF } from "./Dashboard";

interface Snapshot {
  player_name: string;
  game_mode: string;
  stats: PubgPlayerStats;
}

interface LeaderboardProps {
  snapshots: Snapshot[];
  gameMode: GameMode;
  seasonTitle: string;
  ffByPlayer?: Record<string, PlayerFF>;
  ffStartDate?: string | null;
}

type StatKey = keyof ComputedStats;

type StatDef = { key: StatKey; label: string; format: (v: number) => string };

const PERFORMANCE_STATS: StatDef[] = [
  { key: "kd", label: "K/D Ratio", format: (v) => v.toFixed(2) },
  { key: "winRate", label: "Win Rate", format: (v) => `${v}%` },
  { key: "avgDamage", label: "Avg Damage / Game", format: (v) => v.toFixed(0) },
  { key: "killsPerGame", label: "Kills / Game", format: (v) => v.toFixed(2) },
  { key: "headshotRate", label: "Headshot Rate", format: (v) => `${v}%` },
  { key: "top10Rate", label: "Top 10 Rate", format: (v) => `${v}%` },
  { key: "assistsPerGame", label: "Assists / Game", format: (v) => v.toFixed(2) },
  { key: "dbnosPerGame", label: "Knocks / Game", format: (v) => v.toFixed(2) },
  { key: "revivesPerGame", label: "Revives / Game", format: (v) => v.toFixed(2) },
  { key: "longestKill", label: "Longest Kill", format: (v) => `${v.toFixed(0)}m` },
  { key: "maxKillStreaks", label: "Best Kill Streak", format: (v) => v.toLocaleString() },
];

const TOTALS_STATS: StatDef[] = [
  { key: "kills", label: "Total Kills", format: (v) => v.toLocaleString() },
  { key: "wins", label: "Chicken Dinners", format: (v) => v.toLocaleString() },
  { key: "top10s", label: "Top 10 Finishes", format: (v) => v.toLocaleString() },
  { key: "roundsPlayed", label: "Games Played", format: (v) => v.toLocaleString() },
  { key: "damageDealt", label: "Total Damage", format: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
  { key: "totalHoursPlayed", label: "Hours Played", format: (v) => `${v.toLocaleString()}h` },
  { key: "totalDistance", label: "Total Distance", format: (v) => `${(v / 1000).toFixed(1)}km` },
  { key: "teamKills", label: "Team Kills", format: (v) => v.toLocaleString() },
];

function getMedal(index: number) {
  if (index === 0) return "\u{1F947}";
  if (index === 1) return "\u{1F948}";
  if (index === 2) return "\u{1F949}";
  return `${index + 1}.`;
}

type FFCardDef = { key: string; label: string; getValue: (name: string) => number; format: (v: number) => string };

export function Leaderboard({ snapshots, gameMode, seasonTitle, ffByPlayer, ffStartDate }: LeaderboardProps) {
  const modeSnapshots = snapshots.filter((s) => s.game_mode === gameMode);
  if (modeSnapshots.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No data for {GAME_MODE_LABELS[gameMode]}
      </div>
    );
  }

  const playerStats = modeSnapshots.map((s) => ({
    name: s.player_name,
    computed: computeStats(s.stats),
  }));

  function renderFFCards(stats: FFCardDef[]) {
    return stats.map((stat) => {
      const sorted = [...playerStats]
        .map((p) => ({ name: p.name, value: stat.getValue(p.name) }))
        .sort((a, b) => b.value - a.value);

      const maxVal = sorted[0]?.value || 1;

      return (
        <div key={stat.key} className="rounded-lg border border-zinc-700 bg-zinc-800/30 px-3 py-2.5">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            {stat.label}
          </h4>
          <div className="space-y-1">
            {sorted.map((p, i) => {
              const pct = maxVal > 0 ? (p.value / maxVal) * 100 : 0;
              const color = PLAYER_COLORS[p.name] || "#a1a1aa";
              return (
                <div key={p.name} className="flex items-center gap-1.5">
                  <span className="w-6 text-center text-xs">{getMedal(i)}</span>
                  <span className="w-24 text-xs truncate font-semibold" style={{ color }}>{p.name}</span>
                  <div className="flex-1 h-5 bg-zinc-700/40 rounded overflow-hidden relative">
                    <div
                      className="h-full rounded transition-all duration-700 opacity-80"
                      style={{ width: `${Math.max(pct, p.value > 0 ? 10 : 0)}%`, backgroundColor: color }}
                    />
                    <span className="absolute right-1.5 top-0 h-full flex items-center text-[11px] font-mono text-white drop-shadow-sm">
                      {stat.format(p.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  const FF_STATS: FFCardDef[] = [
    {
      key: "ffDamageDealt",
      label: "FF Damage Dealt",
      getValue: (name) => ffByPlayer?.[name]?.dealt.damage ?? 0,
      format: (v) => v.toFixed(0),
    },
    {
      key: "ffDamageTaken",
      label: "FF Damage Taken",
      getValue: (name) => ffByPlayer?.[name]?.taken.damage ?? 0,
      format: (v) => v.toFixed(0),
    },
  ];

  function renderStatCards(stats: StatDef[]) {
    return stats.map((stat) => {
      const sorted = [...playerStats]
        .filter((p) => p.computed.roundsPlayed > 0)
        .sort((a, b) => {
          const aVal = a.computed[stat.key];
          const bVal = b.computed[stat.key];
          return (typeof bVal === "number" ? bVal : 0) - (typeof aVal === "number" ? aVal : 0);
        });

      if (sorted.length === 0) return null;

      return (
        <div key={stat.key} className="rounded-lg border border-zinc-700 bg-zinc-800/30 px-3 py-2.5">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            {stat.label}
          </h4>
          <div className="space-y-1">
            {sorted.map((p, i) => {
              const val = p.computed[stat.key];
              const numVal = typeof val === "number" ? val : 0;
              const maxVal = typeof sorted[0].computed[stat.key] === "number"
                ? (sorted[0].computed[stat.key] as number)
                : 1;
              const pct = maxVal > 0 ? (numVal / maxVal) * 100 : 0;
              const color = PLAYER_COLORS[p.name] || "#a1a1aa";

              return (
                <div key={p.name} className="flex items-center gap-1.5">
                  <span className="w-6 text-center text-xs">{getMedal(i)}</span>
                  <span
                    className="w-24 text-xs truncate font-semibold"
                    style={{ color }}
                  >
                    {p.name}
                  </span>
                  <div className="flex-1 h-5 bg-zinc-700/40 rounded overflow-hidden relative">
                    <div
                      className="h-full rounded transition-all duration-700 opacity-80"
                      style={{
                        width: `${Math.max(pct, 10)}%`,
                        backgroundColor: color,
                      }}
                    />
                    <span className="absolute right-1.5 top-0 h-full flex items-center text-[11px] font-mono text-white drop-shadow-sm">
                      {stat.format(numVal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">Showing: {seasonTitle}</p>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.03] p-4">
        <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {renderStatCards(PERFORMANCE_STATS)}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/20 p-4 mt-6">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Totals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {renderStatCards(TOTALS_STATS)}
        </div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4 mt-6">
        <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-1">Friendly Fire</h3>
        <p className="text-xs text-zinc-500 mb-3">
          From match telemetry. Not season-filtered.
          {ffStartDate && (
            <> Tracked since <span className="text-zinc-300">{new Date(ffStartDate).toLocaleDateString()}</span>.</>
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {renderFFCards(FF_STATS)}
        </div>
      </div>
    </div>
  );
}
