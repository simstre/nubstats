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
  upsertFriendlyFire,
  getAllFriendlyFire,
  getFriendlyFireStartDate,
  clearPlayerFriendlyFire,
  clearPlayerWeaponsAndDeaths,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 2;
const MAX_MATCHES_PER_STEP = 10;

interface TelemetryCharacter {
  name: string;
  teamId?: number;
  accountId?: string;
}

interface TelemetryEvent {
  _T: string;
  attacker?: TelemetryCharacter;
  killer?: TelemetryCharacter;
  victim?: TelemetryCharacter;
  damage?: number;
  damageCauserName?: string;
  damageTypeCategory?: string;
  killerDamageInfo?: {
    damageCauserName: string;
    damageTypeCategory: string;
    distance: number;
  };
}

function isFriendlyFire(
  a: TelemetryCharacter | undefined,
  v: TelemetryCharacter | undefined
): boolean {
  if (!a || !v) return false;
  if (a.teamId === undefined || v.teamId === undefined) return false;
  if (a.teamId !== v.teamId) return false;
  if (!a.name || !v.name) return false;
  return a.name !== v.name;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "true";

  try {
    await initWeaponTables();

    // FF backfill for a specific player. Friendly-fire-only by default.
    // Pass `restore=1` to ALSO rebuild weapon_stats and death_stats for this
    // player from any matches whose telemetry is still in PUBG's 14-day window.
    // The restore mode is destructive on step 0 (clears the player's existing
    // weapon_stats and death_stats) — only use it to recover from a known wipe.
    const reprocessPlayer = searchParams.get("reprocess");
    if (reprocessPlayer && TRACKED_PLAYERS.includes(reprocessPlayer)) {
      const step = parseInt(searchParams.get("step") || "0");
      const restore = searchParams.get("restore") === "1";
      const chain = searchParams.get("chain") !== "0"; // default true; pass chain=0 when driving from client
      const matchIds = await getAllProcessedMatchIds();
      const batchSize = 5;
      const batch = matchIds.slice(step * batchSize, (step + 1) * batchSize);

      if (step === 0) {
        await clearPlayerFriendlyFire(reprocessPlayer);
        if (restore) {
          await clearPlayerWeaponsAndDeaths(reprocessPlayer);
        }
      }

      let processed = 0;
      for (const matchId of batch) {
        try {
          const matchRes = await fetch(
            `https://api.pubg.com/shards/${process.env.PUBG_PLATFORM || "steam"}/matches/${matchId}`,
            { headers: { Authorization: `Bearer ${process.env.PUBG_API_KEY}`, Accept: "application/vnd.api+json" } }
          );
          if (!matchRes.ok) continue;
          const matchData = await matchRes.json();
          const matchCreatedAt: string = matchData.data?.attributes?.createdAt;
          if (!matchCreatedAt) continue;
          let telemetryUrl = "";
          for (const inc of matchData.included || []) {
            if (inc.type === "asset") { telemetryUrl = inc.attributes.URL; break; }
          }
          if (!telemetryUrl) continue;

          const telRes = await fetch(telemetryUrl, { headers: { "Accept-Encoding": "gzip" } });
          if (!telRes.ok) continue;
          const events: TelemetryEvent[] = await telRes.json();

          const ffPairs: Record<string, Record<string, { damage: number; hits: number; knocks: number; kills: number }>> = {};
          function ensureFFPair(a: string, v: string) {
            if (!ffPairs[a]) ffPairs[a] = {};
            if (!ffPairs[a][v]) ffPairs[a][v] = { damage: 0, hits: 0, knocks: 0, kills: 0 };
          }

          interface WepAccum { kills: number; knocks: number; damage: number; headshots: number; hits: number; totalKillDist: number; longestKillDist: number; }
          const wepStats: Record<string, WepAccum> = {};
          const deathCauses: Record<string, number> = {};
          function ensureWep(w: string) {
            if (!wepStats[w]) wepStats[w] = { kills: 0, knocks: 0, damage: 0, headshots: 0, hits: 0, totalKillDist: 0, longestKillDist: 0 };
          }

          for (const e of events) {
            if (e._T === "LogPlayerTakeDamage") {
              if (restore && e.attacker?.name === reprocessPlayer && e.damageCauserName) {
                const w = getWeaponName(e.damageCauserName);
                ensureWep(w);
                wepStats[w].damage += e.damage || 0;
                wepStats[w].hits += 1;
              }
              if (e.attacker && e.victim && isFriendlyFire(e.attacker, e.victim)) {
                const aName: string = e.attacker.name;
                const vName: string = e.victim.name;
                if (aName === reprocessPlayer || vName === reprocessPlayer) {
                  ensureFFPair(aName, vName);
                  ffPairs[aName][vName].damage += e.damage || 0;
                  ffPairs[aName][vName].hits += 1;
                }
              }
            }
            if (e._T === "LogPlayerMakeGroggy") {
              if (restore && e.attacker?.name === reprocessPlayer && e.damageCauserName) {
                const w = getWeaponName(e.damageCauserName);
                ensureWep(w);
                wepStats[w].knocks += 1;
              }
              if (e.attacker && e.victim && isFriendlyFire(e.attacker, e.victim)) {
                const aName: string = e.attacker.name;
                const vName: string = e.victim.name;
                if (aName === reprocessPlayer || vName === reprocessPlayer) {
                  ensureFFPair(aName, vName);
                  ffPairs[aName][vName].knocks += 1;
                }
              }
            }
            if (e._T === "LogPlayerKillV2") {
              if (restore && e.killer?.name === reprocessPlayer && e.killerDamageInfo) {
                const w = getWeaponName(e.killerDamageInfo.damageCauserName);
                ensureWep(w);
                wepStats[w].kills += 1;
                const dist = (e.killerDamageInfo.distance || 0) / 100;
                wepStats[w].totalKillDist += dist;
                if (dist > wepStats[w].longestKillDist) wepStats[w].longestKillDist = dist;
              }
              if (restore && e.victim?.name === reprocessPlayer && e.killerDamageInfo) {
                const cause = getWeaponName(e.killerDamageInfo.damageCauserName);
                deathCauses[cause] = (deathCauses[cause] || 0) + 1;
              }
              if (e.killer && e.victim && isFriendlyFire(e.killer, e.victim)) {
                const aName: string = e.killer.name;
                const vName: string = e.victim.name;
                if (aName === reprocessPlayer || vName === reprocessPlayer) {
                  ensureFFPair(aName, vName);
                  ffPairs[aName][vName].kills += 1;
                }
              }
            }
          }

          if (restore) {
            for (const [weapon, stats] of Object.entries(wepStats)) {
              await upsertWeaponStat(reprocessPlayer, weapon, stats.kills, stats.knocks, stats.damage, stats.headshots, stats.hits, 1, stats.totalKillDist, stats.longestKillDist);
            }
            for (const [cause, count] of Object.entries(deathCauses)) {
              await upsertDeathStat(reprocessPlayer, cause, count);
            }
          }
          for (const [attacker, victims] of Object.entries(ffPairs)) {
            for (const [victim, ff] of Object.entries(victims)) {
              await upsertFriendlyFire(attacker, victim, ff.damage, ff.hits, ff.knocks, ff.kills, matchCreatedAt);
            }
          }
          processed++;
        } catch { /* skip */ }
        await new Promise((r) => setTimeout(r, 500));
      }

      // Chain next batch
      const nextStart = (step + 1) * batchSize;
      if (chain && nextStart < matchIds.length) {
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : new URL(request.url).origin;
        const restoreParam = restore ? "&restore=1" : "";
        const nextUrl = `${baseUrl}/api/weapons?reprocess=${reprocessPlayer}&step=${step + 1}${restoreParam}`;
        const chainHeaders: HeadersInit = {};
        if (process.env.CRON_SECRET) {
          chainHeaders["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
        }
        waitUntil(fetch(nextUrl, { headers: chainHeaders }).catch((err) => console.error("Chain failed:", err)));
      }

      return NextResponse.json({ success: true, player: reprocessPlayer, step, restore, chain, matchesReprocessed: processed, totalMatches: matchIds.length });
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
          interface FFAccum { damage: number; hits: number; knocks: number; kills: number; }
          const matchStats: Record<string, Record<string, WepAccum>> = {};
          const deathAccum: Record<string, Record<string, number>> = {};
          const ffAccum: Record<string, Record<string, FFAccum>> = {};

          function ensureFF(attacker: string, victim: string) {
            if (!ffAccum[attacker]) ffAccum[attacker] = {};
            if (!ffAccum[attacker][victim]) ffAccum[attacker][victim] = {
              damage: 0, hits: 0, knocks: 0, kills: 0,
            };
          }

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
              if (isFriendlyFire(e.attacker, e.victim)) {
                const aName = e.attacker!.name;
                const vName = e.victim!.name;
                if (trackedSet.has(aName) || trackedSet.has(vName)) {
                  ensureFF(aName, vName);
                  ffAccum[aName][vName].damage += e.damage || 0;
                  ffAccum[aName][vName].hits += 1;
                }
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

              if (isFriendlyFire(e.killer, e.victim)) {
                const aName = e.killer!.name;
                const vName = e.victim!.name;
                if (trackedSet.has(aName) || trackedSet.has(vName)) {
                  ensureFF(aName, vName);
                  ffAccum[aName][vName].kills += 1;
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
              if (isFriendlyFire(e.attacker, e.victim)) {
                const aName = e.attacker!.name;
                const vName = e.victim!.name;
                if (trackedSet.has(aName) || trackedSet.has(vName)) {
                  ensureFF(aName, vName);
                  ffAccum[aName][vName].knocks += 1;
                }
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

          for (const [attacker, victims] of Object.entries(ffAccum)) {
            for (const [victim, ff] of Object.entries(victims)) {
              await upsertFriendlyFire(
                attacker, victim, ff.damage, ff.hits, ff.knocks, ff.kills, matchAttrs.createdAt
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
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : new URL(request.url).origin;
        const nextUrl = `${baseUrl}/api/weapons?refresh=true&step=${step + 1}`;
        const chainHeaders: HeadersInit = {};
        if (process.env.CRON_SECRET) {
          chainHeaders["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
        }
        waitUntil(fetch(nextUrl, { headers: chainHeaders }).catch((err) => console.error("Chain failed:", err)));
      }

      return NextResponse.json({
        success: true,
        step,
        matchesProcessed: processed,
        matchesBackfilled,
      });
    }

    // Just return stored data (no refresh)
    const [allStats, allDeaths, allFF, ffStartDate, dateRange] = await Promise.all([
      getAllWeaponStats(), getAllDeathStats(), getAllFriendlyFire(), getFriendlyFireStartDate(), getProcessedMatchesDateRange(),
    ]);
    return NextResponse.json({
      weapons: groupByPlayer(allStats),
      deaths: groupByPlayer(allDeaths),
      friendlyFire: allFF,
      ffStartDate,
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
