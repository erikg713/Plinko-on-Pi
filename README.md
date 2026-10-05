# Plinko-on-Pi

A Plinko betting game for the Pi Network, built for the Pi Browser.
Players sign in with Pi, fund each bet with a real Pi payment, and
winnings land in an in-app balance that can be withdrawn to their
Pi wallet.

## How it works

1. **Sign in** — `Pi.authenticate(["username", "payments"])`; the
   access token is verified server-side via `GET api.minepi.com/v2/me`.
2. **Commit** — the server creates a provably-fair round and publishes
   only `sha256(serverSeed)`. The seed is stored server-side.
3. **Pay** — the player approves a Pi payment (U2A) in their wallet.
   The server approves (`/payments/approve`) and completes
   (`/payments/complete`) it against the Pi Platform API, verifying
   the txid itself.
4. **Settle** — `POST /bets` settles the wager **only** against that
   completed Pi payment (1:1 link, enforced with row locks). The ball
   path is derived server-side from
   `HMAC-SHA256(serverSeed, clientSeed + "-" + nonce)`. The client
   never decides the outcome.
5. **Reveal** — the server seed is revealed at settlement, so every
   round is verifiable via `GET /provably-fair/:gameId` or
   `POST /provably-fair/verify`.
6. **Withdraw** — winnings move back to the Pi wallet (A2U transfer;
   currently the on-chain call is a marked TODO — withdrawals stay
   `pending` until it is wired).

## Run it

### Backend

```bash
cd backend
cp .env.example .env        # fill in PI_API_KEY etc.
npm install
npm test                   # 23 tests
npm run db:migrate          # needs DATABASE_URL
npm start                   # http://localhost:3000
```

Or with Docker (postgres + backend):

```bash
docker compose up --build
```

### Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL, VITE_PI_SANDBOX
npm install
npm run dev                 # http://localhost:5173
npm run build               # production build
```

The app must be opened in the **Pi Browser** for the Pi SDK to work.
Set `VITE_PI_SANDBOX=true` for Test-Pi.

## Environment variables

Backend (`backend/.env`): `PORT`, `DATABASE_URL`, `PI_API_KEY`,
`PI_API_URL` (default `https://api.minepi.com`), `PI_APP_ID`,
`JWT_SECRET`, `SESSION_SECRET`, `CORS_ORIGIN`.

Frontend (`frontend/.env`): `VITE_API_URL`, `VITE_PI_SANDBOX`.

Never commit `.env` files. A root `.env` with a leaked
`ADMIN_API_KEY` was previously committed to this repo's history —
**rotate that key**; the file is now untracked and git-ignored.

## Project layout

```
backend/
  server.js            Express bootstrap
  config.js            validated env config (fails closed)
  db.js                pg pool + transactions
  lib/
    piApi.js           Pi Platform API client (server key)
    provablyFair.js    HMAC-SHA256 commit/reveal/verify
  routes/
    auth.js            Pi login (server-side token verification)
    payments.js        approve / complete / reconcile / list
    bets.js            payment-linked, server-side settlement
    provablyFair.js    commit / round / verify
    wallet.js          balance, transactions, withdraw (pending)
    leaderboard.js     rankings
    admin.js           admin endpoints
    users.js           profiles
  migrations/          001–009, single schema source of truth
  tests/               node:test suite (23 passing)
frontend/
  src/
    App.jsx            login, bet flow, results
    api.js             backend client
    components/
      PlinkoBoard.jsx  canvas board + path animation
      Wallet.jsx       balance + withdraw
      Leaderboard.jsx  top winners
```

## Still TODO

- **Pi Developer Portal**: register the app at `pi://develop.pi`,
  complete the app checklist, serve `validation-key.txt` from the
  frontend root for domain verification.
- **Testnet end-to-end**: run the full loop (auth → payment →
  settle → withdraw) in the Pi Browser sandbox with Test-Pi.
- **Withdrawals**: wire the A2U `POST /payments` call in
  `backend/routes/wallet.js` (marked TODO); keep it `pending`
  until the Pi Platform confirms.
- **Mainnet**: separate Portal app registration, KYC'd wallets,
  real `PI_API_KEY` via a secrets manager.
- **Policy**: this is a gambling dApp — Pi's app policies and
  jurisdictional gambling law apply regardless of code quality.
- Rotate the previously leaked `ADMIN_API_KEY` (see above).
