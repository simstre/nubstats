import { NextRequest, NextResponse } from "next/server";
import {
  getPlayerByName,
  getCurrentSeason,
  getLifetimeStats,
  getSeasonStats,
} from "@/lib/pubg-api";
import { upsertPlayer, insertSnapshot, initDb } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/types";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    process.env.CRON_SECRET !== "dev-secret" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDb();
    const seasonId = await getCurrentSeason();
    const results: Record<string, string> = {};

    for (const playerName of TRACKED_PLAYERS) {
      try {
        const player = await getPlayerByName(playerName);
        if (!player) {
          results[playerName] = "Player not found";
          continue;
        }

        await upsertPlayer(player.name, player.id);

        const lifetimeStats = await getLifetimeStats(player.id);
        if (lifetimeStats?.squad && lifetimeStats.squad.roundsPlayed > 0) {
          await insertSnapshot(
            player.name, player.id, "lifetime", "squad", lifetimeStats.squad
          );
        }

        if (seasonId) {
          const seasonStats = await getSeasonStats(player.id, seasonId);
          if (seasonStats?.squad && seasonStats.squad.roundsPlayed > 0) {
            await insertSnapshot(
              player.name, player.id, seasonId, "squad", seasonStats.squad
            );
          }
        }

        results[playerName] = "OK";
        // Rate limit: 10 req/min, each player = 3 calls, wait 20s between players
        await new Promise((r) => setTimeout(r, 20000));
      } catch (err) {
        results[playerName] = String(err);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
