import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getWeaponName } from "@/lib/weapon-names";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

interface TelemetryCharacter { name: string; teamId?: number; }
interface TelemetryEvent {
  _T: string;
  _D?: string;
  attacker?: TelemetryCharacter;
  killer?: TelemetryCharacter;
  victim?: TelemetryCharacter;
  damage?: number;
  damageCauserName?: string;
  killerDamageInfo?: { damageCauserName: string; distance: number };
}

function isFF(a?: TelemetryCharacter, v?: TelemetryCharacter): boolean {
  if (!a || !v) return false;
  if (a.teamId === undefined || v.teamId === undefined) return false;
  return a.teamId === v.teamId && a.name !== v.name && !!a.name && !!v.name;
}

interface FFEvent {
  matchId: string;
  mapName: string;
  gameMode: string;
  matchCreatedAt: string;
  eventType: "knock" | "damage" | "kill";
  attacker: string;
  victim: string;
  weapon: string | null;
  damage?: number;
  distance?: number;
  timestamp?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const player = searchParams.get("player");
  const page = parseInt(searchParams.get("page") || "0");
  const eventTypeFilter = searchParams.get("type"); // "knock" | "damage" | "kill" | null (all)

  if (!player) {
    return NextResponse.json({ error: "?player= required" }, { status: 400 });
  }

  const PAGE_SIZE = 25;

  // Pull matches whose telemetry is most likely still available (last 15 days).
  const matches = await pool.query(
    `SELECT match_id, map_name, game_mode, created_at
     FROM match_details
     WHERE created_at >= NOW() - INTERVAL '15 days'
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, page * PAGE_SIZE]
  );

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM match_details
     WHERE created_at >= NOW() - INTERVAL '15 days'`
  );
  const total = totalRes.rows[0]?.total ?? 0;

  const events: FFEvent[] = [];
  let processed = 0;

  for (const m of matches.rows) {
    try {
      const matchRes = await fetch(
        `https://api.pubg.com/shards/${process.env.PUBG_PLATFORM || "steam"}/matches/${m.match_id}`,
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
      const telEvents: TelemetryEvent[] = await telRes.json();

      for (const e of telEvents) {
        if (e._T === "LogPlayerMakeGroggy" && (!eventTypeFilter || eventTypeFilter === "knock")) {
          if (isFF(e.attacker, e.victim) && (e.attacker!.name === player || e.victim!.name === player)) {
            events.push({
              matchId: m.match_id,
              mapName: m.map_name,
              gameMode: m.game_mode,
              matchCreatedAt: m.created_at,
              eventType: "knock",
              attacker: e.attacker!.name,
              victim: e.victim!.name,
              weapon: e.damageCauserName ? getWeaponName(e.damageCauserName) : null,
              timestamp: e._D,
            });
          }
        }
        if (e._T === "LogPlayerKillV2" && (!eventTypeFilter || eventTypeFilter === "kill")) {
          if (isFF(e.killer, e.victim) && (e.killer!.name === player || e.victim!.name === player)) {
            events.push({
              matchId: m.match_id,
              mapName: m.map_name,
              gameMode: m.game_mode,
              matchCreatedAt: m.created_at,
              eventType: "kill",
              attacker: e.killer!.name,
              victim: e.victim!.name,
              weapon: e.killerDamageInfo?.damageCauserName ? getWeaponName(e.killerDamageInfo.damageCauserName) : null,
              distance: e.killerDamageInfo?.distance ? e.killerDamageInfo.distance / 100 : undefined,
              timestamp: e._D,
            });
          }
        }
        if (e._T === "LogPlayerTakeDamage" && eventTypeFilter === "damage") {
          if (isFF(e.attacker, e.victim) && (e.attacker!.name === player || e.victim!.name === player)) {
            events.push({
              matchId: m.match_id,
              mapName: m.map_name,
              gameMode: m.game_mode,
              matchCreatedAt: m.created_at,
              eventType: "damage",
              attacker: e.attacker!.name,
              victim: e.victim!.name,
              weapon: e.damageCauserName ? getWeaponName(e.damageCauserName) : null,
              damage: e.damage,
              timestamp: e._D,
            });
          }
        }
      }
      processed++;
    } catch { /* skip */ }
  }

  const nextPage = (page + 1) * PAGE_SIZE < total ? page + 1 : null;

  return NextResponse.json({
    player,
    page,
    pageSize: PAGE_SIZE,
    matchesProcessed: processed,
    matchesInPage: matches.rows.length,
    totalMatchesInWindow: total,
    nextPage,
    events,
  });
}
