import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  getPlayerByName,
  getCurrentSeason,
  getLifetimeStats,
  getSeasonStats,
} from "@/lib/pubg-api";
import { upsertPlayer, insertSnapshot, initDb, getPlayerFromDb } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/types";

export const maxDuration = 60;

const RATE_LIMIT_MS = 6000;
const BATCH_SIZE = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    process.env.CRON_SECRET !== "dev-secret" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const step = parseInt(searchParams.get("step") || "0");
  const start = step * BATCH_SIZE;
  const batch = TRACKED_PLAYERS.slice(start, start + BATCH_SIZE);

  if (batch.length === 0) {
    return NextResponse.json({ success: true, message: "No more players to process" });
  }

  try {
    await initDb();
    const seasonId = await getCurrentSeason();
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    const results: Record<string, string> = {};

    for (const playerName of batch) {
      try {
        // Use DB for player ID, fallback to API
        const dbPlayer = await getPlayerFromDb(playerName);
        let playerId: string | null = null;

        if (dbPlayer) {
          playerId = dbPlayer.pubgId;
        } else {
          const apiPlayer = await getPlayerByName(playerName);
          if (apiPlayer) {
            playerId = apiPlayer.id;
            await upsertPlayer(apiPlayer.name, apiPlayer.id);
          }
          await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
        }

        if (!playerId) {
          results[playerName] = "Player not found";
          continue;
        }

        const lifetimeStats = await getLifetimeStats(playerId);
        if (lifetimeStats?.squad && lifetimeStats.squad.roundsPlayed > 0) {
          await insertSnapshot(
            playerName, playerId, "lifetime", "squad", lifetimeStats.squad
          );
        }
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

        if (seasonId) {
          const seasonStats = await getSeasonStats(playerId, seasonId);
          if (seasonStats?.squad && seasonStats.squad.roundsPlayed > 0) {
            await insertSnapshot(
              playerName, playerId, seasonId, "squad", seasonStats.squad
            );
          }
          await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
        }

        results[playerName] = "OK";
      } catch (err) {
        results[playerName] = String(err);
      }
    }

    // Chain next batch
    const nextStart = (step + 1) * BATCH_SIZE;
    if (nextStart < TRACKED_PLAYERS.length) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : new URL(request.url).origin;
      const nextUrl = `${baseUrl}/api/cron/fetch-stats?step=${step + 1}`;
      const headers: HeadersInit = {};
      if (process.env.CRON_SECRET) {
        headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
      }
      waitUntil(fetch(nextUrl, { headers }).catch((err) => console.error("Chain failed:", err)));
    }

    return NextResponse.json({ success: true, step, results });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
