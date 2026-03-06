"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TRACKED_PLAYERS, GameMode, computeStats, PubgPlayerStats, PLAYER_COLORS } from "@/lib/types";

interface HistoryRow {
  season_id: string;
  stats: PubgPlayerStats;
}

const COLORS = TRACKED_PLAYERS.map((p) => PLAYER_COLORS[p] || "#a1a1aa");
const CHART_STATS = [
  { key: "kills", label: "Kills" },
  { key: "kd", label: "K/D Ratio" },
  { key: "wins", label: "Wins" },
  { key: "winRate", label: "Win Rate %" },
  { key: "avgDamage", label: "Avg Damage" },
  { key: "headshotRate", label: "Headshot %" },
  { key: "roundsPlayed", label: "Games Played" },
  { key: "top10s", label: "Top 10s" },
  { key: "damageDealt", label: "Total Damage" },
  { key: "longestKill", label: "Longest Kill" },
];

function seasonLabel(seasonId: string): string {
  // "division.bro.official.pc-2018-05" -> "S5"
  const match = seasonId.match(/pc-2018-(\d+)$/);
  if (match) return `S${parseInt(match[1])}`;
  const match2 = seasonId.match(/(\d{4})-(\d+)$/);
  if (match2) return `S${parseInt(match2[2])}`;
  return seasonId;
}

interface HistoryChartProps {
  gameMode: GameMode;
}

export function HistoryChart({ gameMode }: HistoryChartProps) {
  const [selectedStat, setSelectedStat] = useState("kd");
  const [data, setData] = useState<Record<string, HistoryRow[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TRACKED_PLAYERS.map(async (player) => {
        const res = await fetch(
          `/api/history?player=${player}&mode=${gameMode}`
        );
        const json = await res.json();
        return { player, history: json.history || [] };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, HistoryRow[]> = {};
      for (const r of results) {
        map[r.player] = r.history;
      }
      setData(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [gameMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        Loading history...
      </div>
    );
  }

  // Collect all unique season IDs across all players
  const seasonSet = new Set<string>();
  for (const player of TRACKED_PLAYERS) {
    for (const row of data[player] || []) {
      seasonSet.add(row.season_id);
    }
  }

  const seasons = [...seasonSet].sort();
  const chartData = seasons.map((season) => {
    const point: Record<string, string | number> = { season: seasonLabel(season) };
    for (const player of TRACKED_PLAYERS) {
      const rows = data[player] || [];
      const row = rows.find((r) => r.season_id === season);
      if (row) {
        const computed = computeStats(row.stats);
        point[player] = computed[selectedStat as keyof typeof computed] as number;
      }
    }
    return point;
  });

  if (chartData.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No historical data yet. Run the backfill to pull all past seasons.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CHART_STATS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedStat(s.key)}
            className={`px-3 py-1 rounded text-sm transition ${
              selectedStat === s.key
                ? "bg-yellow-500 text-black font-semibold"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="season"
              tick={{ fill: "#999", fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fill: "#999", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#999" }}
            />
            <Legend />
            {TRACKED_PLAYERS.map((player, i) => (
              <Line
                key={player}
                type="monotone"
                dataKey={player}
                stroke={COLORS[i]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
