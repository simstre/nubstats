import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 60;

function getBaseUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3007";
}

async function fireWithDelay(url: string, delayMs: number) {
  await new Promise((r) => setTimeout(r, delayMs));
  try {
    await fetch(url);
  } catch (err) {
    console.error(`Failed to fire ${url}:`, err);
  }
}

export async function GET() {
  const base = getBaseUrl();

  // Fire all steps for fetch-stats and weapons with staggered delays
  // fetch-stats: step 0 (immediate), step 1 (after 60s)
  // weapons: step 0 (after 150s), step 1 (after 210s), step 2 (after 270s)
  waitUntil(
    Promise.all([
      fetch(`${base}/api/cron/fetch-stats?step=0`).catch((e) => console.error("fetch-stats step 0:", e)),
      fireWithDelay(`${base}/api/cron/fetch-stats?step=1`, 70000),
      fireWithDelay(`${base}/api/weapons?refresh=true&step=0`, 150000),
      fireWithDelay(`${base}/api/weapons?refresh=true&step=1`, 210000),
      fireWithDelay(`${base}/api/weapons?refresh=true&step=2`, 270000),
    ])
  );

  return NextResponse.json({ success: true, message: "Daily cron dispatched" });
}
