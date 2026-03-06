import { NextRequest, NextResponse } from "next/server";
import { getPlayerHistory } from "@/lib/db";
import { GameMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const player = searchParams.get("player");
  const mode = searchParams.get("mode") as GameMode;

  if (!player || !mode) {
    return NextResponse.json(
      { error: "Missing player or mode param" },
      { status: 400 }
    );
  }

  try {
    const history = await getPlayerHistory(player, mode);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("History error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
