import { NextRequest, NextResponse } from "next/server";
import {
  getPlayerByName,
  getAllSeasons,
  getSeasonStats,
  getLifetimeStats,
} from "@/lib/pubg-api";
import { upsertPlayer, insertSnapshot, initDb, getExistingBackfillSeasons } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/types";

export const maxDuration = 300;

const RATE_LIMIT_MS = 6500; // ~9 requests per minute to stay under 10/min

async function rateLimitedWait() {
  await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    process.env.CRON_SECRET !== "dev-secret" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(msg: string) {
        controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
      }

      try {
        await initDb();
        send("Database initialized");

        const seasons = await getAllSeasons();
        send(`Found ${seasons.length} PC seasons`);
        await rateLimitedWait();

        const existing = await getExistingBackfillSeasons();
        send(`${existing.size} player/season combos already in DB`);

        for (const playerName of TRACKED_PLAYERS) {
          const player = await getPlayerByName(playerName);
          if (!player) {
            send(`${playerName}: NOT FOUND, skipping`);
            await rateLimitedWait();
            continue;
          }

          await upsertPlayer(player.name, player.id);
          send(`${playerName}: resolved (${player.id})`);
          await rateLimitedWait();

          // Lifetime stats
          const lifetimeStats = await getLifetimeStats(player.id);
          if (lifetimeStats?.squad && lifetimeStats.squad.roundsPlayed > 0) {
            try {
              await insertSnapshot(
                player.name, player.id, "lifetime", "squad", lifetimeStats.squad
              );
              send(`${playerName}: lifetime squad - ${lifetimeStats.squad.kills} kills, ${lifetimeStats.squad.roundsPlayed} games`);
            } catch {
              send(`${playerName}: lifetime squad - already exists`);
            }
          }
          await rateLimitedWait();

          // All seasons - skip already backfilled
          let skipped = 0;
          for (let i = 0; i < seasons.length; i++) {
            const season = seasons[i];
            const key = `${player.name}::${season.id}`;
            if (existing.has(key)) {
              skipped++;
              continue;
            }
            try {
              const seasonStats = await getSeasonStats(player.id, season.id);
              if (seasonStats?.squad && seasonStats.squad.roundsPlayed > 0) {
                try {
                  await insertSnapshot(
                    player.name, player.id, season.id, "squad", seasonStats.squad
                  );
                  send(`${playerName}: ${season.id} - ${seasonStats.squad.kills} kills, ${seasonStats.squad.roundsPlayed} games`);
                } catch {
                  send(`${playerName}: ${season.id} - already exists`);
                }
              } else {
                send(`${playerName}: ${season.id} - no squad data`);
              }
            } catch (err) {
              send(`${playerName}: ${season.id} - ERROR: ${err}`);
            }
            await rateLimitedWait();
          }
          if (skipped > 0) send(`${playerName}: skipped ${skipped} already-backfilled seasons`);

          send(`${playerName}: DONE`);
        }

        send("BACKFILL COMPLETE");
      } catch (err) {
        send(`FATAL ERROR: ${err}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
