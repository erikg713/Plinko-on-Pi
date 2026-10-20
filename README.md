# Plinko-on-Pi — Skill Edition

A Plinko **skill game** for the Pi Network, built for the Pi Browser.

**There is no betting here.** No wagers, no stakes, no payouts, no
withdrawals. Players sign in with Pi, aim each drop (drop position +
release timing), and score **points**. Pi payments exist only for
fixed-price store items — extra drop packs and cosmetic board themes —
and buying never affects scoring.

## How it works

1. **Sign in** — `Pi.authenticate(["username", "payments"])`; the
   access token is verified server-side via `GET api.minepi.com/v2/me`.
2. **Aim** — pick a drop position on the slider. Each run, the server
   assigns a random target bin (shown in gold).
3. **Release** — time your release on the sweep meter. Releasing near
   the center earns an aim bonus.
4. **Score** — the ball falls according to your aim, simulated on
   your device. The server verifies the submission (path matches the
   claimed bin, run is fresh, rate limits hold) and scores it in
   **points only**:
   - base points from the bin landed in (edge bins score more)
   - +50% for hitting the target bin
   - +5% per consecutive target hit (streak, caps at +50%)
   - up to +25% for release-timing accuracy
5. **Leaderboards** — top scorers, best streaks, sharpest aim.
   Points are scores only; they can't become Pi.

Drops are free and regenerate over time (20 max, +1 per 5 minutes).
The store sells drop packs (10 drops = 1 Pi, 50 drops = 4 Pi) and
cosmetic board themes (2–5 Pi) at fixed prices. One completed Pi
payment grants exactly one item — the same anti-double-spend
guarantee the old wager flow used, repurposed for purchases.

## Why this is not gambling

- Nothing of value is ever staked on a chance outcome — not Pi,
  not money, not anything.
- Winning scores pay out nothing. There is no mechanism anywhere
  in the code that converts points to Pi or lets a player cash out.
- The old wager settlement (`POST /bets`), the winnings wallet,
  withdrawals, and the provably-fair payout machinery were removed
  (see branch `skill-game-rework`).
- This rework is built to satisfy Pi's policy against chance-based
  wagering; approval remains Pi's decision.

## Project layout

```
frontend/          React + Vite app (Pi Browser)
  src/
    App.jsx            Skill-game flow (aim → release → score)
    api.js             Backend API client
    components/
      PlinkoBoard.jsx  Canvas board: point bins, target ring, aim marker, themes
      Store.jsx        Drop packs + cosmetic themes (fixed-price Pi)
      Leaderboard.jsx  Skill boards (points only)
backend/           Express API (Node 20+)
  server.js
  config.js          Skill/drop/store tuning (no wager config)
  routes/
    auth.js        Pi sign-in (unchanged)
    payments.js    Pi U2A approve/complete/reconcile (unchanged mechanics)
    runs.js        Skill runs: start / submit / history (points only)
    store.js       Fixed-price catalog + purchase grants
    wallet.js      Drop inventory + themes + purchase history (no money)
    leaderboard.js Skill leaderboards (points only)
    users.js       Public player skill profiles
    admin.js       Ops dashboard (skill metrics + moderation)
    health.js
  migrations/
    010_skill_game.sql   skill_runs, skill_stats, drop_inventory, store_purchases
db/tables/         Table definitions (skill_* additions)
```

## Running it

```bash
# backend
cd backend
cp ../.env.example .env   # fill in DATABASE_URL, JWT_SECRET, PI_API_KEY
npm install
npm run db:migrate
npm run dev

# frontend
cd frontend
npm install
npm run dev        # or: npm run build
```

Open the frontend in the Pi Browser (or desktop with the Pi SDK
unavailable you'll get a notice). Set `VITE_API_URL` to point at the
backend, and `VITE_PI_SANDBOX=true` for Test-Pi.

## API summary (skill game)

| Method | Path | Auth | What |
|---|---|---|---|
| POST | /api/v1/auth/login | no | Pi access token → session |
| POST | /api/v1/runs/start | yes | consume 1 drop, get target bin |
| POST | /api/v1/runs/submit | yes | submit path+bin+timing → points |
| GET | /api/v1/runs | yes | run history |
| GET | /api/v1/store/catalog | no | fixed-price items |
| POST | /api/v1/store/purchase | yes | redeem completed Pi payment |
| POST | /api/v1/payments/approve | yes | Pi U2A approval |
| POST | /api/v1/payments/complete | yes | Pi U2A completion |
| POST | /api/v1/payments/reconcile | yes | finish stranded payments |
| GET | /api/v1/wallet | yes | drops, themes, purchases |
| GET | /api/v1/leaderboard/top-scorers | no | skill board |
| GET | /api/v1/leaderboard/best-streaks | no | skill board |
| GET | /api/v1/leaderboard/sharpest-aim | no | skill board |

## Security notes

- Every Pi payment state change is verified against the Pi Platform
  API with the server API key; the client is never trusted about
  payment status.
- One completed Pi payment grants exactly one store item
  (row-locked, idempotent).
- Run submissions are verified server-side: the bin is recomputed
  from the submitted path, runs expire after 5 minutes, each run
  scores once, and hourly caps + streak anomaly flags keep the
  leaderboards honest.
- Never commit a real `.env` — the October 2025 audit found a real
  admin API key committed at the repo root; rotate it if it hasn't
  been rotated since.
