"use client";

import { useEffect, useState } from "react";
import { TRACKED_PLAYERS, PLAYER_COLORS } from "@/lib/types";

interface DeathStat {
  cause: string;
  deaths: number;
}

type SortKey = "cause" | "deaths";

export function DeathStats() {
  const [data, setData] = useState<Record<string, DeathStat[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("deaths");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weapons")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          if (json.error) setError(json.error);
          else { setData(json.deaths || {}); setError(null); }
        }
      })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 animate-pulse">
        Loading death stats...
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">Failed to load death stats: {error}</div>;
  }

  let deaths: DeathStat[];
  if (selectedPlayer === "all") {
    const merged: Record<string, DeathStat> = {};
    for (const name of TRACKED_PLAYERS) {
      for (const d of data[name] || []) {
        if (!merged[d.cause]) {
          merged[d.cause] = { ...d };
        } else {
          merged[d.cause].deaths += d.deaths;
        }
      }
    }
    deaths = Object.values(merged);
  } else {
    deaths = [...(data[selectedPlayer] || [])];
  }

  deaths.sort((a, b) => {
    if (sortKey === "cause") {
      return sortAsc
        ? a.cause.localeCompare(b.cause)
        : b.cause.localeCompare(a.cause);
    }
    return sortAsc ? a.deaths - b.deaths : b.deaths - a.deaths;
  });

  const maxDeaths = deaths.length > 0 ? Math.max(...deaths.map((d) => d.deaths)) : 1;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setSelectedPlayer("all")}
          className={`px-3 py-1.5 rounded-md text-sm transition font-semibold ${
            selectedPlayer === "all"
              ? "bg-zinc-700 text-white ring-1 ring-yellow-500/50"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          All Players
        </button>
        {TRACKED_PLAYERS.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedPlayer(name)}
            className={`px-3 py-1.5 rounded-md text-sm transition font-semibold ${
              selectedPlayer === name ? "bg-zinc-700 ring-1" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
            style={{ color: PLAYER_COLORS[name] }}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        How your squad dies. Data comes from match telemetry (last 14 days only — PUBG does not retain older match data).
        Stats accumulate over time as new matches are processed daily. Click column headers to sort.
      </p>

      {deaths.length === 0 ? (
        <div className="text-center text-zinc-500 py-8">
          No death data yet. Data accumulates as matches are processed.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider select-none">
                <th className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("cause")}>
                  Killed By{sortIndicator("cause")}
                </th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("deaths")}>
                  Deaths{sortIndicator("deaths")}
                </th>
                <th className="text-left py-2.5 px-2 font-medium w-48"></th>
              </tr>
            </thead>
            <tbody>
              {deaths.map((d) => {
                const barPct = maxDeaths > 0 ? (d.deaths / maxDeaths) * 100 : 0;
                return (
                  <tr key={d.cause} className="border-t border-zinc-800 hover:bg-zinc-800/40 transition">
                    <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">{d.cause}</td>
                    <td className="text-center py-2 px-2 text-red-400 font-medium">{d.deaths}</td>
                    <td className="py-2 px-2">
                      <div className="h-4 bg-zinc-700/40 rounded overflow-hidden">
                        <div
                          className="h-full rounded bg-gradient-to-r from-red-700 to-red-400 opacity-70"
                          style={{ width: `${Math.max(barPct, 3)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
