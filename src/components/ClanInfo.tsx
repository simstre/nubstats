"use client";

import { useEffect, useState } from "react";
import { TRACKED_PLAYERS, PLAYER_COLORS } from "@/lib/types";

interface ClanData {
  id: string;
  clanName: string;
  clanTag: string;
  clanLevel: number;
  clanMemberCount: number;
}

export function ClanInfo() {
  const [clan, setClan] = useState<ClanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clan")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setClan(data.clan || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 animate-pulse">
        <div className="h-4 bg-zinc-700 rounded w-32" />
      </div>
    );
  }

  if (!clan) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-yellow-400">[{clan.clanTag}]</span>
            <span className="text-xl font-bold text-white">{clan.clanName}</span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-zinc-400">
            <span>Level {clan.clanLevel}</span>
            <span>{clan.clanMemberCount} members</span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap">
          {TRACKED_PLAYERS.map((name) => (
            <span
              key={name}
              className="px-2 py-1 rounded bg-zinc-700/50 text-xs font-semibold"
              style={{ color: PLAYER_COLORS[name] }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
