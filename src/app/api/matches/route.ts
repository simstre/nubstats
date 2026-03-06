import { NextResponse } from "next/server";
import { getPlayerWithMatches, getMatch } from "@/lib/pubg-api";
import { TRACKED_PLAYERS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    // Get match IDs from all players — fetch sequentially with rate limit
    const allMatchIds = new Set<string>();

    for (const name of TRACKED_PLAYERS) {
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

    // Fetch details for unique matches (limit to most recent 10)
    const matchIds = [...allMatchIds].slice(0, 10);
    const matches = [];

    for (const matchId of matchIds) {
      try {
        const match = await getMatch(matchId);
        if (match) {
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
      } catch (err) {
        console.error(`Failed to fetch match ${matchId}:`, err);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

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
