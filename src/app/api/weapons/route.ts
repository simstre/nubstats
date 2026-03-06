import { NextRequest, NextResponse } from "next/server";
import { getPlayerWithMatches } from "@/lib/pubg-api";
import { TRACKED_PLAYERS } from "@/lib/types";
import { getWeaponName } from "@/lib/weapon-names";
import {
  initWeaponTables,
  isMatchProcessed,
  markMatchProcessed,
  upsertWeaponStat,
  getWeaponStats,
  getAllWeaponStats,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface TelemetryEvent {
  _T: string;
  attacker?: { name: string };
  killer?: { name: string };
  victim?: { name: string };
  damage?: number;
  damageCauserName?: string;
  damageTypeCategory?: string;
  killerDamageInfo?: {
    damageCauserName: string;
    damageTypeCategory: string;
    distance: number;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "true";

  try {
    await initWeaponTables();

    if (refresh) {
      // Process new matches
      const allMatchIds = new Set<string>();
      for (const name of TRACKED_PLAYERS) {
        const player = await getPlayerWithMatches(name);
        if (player) {
          for (const id of player.matchIds) {
            allMatchIds.add(id);
          }
        }
        await new Promise((r) => setTimeout(r, 6500));
      }

      let processed = 0;
      for (const matchId of allMatchIds) {
        if (await isMatchProcessed(matchId)) continue;

        // Get telemetry URL from match
        const matchRes = await fetch(
          `https://api.pubg.com/shards/${process.env.PUBG_PLATFORM || "steam"}/matches/${matchId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
              Accept: "application/vnd.api+json",
            },
          }
        );
        if (!matchRes.ok) {
          await markMatchProcessed(matchId);
          continue;
        }
        const matchData = await matchRes.json();
        let telemetryUrl = "";
        for (const inc of matchData.included || []) {
          if (inc.type === "asset") {
            telemetryUrl = inc.attributes.URL;
            break;
          }
        }
        if (!telemetryUrl) {
          await markMatchProcessed(matchId);
          continue;
        }

        // Download and process telemetry
        try {
          const telRes = await fetch(telemetryUrl, {
            headers: { "Accept-Encoding": "gzip" },
          });
          if (!telRes.ok) {
            await markMatchProcessed(matchId);
            continue;
          }
          const events: TelemetryEvent[] = await telRes.json();
          const trackedSet = new Set(TRACKED_PLAYERS);

          // Aggregate per player per weapon for this match
          interface WepAccum {
            kills: number; knocks: number; damage: number; headshots: number; hits: number;
            totalKillDist: number; longestKillDist: number;
          }
          const matchStats: Record<string, Record<string, WepAccum>> = {};

          function ensure(name: string, w: string) {
            if (!matchStats[name]) matchStats[name] = {};
            if (!matchStats[name][w]) matchStats[name][w] = {
              kills: 0, knocks: 0, damage: 0, headshots: 0, hits: 0,
              totalKillDist: 0, longestKillDist: 0,
            };
          }

          for (const e of events) {
            if (e._T === "LogPlayerTakeDamage") {
              const name = e.attacker?.name;
              if (name && trackedSet.has(name) && e.damageCauserName) {
                const w = getWeaponName(e.damageCauserName);
                ensure(name, w);
                matchStats[name][w].damage += e.damage || 0;
                matchStats[name][w].hits += 1;
              }
            }

            if (e._T === "LogPlayerKillV2") {
              const name = e.killer?.name;
              if (name && trackedSet.has(name) && e.killerDamageInfo) {
                const info = e.killerDamageInfo;
                const w = getWeaponName(info.damageCauserName);
                ensure(name, w);
                matchStats[name][w].kills += 1;
                const dist = (info.distance || 0) / 100; // cm to meters
                matchStats[name][w].totalKillDist += dist;
                if (dist > matchStats[name][w].longestKillDist) {
                  matchStats[name][w].longestKillDist = dist;
                }
              }
            }

            if (e._T === "LogPlayerMakeGroggy") {
              const name = e.attacker?.name;
              if (name && trackedSet.has(name) && e.damageCauserName) {
                const w = getWeaponName(e.damageCauserName);
                ensure(name, w);
                matchStats[name][w].knocks += 1;
              }
            }
          }

          // Save to DB
          for (const [playerName, weapons] of Object.entries(matchStats)) {
            for (const [weapon, stats] of Object.entries(weapons)) {
              await upsertWeaponStat(
                playerName, weapon,
                stats.kills, stats.knocks, stats.damage, stats.headshots, stats.hits, 1,
                stats.totalKillDist, stats.longestKillDist
              );
            }
          }

          await markMatchProcessed(matchId);
          processed++;
        } catch (err) {
          console.error(`Telemetry error for ${matchId}:`, err);
          await markMatchProcessed(matchId);
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      // Return fresh data
      const allStats = await getAllWeaponStats();
      return NextResponse.json({
        weapons: groupByPlayer(allStats),
        newMatchesProcessed: processed,
      });
    }

    // Just return stored data
    const allStats = await getAllWeaponStats();
    return NextResponse.json({
      weapons: groupByPlayer(allStats),
      newMatchesProcessed: 0,
    });
  } catch (error) {
    console.error("Weapons error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

function groupByPlayer(rows: Array<Record<string, unknown>>) {
  const result: Record<string, Array<Record<string, unknown>>> = {};
  for (const name of TRACKED_PLAYERS) {
    result[name] = [];
  }
  for (const row of rows) {
    const name = row.player_name as string;
    if (result[name]) {
      result[name].push(row);
    }
  }
  return result;
}
