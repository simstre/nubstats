import { NextResponse } from "next/server";
import { getClanInfo } from "@/lib/pubg-api";

export const dynamic = "force-dynamic";

const CLAN_ID = "clan.8005d690533444f08793601106940caf";

export async function GET() {
  try {
    const clan = await getClanInfo(CLAN_ID);
    if (!clan) {
      return NextResponse.json({ error: "Clan not found" }, { status: 404 });
    }
    return NextResponse.json({ clan });
  } catch (error) {
    console.error("Clan error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
