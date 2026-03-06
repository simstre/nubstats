import { NextResponse } from "next/server";
import { getPlayerWithMatches, getMatch } from "@/lib/pubg-api";
import { TRACKED_PLAYERS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    // Get match IDs from all players
    const allMatchIds = new Set<string>();
    const playerMatchMap: Record<string, string[]> = {};

    for (const name of TRACKED_PLAYERS) {
      const player = await getPlayerWithMatches(name);
      if (player) {
        playerMatchMap[name] = player.matchIds;
        for (const id of player.matchIds) {
          allMatchIds.add(id);
        }
      }
      // Rate limit
      await new Promise((r) => setTimeout(r, 6500));
    }

    // Fetch details for unique matches (limit to most recent 10 to avoid rate limits)
    const matchIds = [...allMatchIds].slice(0, 10);
    const matches = [];

    for (const matchId of matchIds) {
      const match = await getMatch(matchId);
      if (match) {
        // Only include participants that are tracked players
        const trackedParticipants = match.participants.filter((p) =>
          TRACKED_PLAYERS.includes(p.name)
        );
        matches.push({
          ...match,
          participants: match.participants,
          trackedParticipants,
          totalParticipants: match.participants.length,
        });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Sort by date descending
    matches.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Matches error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
