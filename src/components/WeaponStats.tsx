"use client";

import { useEffect, useState } from "react";
import { TRACKED_PLAYERS, PLAYER_COLORS } from "@/lib/types";

interface WeaponStat {
  weapon: string;
  kills: number;
  knocks: number;
  damage: number;
  headshots: number;
  hits: number;
  matches_used: number;
  total_kill_distance: number;
  longest_kill_distance: number;
}

type SortKey =
  | "weapon" | "kills" | "knocks" | "damage" | "hits"
  | "matches_used" | "dmgPerHit" | "killsPerGame" | "dmgPerGame"
  | "knockConv" | "avgKillDist" | "longest_kill_distance";

export function WeaponStats() {
  const [data, setData] = useState<Record<string, WeaponStat[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("damage");
  const [sortAsc, setSortAsc] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/weapons");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json.weapons || {});
        setError(null);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 animate-pulse">
        Loading weapon stats...
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">Failed to load weapon stats: {error}</div>;
  }

  // Merge all players or show individual
  let weapons: WeaponStat[];
  if (selectedPlayer === "all") {
    const merged: Record<string, WeaponStat> = {};
    for (const name of TRACKED_PLAYERS) {
      for (const w of data[name] || []) {
        if (!merged[w.weapon]) {
          merged[w.weapon] = { ...w };
        } else {
          merged[w.weapon].kills += w.kills;
          merged[w.weapon].damage += w.damage;
          merged[w.weapon].headshots += w.headshots;
          merged[w.weapon].knocks += w.knocks;
          merged[w.weapon].hits += w.hits;
          merged[w.weapon].matches_used += w.matches_used;
          merged[w.weapon].total_kill_distance += w.total_kill_distance || 0;
          merged[w.weapon].longest_kill_distance = Math.max(
            merged[w.weapon].longest_kill_distance || 0,
            w.longest_kill_distance || 0
          );
        }
      }
    }
    weapons = Object.values(merged);
  } else {
    weapons = [...(data[selectedPlayer] || [])];
  }

  // Compute derived values and sort
  function derived(w: WeaponStat) {
    const g = w.matches_used || 1;
    return {
      dmgPerHit: w.hits > 0 ? w.damage / w.hits : 0,
      killsPerGame: w.kills / g,
      dmgPerGame: w.damage / g,
      knockConv: w.knocks > 0 ? (w.kills / w.knocks) * 100 : 0,
      avgKillDist: w.kills > 0 ? (w.total_kill_distance || 0) / w.kills : 0,
    };
  }

  function getSortValue(w: WeaponStat): number | string {
    if (sortKey === "weapon") return w.weapon.toLowerCase();
    if (sortKey in w) return (w as Record<string, number>)[sortKey] ?? 0;
    const d = derived(w);
    return (d as Record<string, number>)[sortKey] ?? 0;
  }

  weapons.sort((a, b) => {
    const va = getSortValue(a);
    const vb = getSortValue(b);
    if (typeof va === "string" && typeof vb === "string") {
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const maxDamage = weapons.length > 0 ? Math.max(...weapons.map((w) => w.damage)) : 1;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  return (
    <div className="space-y-4">
      {/* Player filter + refresh */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
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
      </div>

      <p className="text-xs text-zinc-500">
        Weapon stats accumulate from telemetry data, updated daily via cron.
        Click any column header to sort. <span className="text-zinc-400">Kills/G</span> = kills per game, <span className="text-zinc-400">Dmg/G</span> = damage per game, <span className="text-zinc-400">Kill %</span> = knock-to-kill conversion rate.
      </p>

      {weapons.length === 0 ? (
        <div className="text-center text-zinc-500 py-8">
          No weapon data yet. Click &quot;Scan New Matches&quot; to process telemetry.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider select-none">
                <th className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("weapon")}>Weapon{sortIndicator("weapon")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("damage")}>Damage{sortIndicator("damage")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("kills")}>Kills{sortIndicator("kills")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("knocks")}>Knocks{sortIndicator("knocks")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("hits")}>Hits{sortIndicator("hits")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("dmgPerHit")}>Dmg/Hit{sortIndicator("dmgPerHit")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("killsPerGame")}>Kills/G{sortIndicator("killsPerGame")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("dmgPerGame")}>Dmg/G{sortIndicator("dmgPerGame")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("knockConv")}>Kill %{sortIndicator("knockConv")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("avgKillDist")}>Avg Dist{sortIndicator("avgKillDist")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("longest_kill_distance")}>Max Dist{sortIndicator("longest_kill_distance")}</th>
                <th className="text-center py-2.5 px-2 font-medium cursor-pointer hover:text-zinc-200" onClick={() => handleSort("matches_used")}>Games{sortIndicator("matches_used")}</th>
                <th className="text-left py-2.5 px-2 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody>
              {weapons.map((w) => {
                const d = derived(w);
                const barPct = maxDamage > 0 ? (w.damage / maxDamage) * 100 : 0;

                return (
                  <tr key={w.weapon} className="border-t border-zinc-800 hover:bg-zinc-800/40 transition">
                    <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">{w.weapon}</td>
                    <td className="text-center py-2 px-2 text-zinc-200">{w.damage.toFixed(0)}</td>
                    <td className="text-center py-2 px-2 text-yellow-400 font-medium">{w.kills}</td>
                    <td className="text-center py-2 px-2 text-orange-400">{w.knocks}</td>
                    <td className="text-center py-2 px-2 text-zinc-400">{w.hits}</td>
                    <td className="text-center py-2 px-2 text-zinc-400">{d.dmgPerHit.toFixed(1)}</td>
                    <td className="text-center py-2 px-2 text-emerald-400">{d.killsPerGame.toFixed(2)}</td>
                    <td className="text-center py-2 px-2 text-sky-400">{d.dmgPerGame.toFixed(0)}</td>
                    <td className="text-center py-2 px-2 text-purple-400">{w.knocks > 0 ? d.knockConv.toFixed(0) + "%" : "—"}</td>
                    <td className="text-center py-2 px-2 text-zinc-400">{w.kills > 0 ? d.avgKillDist.toFixed(0) + "m" : "—"}</td>
                    <td className="text-center py-2 px-2 text-zinc-400">{(w.longest_kill_distance || 0) > 0 ? (w.longest_kill_distance).toFixed(0) + "m" : "—"}</td>
                    <td className="text-center py-2 px-2 text-zinc-500">{w.matches_used}</td>
                    <td className="py-2 px-2">
                      <div className="h-4 bg-zinc-700/40 rounded overflow-hidden">
                        <div
                          className="h-full rounded bg-gradient-to-r from-red-600 to-orange-400 opacity-70"
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
