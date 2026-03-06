import { NextResponse } from "next/server";
import { initDb, initWeaponTables } from "@/lib/db";

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    await initDb();
    await initWeaponTables();
    return NextResponse.json({ success: true, message: "Database initialized" });
  } catch (error) {
    console.error("DB init error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
