# PUBG NUB

Squad stats tracker for the NUB crew. Tracks lifetime stats, per-season history, weapon usage, death causes, and recent matches from the PUBG API.

**Live:** https://pubg-tracker-six.vercel.app

## Features

- **Leaderboard** — Compare squad members across K/D, kills/game, damage/game, win rate, and more
- **Player Stats** — Detailed per-player stats with per-game breakdowns
- **Recent Matches** — Match history with per-player performance
- **Weapons** — Weapon stats from match telemetry (kills, damage, accuracy, kill distance)
- **Deaths** — Death cause tracking from match telemetry
- **History** — Season-over-season trends charted for all players

## Tech Stack

- Next.js 15 (App Router)
- PostgreSQL (Neon)
- PUBG API
- Tailwind CSS
- Deployed on Vercel (free tier)

## Data Pipeline

- **Daily cron (11:00 UTC):** Fetches current season + lifetime stats for all players
- **Daily cron (11:30 UTC):** Processes match telemetry for weapon/death stats and stores match details
- All long-running jobs are batched into chained serverless functions (< 60s each) for Vercel free tier compatibility

## Tracked Players

Silvertibby · alhole · RetroGames84 · Musaz · EmitMaj · xxXDRAMAXxx
