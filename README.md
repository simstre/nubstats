# PUBG NUB

Squad stats tracker for the NUB crew. Tracks lifetime stats, per-season history, weapon usage, death causes, and recent matches from the PUBG API.

**Live:** https://pubg-tracker-six.vercel.app

<img width="1293" height="849" alt="Screenshot 2026-03-06 at 3 31 35 PM" src="https://github.com/user-attachments/assets/3fa7b96f-2a4b-468c-a7b3-b62ff4e72de4" />
<img width="1283" height="775" alt="Screenshot 2026-03-06 at 3 32 03 PM" src="https://github.com/user-attachments/assets/25c3c6ac-f426-4001-9fb9-fc438121387b" />
<img width="1331" height="773" alt="Screenshot 2026-03-06 at 3 33 02 PM" src="https://github.com/user-attachments/assets/1467fcad-3a91-458c-bc1c-0271aec65217" />


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
