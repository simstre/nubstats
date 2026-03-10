"use client";

import { useEffect, useState } from "react";
import { TRACKED_PLAYERS, PLAYER_COLORS } from "@/lib/types";
import { format } from "date-fns";

interface Participant {
  name: string;
  kills: number;
  damageDealt: number;
  assists: number;
  dBNOs: number;
  headshotKills: number;
  revives: number;
  timeSurvived: number;
  winPlace: number;
  killPlace: number;
}

interface Match {
  id: string;
  mapName: string;
  gameMode: string;
  duration: number;
  createdAt: string;
  trackedParticipants: Participant[];
  totalParticipants: number;
}

const MAP_NAMES: Record<string, string> = {
  Baltic_Main: "Erangel",
  Desert_Main: "Miramar",
  Savage_Main: "Sanhok",
  DihorOtok_Main: "Vikendi",
  Tiger_Main: "Taego",
  Chimera_Main: "Paramo",
  Heaven_Main: "Haven",
  Kiki_Main: "Deston",
  Neon_Main: "Rondo",
  Summerland_Main: "Karakin",
};

function mapLabel(raw: string): string {
  return MAP_NAMES[raw] || raw;
}

function placeColor(place: number): string {
  if (place === 1) return "#facc15";
  if (place <= 3) return "#fb923c";
  if (place <= 10) return "#4ade80";
  return "#a1a1aa";
}

export function MatchHistory() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = async (signal?: AbortSignal) => {
    const r = await fetch("/api/matches", { signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    setMatches(data.matches || []);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    loadMatches(controller.signal)
      .catch((err) => { if (!cancelled && err.name !== "AbortError") setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/weapons?refresh=true&step=0");
      const data = await res.json();
      const processed = data.matchesProcessed || 0;
      setScanResult(processed > 0 ? `Found ${processed} new matches` : "No new matches found");
      await loadMatches();
    } catch (err) {
      setScanResult(`Error: ${err}`);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 animate-pulse">
        Loading recent matches (this may take a moment)...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 py-8">
        Failed to load matches: {error}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No recent matches found (match data is only available for the last 14 days).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">
          Showing {matches.length} recent matches (last 14 days)
        </p>
        <div className="flex items-center gap-2">
          {scanResult && (
            <span className="text-xs text-zinc-400">{scanResult}</span>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-3 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanning ? "Scanning..." : "Scan New Matches"}
          </button>
        </div>
      </div>
      {matches.map((match) => (
        <div
          key={match.id}
          className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white">
                {mapLabel(match.mapName)}
              </span>
              {match.trackedParticipants.length > 0 && (
                <span className="text-sm font-bold" style={{ color: placeColor(match.trackedParticipants[0].winPlace) }}>
                  #{match.trackedParticipants[0].winPlace}
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {match.gameMode}
              </span>
              <span className="text-xs text-zinc-500">
                {Math.floor(match.duration / 60)}m {match.duration % 60}s
              </span>
            </div>
            <span className="text-xs text-zinc-500">
              {format(new Date(match.createdAt), "MMM d, yyyy h:mm a")}
            </span>
          </div>

          {/* Player stats table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-700">
                  <th className="text-left py-1 pr-3 font-medium">Player</th>
                  <th className="text-center py-1 px-2 font-medium">Kills</th>
                  <th className="text-center py-1 px-2 font-medium">Damage</th>
                  <th className="text-center py-1 px-2 font-medium">Assists</th>
                  <th className="text-center py-1 px-2 font-medium">DBNOs</th>
                  <th className="text-center py-1 px-2 font-medium">HS</th>
                  <th className="text-center py-1 px-2 font-medium">Revives</th>
                  <th className="text-center py-1 px-2 font-medium">Survived</th>
                </tr>
              </thead>
              <tbody>
                {match.trackedParticipants
                  .sort((a, b) => a.winPlace - b.winPlace)
                  .map((p) => {
                    const isTracked = TRACKED_PLAYERS.includes(p.name);
                    return (
                      <tr
                        key={p.name}
                        className="border-b border-zinc-800 last:border-0"
                      >
                        <td
                          className="py-1.5 pr-3 font-semibold"
                          style={{
                            color: isTracked
                              ? PLAYER_COLORS[p.name]
                              : "#a1a1aa",
                          }}
                        >
                          {p.name}
                        </td>
                        <td className="text-center py-1.5 px-2 text-white font-medium">
                          {p.kills}
                        </td>
                        <td className="text-center py-1.5 px-2 text-zinc-300">
                          {p.damageDealt.toFixed(0)}
                        </td>
                        <td className="text-center py-1.5 px-2 text-zinc-400">
                          {p.assists}
                        </td>
                        <td className="text-center py-1.5 px-2 text-zinc-400">
                          {p.dBNOs}
                        </td>
                        <td className="text-center py-1.5 px-2 text-zinc-400">
                          {p.headshotKills}
                        </td>
                        <td className="text-center py-1.5 px-2 text-zinc-400">
                          {p.revives}
                        </td>
                        <td className="text-center py-1.5 px-2 text-zinc-500">
                          {Math.floor(p.timeSurvived / 60)}m
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
