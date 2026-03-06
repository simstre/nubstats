import { NextRequest, NextResponse } from "next/server";
import {
  getPlayerByName,
  getAllSeasons,
  getSeasonStats,
  getLifetimeStats,
} from "@/lib/pubg-api";
import { upsertPlayer, insertSnapshot, initDb, getExistingBackfillSeasons } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/types";

export const maxDuration = 60;

const RATE_LIMIT_MS = 6500;
const SEASONS_PER_STEP = 6;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerIdx = parseInt(searchParams.get("player") || "0");
  const step = parseInt(searchParams.get("step") || "0");

  if (playerIdx >= TRACKED_PLAYERS.length) {
    return NextResponse.json({ success: true, message: "BACKFILL COMPLETE" });
  }

  const playerName = TRACKED_PLAYERS[playerIdx];

  try {
    await initDb();

    const seasons = await getAllSeasons();
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

    const existing = await getExistingBackfillSeasons();

    const player = await getPlayerByName(playerName);
    if (!player) {
      // Skip to next player
      const url = new URL(request.url);
      url.searchParams.set("player", String(playerIdx + 1));
      url.searchParams.set("step", "0");
      fetch(url.toString()).catch(() => {});
      return NextResponse.json({ success: true, player: playerName, message: "NOT FOUND, skipping" });
    }

    await upsertPlayer(player.name, player.id);
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

    // On first step for this player, fetch lifetime stats
    if (step === 0) {
      const lifetimeStats = await getLifetimeStats(player.id);
      if (lifetimeStats?.squad && lifetimeStats.squad.roundsPlayed > 0) {
        try {
          await insertSnapshot(player.name, player.id, "lifetime", "squad", lifetimeStats.squad);
        } catch { /* already exists */ }
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    // Process a chunk of seasons
    const seasonStart = step * SEASONS_PER_STEP;
    const seasonBatch = seasons.slice(seasonStart, seasonStart + SEASONS_PER_STEP);
    const results: string[] = [];
    let skipped = 0;

    for (const season of seasonBatch) {
      const key = `${player.name}::${season.id}`;
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      try {
        const seasonStats = await getSeasonStats(player.id, season.id);
        if (seasonStats?.squad && seasonStats.squad.roundsPlayed > 0) {
          try {
            await insertSnapshot(player.name, player.id, season.id, "squad", seasonStats.squad);
            results.push(`${season.id}: OK`);
          } catch {
            results.push(`${season.id}: exists`);
          }
        }
      } catch (err) {
        results.push(`${season.id}: ERROR ${err}`);
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    // Determine next action: more seasons for this player, or next player
    const nextSeasonStart = (step + 1) * SEASONS_PER_STEP;
    const url = new URL(request.url);

    if (nextSeasonStart < seasons.length) {
      // More seasons for this player
      url.searchParams.set("player", String(playerIdx));
      url.searchParams.set("step", String(step + 1));
    } else {
      // Next player
      url.searchParams.set("player", String(playerIdx + 1));
      url.searchParams.set("step", "0");
    }
    fetch(url.toString()).catch(() => {});

    return NextResponse.json({
      success: true,
      player: playerName,
      step,
      skipped,
      results,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
