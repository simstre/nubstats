import { NextRequest, NextResponse } from "next/server";
import { getMapStatsByPlayer, initWeaponTables } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const player = searchParams.get("player");

  if (!player || !TRACKED_PLAYERS.includes(player)) {
    return NextResponse.json({ error: "Invalid or missing player" }, { status: 400 });
  }

  try {
    await initWeaponTables();
    const rows = await getMapStatsByPlayer(player);
    return NextResponse.json({ player, maps: rows });
  } catch (error) {
    console.error("Map stats error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
