import { NextRequest, NextResponse } from "next/server";
import { getAllLatestSnapshots, getPlayers, getSeasonsList, getSnapshotsBySeason } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  try {
    const [players, seasons] = await Promise.all([
      getPlayers(),
      getSeasonsList(),
    ]);

    const snapshots = season
      ? await getSnapshotsBySeason(season)
      : await getAllLatestSnapshots();

    return NextResponse.json({ players, snapshots, seasons });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
