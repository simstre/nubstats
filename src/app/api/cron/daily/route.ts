import { NextResponse } from "next/server";

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

function authHeaders(): HeadersInit {
  if (process.env.CRON_SECRET) {
    return { Authorization: `Bearer ${process.env.CRON_SECRET}` };
  }
  return {};
}

export async function GET() {
  const base = getBaseUrl();
  const headers = authHeaders();

  // Kick off fetch-stats step 0 — it chains to step 1 on its own.
  // Each step is its own serverless invocation, so no timeout issue.
  const statsRes = await fetch(`${base}/api/cron/fetch-stats?step=0`, { headers });
  const statsOk = statsRes.ok;

  // Kick off weapons step 0 — it chains to steps 1, 2 on its own.
  const weaponsRes = await fetch(`${base}/api/weapons?refresh=true&step=0`, { headers });
  const weaponsOk = weaponsRes.ok;

  return NextResponse.json({
    success: statsOk && weaponsOk,
    message: "Daily cron dispatched",
    stats: { status: statsRes.status },
    weapons: { status: weaponsRes.status },
  });
}
