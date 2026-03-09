import { NextResponse } from "next/server";
import { initWeaponTables, getRecentMatches } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initWeaponTables();
    const rows = await getRecentMatches(30);

    const matches = rows.map((row) => {
      const participants = row.participants as Array<Record<string, unknown>>;
      const trackedParticipants = participants.filter((p) =>
        TRACKED_PLAYERS.includes(p.name as string)
      );
      return {
        id: row.match_id,
        mapName: row.map_name,
        gameMode: row.game_mode,
        duration: row.duration,
        createdAt: row.created_at,
        trackedParticipants,
        totalParticipants: participants.length,
      };
    });

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Matches error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
