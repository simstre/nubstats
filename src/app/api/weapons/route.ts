import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getPlayerWithMatches } from "@/lib/pubg-api";
import { TRACKED_PLAYERS } from "@/lib/types";
import { getWeaponName } from "@/lib/weapon-names";
import {
  initWeaponTables,
  isMatchProcessed,
  markMatchProcessed,
  upsertWeaponStat,
  getAllWeaponStats,
  upsertDeathStat,
  getAllDeathStats,
  getProcessedMatchesDateRange,
  upsertMatch,
  getProcessedMatchIdsWithoutDetails,
  getAllProcessedMatchIds,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 2;
const MAX_MATCHES_PER_STEP = 5;

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

    // Reprocess existing matches for a specific player (one-time use)
    const reprocessPlayer = searchParams.get("reprocess");
    if (reprocessPlayer && TRACKED_PLAYERS.includes(reprocessPlayer)) {
      const step = parseInt(searchParams.get("step") || "0");
      const matchIds = await getAllProcessedMatchIds();
      const batchSize = 5;
      const batch = matchIds.slice(step * batchSize, (step + 1) * batchSize);

      let processed = 0;
      for (const matchId of batch) {
        try {
          const matchRes = await fetch(
            `https://api.pubg.com/shards/${process.env.PUBG_PLATFORM || "steam"}/matches/${matchId}`,
            { headers: { Authorization: `Bearer ${process.env.PUBG_API_KEY}`, Accept: "application/vnd.api+json" } }
          );
          if (!matchRes.ok) continue;
          const matchData = await matchRes.json();
          let telemetryUrl = "";
          for (const inc of matchData.included || []) {
            if (inc.type === "asset") { telemetryUrl = inc.attributes.URL; break; }
          }
          if (!telemetryUrl) continue;

          const telRes = await fetch(telemetryUrl, { headers: { "Accept-Encoding": "gzip" } });
          if (!telRes.ok) continue;
          const events: TelemetryEvent[] = await telRes.json();

          const wepStats: Record<string, { kills: number; knocks: number; damage: number; headshots: number; hits: number; totalKillDist: number; longestKillDist: number }> = {};
          const deathCauses: Record<string, number> = {};

          for (const e of events) {
            if (e._T === "LogPlayerTakeDamage" && e.attacker?.name === reprocessPlayer && e.damageCauserName) {
              const w = getWeaponName(e.damageCauserName);
              if (!wepStats[w]) wepStats[w] = { kills: 0, knocks: 0, damage: 0, headshots: 0, hits: 0, totalKillDist: 0, longestKillDist: 0 };
              wepStats[w].damage += e.damage || 0;
              wepStats[w].hits += 1;
            }
            if (e._T === "LogPlayerKillV2") {
              if (e.killer?.name === reprocessPlayer && e.killerDamageInfo) {
                const w = getWeaponName(e.killerDamageInfo.damageCauserName);
                if (!wepStats[w]) wepStats[w] = { kills: 0, knocks: 0, damage: 0, headshots: 0, hits: 0, totalKillDist: 0, longestKillDist: 0 };
                wepStats[w].kills += 1;
                const dist = (e.killerDamageInfo.distance || 0) / 100;
                wepStats[w].totalKillDist += dist;
                if (dist > wepStats[w].longestKillDist) wepStats[w].longestKillDist = dist;
              }
              if (e.victim?.name === reprocessPlayer && e.killerDamageInfo) {
                const cause = getWeaponName(e.killerDamageInfo.damageCauserName);
                deathCauses[cause] = (deathCauses[cause] || 0) + 1;
              }
            }
            if (e._T === "LogPlayerMakeGroggy" && e.attacker?.name === reprocessPlayer && e.damageCauserName) {
              const w = getWeaponName(e.damageCauserName);
              if (!wepStats[w]) wepStats[w] = { kills: 0, knocks: 0, damage: 0, headshots: 0, hits: 0, totalKillDist: 0, longestKillDist: 0 };
              wepStats[w].knocks += 1;
            }
          }

          for (const [weapon, stats] of Object.entries(wepStats)) {
            await upsertWeaponStat(reprocessPlayer, weapon, stats.kills, stats.knocks, stats.damage, stats.headshots, stats.hits, 1, stats.totalKillDist, stats.longestKillDist);
          }
          for (const [cause, count] of Object.entries(deathCauses)) {
            await upsertDeathStat(reprocessPlayer, cause, count);
          }
          processed++;
        } catch { /* skip */ }
        await new Promise((r) => setTimeout(r, 500));
      }

      // Chain next batch
      const nextStart = (step + 1) * batchSize;
      if (nextStart < matchIds.length) {
        const url = new URL(request.url);
        url.searchParams.set("step", String(step + 1));
        waitUntil(fetch(url.toString()).catch(() => {}));
      }

      return NextResponse.json({ success: true, player: reprocessPlayer, step, matchesReprocessed: processed, totalMatches: matchIds.length });
    }

    if (refresh) {
      const step = parseInt(searchParams.get("step") || "0");
      const start = step * BATCH_SIZE;
      const batch = TRACKED_PLAYERS.slice(start, start + BATCH_SIZE);

      if (batch.length === 0) {
        return NextResponse.json({ success: true, message: "No more players" });
      }

      // Fetch match IDs for this batch of players
      const allMatchIds = new Set<string>();
      for (const name of batch) {
        try {
          const player = await getPlayerWithMatches(name);
          if (player) {
            for (const id of player.matchIds) {
              allMatchIds.add(id);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch matches for ${name}:`, err);
        }
        await new Promise((r) => setTimeout(r, 6500));
      }

      // Process up to MAX_MATCHES_PER_STEP new matches
      let processed = 0;
      for (const matchId of allMatchIds) {
        if (processed >= MAX_MATCHES_PER_STEP) break;
        if (await isMatchProcessed(matchId)) continue;

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
        const matchAttrs = matchData.data?.attributes;

        // Store match details for tracked participants
        if (matchAttrs) {
          const trackedSet = new Set(TRACKED_PLAYERS);
          const participants: Array<Record<string, unknown>> = [];
          for (const inc of matchData.included || []) {
            if (inc.type === "participant") {
              const s = inc.attributes.stats;
              if (trackedSet.has(s.name)) {
                participants.push({
                  name: s.name, kills: s.kills, damageDealt: s.damageDealt,
                  assists: s.assists, dBNOs: s.DBNOs, headshotKills: s.headshotKills,
                  revives: s.revives, timeSurvived: s.timeSurvived,
                  winPlace: s.winPlace, killPlace: s.killPlace,
                });
              }
            }
          }
          if (participants.length > 0) {
            await upsertMatch(matchId, matchAttrs.mapName, matchAttrs.gameMode,
              matchAttrs.duration, matchAttrs.createdAt, participants);
          }
        }

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

          interface WepAccum {
            kills: number; knocks: number; damage: number; headshots: number; hits: number;
            totalKillDist: number; longestKillDist: number;
          }
          const matchStats: Record<string, Record<string, WepAccum>> = {};
          const deathAccum: Record<string, Record<string, number>> = {};

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
                const dist = (info.distance || 0) / 100;
                matchStats[name][w].totalKillDist += dist;
                if (dist > matchStats[name][w].longestKillDist) {
                  matchStats[name][w].longestKillDist = dist;
                }
              }

              // Track deaths where victim is a tracked player
              const victim = e.victim?.name;
              if (victim && trackedSet.has(victim) && e.killerDamageInfo) {
                const cause = getWeaponName(e.killerDamageInfo.damageCauserName);
                if (!deathAccum[victim]) deathAccum[victim] = {};
                if (!deathAccum[victim][cause]) deathAccum[victim][cause] = 0;
                deathAccum[victim][cause] += 1;
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

          for (const [playerName, weapons] of Object.entries(matchStats)) {
            for (const [weapon, stats] of Object.entries(weapons)) {
              await upsertWeaponStat(
                playerName, weapon,
                stats.kills, stats.knocks, stats.damage, stats.headshots, stats.hits, 1,
                stats.totalKillDist, stats.longestKillDist
              );
            }
          }

          for (const [playerName, causes] of Object.entries(deathAccum)) {
            for (const [cause, count] of Object.entries(causes)) {
              await upsertDeathStat(playerName, cause, count);
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

      // Backfill match details for previously processed matches (one-time migration)
      let matchesBackfilled = 0;
      if (step === 0) {
        const missingIds = await getProcessedMatchIdsWithoutDetails();
        for (const mid of missingIds.slice(0, 5)) {
          try {
            const mRes = await fetch(
              `https://api.pubg.com/shards/${process.env.PUBG_PLATFORM || "steam"}/matches/${mid}`,
              { headers: { Authorization: `Bearer ${process.env.PUBG_API_KEY}`, Accept: "application/vnd.api+json" } }
            );
            if (mRes.ok) {
              const mData = await mRes.json();
              const attrs = mData.data?.attributes;
              if (attrs) {
                const trackedSet = new Set(TRACKED_PLAYERS);
                const parts: Array<Record<string, unknown>> = [];
                for (const inc of mData.included || []) {
                  if (inc.type === "participant") {
                    const s = inc.attributes.stats;
                    if (trackedSet.has(s.name)) {
                      parts.push({
                        name: s.name, kills: s.kills, damageDealt: s.damageDealt,
                        assists: s.assists, dBNOs: s.DBNOs, headshotKills: s.headshotKills,
                        revives: s.revives, timeSurvived: s.timeSurvived,
                        winPlace: s.winPlace, killPlace: s.killPlace,
                      });
                    }
                  }
                }
                if (parts.length > 0) {
                  await upsertMatch(mid, attrs.mapName, attrs.gameMode, attrs.duration, attrs.createdAt, parts);
                  matchesBackfilled++;
                }
              }
            }
          } catch { /* skip */ }
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      // Chain next batch
      const nextStart = (step + 1) * BATCH_SIZE;
      if (nextStart < TRACKED_PLAYERS.length) {
        const url = new URL(request.url);
        url.searchParams.set("step", String(step + 1));
        waitUntil(fetch(url.toString()).catch(() => {}));
      }

      return NextResponse.json({
        success: true,
        step,
        matchesProcessed: processed,
        matchesBackfilled,
      });
    }

    // Just return stored data (no refresh)
    const [allStats, allDeaths, dateRange] = await Promise.all([
      getAllWeaponStats(), getAllDeathStats(), getProcessedMatchesDateRange(),
    ]);
    return NextResponse.json({
      weapons: groupByPlayer(allStats),
      deaths: groupByPlayer(allDeaths),
      dateRange,
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
