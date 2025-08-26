# 🎰 Plinko on Pi

A Web3-enabled Plinko game DApp built to run in the Pi Browser.  
Players bet Pi Coins, release a ball onto a physics-based Plinko board, and win prizes depending on where the ball lands. The platform implements a configurable house edge and secure server-side settlement to ensure fair, auditable play.

This README has been rewritten for clarity, reliability, and easier contributor onboarding.

---

Table of contents
- [Why this project](#why-this-project)
- [Live demo / screenshots](#live-demo--screenshots)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Quick start (development)](#quick-start-development)
- [Environment variables](#environment-variables)
- [Running with Docker (recommended for dev/prod parity)](#running-with-docker-recommended-for-devprod-parity)
- [Backend API (summary)](#backend-api-summary)
- [Database notes & indexing](#database-notes--indexing)
- [Security & fairness](#security--fairness)
- [Testing & CI](#testing--ci)
- [Contributing](#contributing)
- [License & credits](#license--credits)

---

Why this project
- Targeted for Pi Browser users who want a native-feeling Web3 game experience.
- Focus on server-side verification to prevent client tampering.
- Lightweight frontend that runs in constrained browser environments.

Live demo / screenshots
- (Add screenshots or a link to a deployed demo here.)
- Example: https://your-deployment.example.com

---

Features
- Physics-driven gameplay using Matter.js for deterministic, tunable behavior.
- Pi Network SDK integration for authentication and payments.
- Server-side bet resolution and ledgering (Node.js + Express).
- MongoDB for durable logs and bet history.
- Leaderboard that ranks players by total winnings.
- Responsive UI designed for the Pi Browser.

---

Tech stack
- Frontend: Vanilla HTML/CSS/JS, Matter.js, Pi Network JS SDK
- Backend: Node.js, Express
- Database: MongoDB (Atlas recommended)
- Deployment: Docker / Heroku / Render / VPS (examples included below)

---

Project layout (high level)
plinko-dapp/
├─ frontend/            # Static game UI and client code
│  ├─ index.html
│  ├─ css/
│  ├─ js/
│  └─ libs/             # third-party libs (e.g. matter.js)
├─ backend/             # Express API and settlement logic
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ services/      # payment, randomness, balance checks
│  │  ├─ models/
│  │  └─ index.js
│  ├─ test/
│  └─ Dockerfile
├─ docker-compose.yml
└─ README.md

---

Quick start (development)

Prerequisites
- Node 18+ (or LTS)
- npm 8+ or yarn
- MongoDB (local or Atlas)
- Pi Browser for client testing (or Pi Browser Developer tools)

Clone
```bash
git clone https://github.com/erikg713/Plinko-on-Pi.git
cd Plinko-on-Pi
```

Install & run backend
```bash
cd backend
cp .env.example .env   # edit .env with real values
npm ci                 # or yarn install
npm run dev            # starts nodemon for development
# server available at http://localhost:5000 (default)
```

Install & run frontend (static)
- The frontend is a static site. For development, open frontend/index.html in Pi Browser or serve it locally:

Using a simple static server:
```bash
cd frontend
npx serve -s . -l 3000
# open http://localhost:3000 in Pi Browser (or mobile device)
```

Production build / deploy
- Frontend: host the frontend/ folder on Netlify, Vercel, or Pi Dev Portal.
- Backend: deploy backend/ to Render, Heroku, or a VPS. Use environment variables and HTTPS.

---

Environment variables

Create backend/.env with the following values (example):
```env
# Pi Network
PI_API_KEY=your_pi_api_key_here
PI_API_SECRET=your_pi_api_secret_here

# MongoDB
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/plinko?retryWrites=true&w=majority

# Server
PORT=5000
NODE_ENV=development

# Game configuration (overrideable)
HOUSE_EDGE_PERCENT=5         # house edge percent (0-100)
MIN_BET_PICO=1000000         # minimum bet (in pico units if applicable)
MAX_BET_PICO=1000000000      # maximum bet

# Optional
LOG_LEVEL=info
```

Always keep secrets out of source control. Use your cloud provider's secret manager or GitHub Actions secrets for CI/CD.

---

Running with Docker (recommended for dev/prod parity)

docker-compose.yml (example)
- Place / adapt the repository's docker-compose.yml to run the backend + a Mongo service or connect to Atlas.

Quick example:
```bash
docker-compose up --build
```

This will:
- Build and run the backend service
- Start a MongoDB instance (if using the local compose file)

---

Backend API (summary)
Note: All financial operations are verified server-side. Routes below are examples — consult the code for exact routes.

- POST /api/auth/pi-login
  - Exchange Pi SDK token and issue a server session token.

- POST /api/bets/place
  - Body: { playerId, betAmount, riskSeed }
  - Server: validate balance via Pi API, store a pending bet, compute outcome server-side, settle payment, update ledger.

- GET /api/bets/:playerId
  - Returns recent bets for a player.

- GET /api/leaderboard
  - Returns top players (cached and rate-limited).

- GET /api/health
  - Liveness and readiness checks for orchestrators.

Best practices:
- Rate limit endpoints (IP + user).
- Authenticate requests via signed tokens and validate tokens with Pi Network for payments.
- Use idempotency keys for bet placement to avoid double-settling.

---

Database notes & indexing
- Collections: users, bets, payouts, logs.
- Recommended indexes:
  - bets: { playerId: 1, createdAt: -1 } for history queries.
  - bets: { status: 1, createdAt: 1 } for settlement workers.
  - users: { totalWinnings: -1 } for leaderboard queries (or maintain a separate leaderboard collection).
- Use capped collections or TTL indexes for ephemeral logs if needed.
- Consider sharding in production if traffic grows.

---

Randomness & fairness
- Deterministic physics + server-side confirmation:
  - Client submits a preimage/seed when dropping a ball.
  - Server uses a combination of player seed + server secret (HMAC) to compute the final randomized offsets and resolves the outcome deterministically.
  - Store seeds and results for auditability.
- Audit tools:
  - Export bet logs with seeds and HMACs so players or auditors can verify individual rounds.

---

Security & best practices
- Never trust client-sent outcomes — always resolve and sign outcomes server-side.
- Validate Pi Network payment confirmations on the server using server-side credentials.
- Use HTTPS and secure cookies / HTTP-only tokens for sessions.
- Enforce strong rate limits and monitoring; log suspicious activity.
- Secrets: keep them in environment variables or secret manager; never commit them.

---

Testing & CI
- Add unit tests for settlement logic (deterministic outcomes), edge calculations, and payment verification.
- End-to-end tests should mock Pi Network responses where possible.
- Example CI checks:
  - lint (ESLint)
  - unit tests (Jest / Mocha)
  - build step for frontend
  - container build (docker build) to detect runtime errors early

---

Configuration & tuning
- House edge:
  - Configurable via HOUSE_EDGE_PERCENT.
  - Keep the edge small and transparent; log and display the edge in the UI.
- Payout table:
  - Define payout buckets server-side as a single source of truth and expose read-only to the client.

---

Contributing
- Please read CONTRIBUTING.md (add one) and CODE_OF_CONDUCT.md (add one).
- Suggested workflow:
  - Fork -> feature branch -> open PR with tests and changelog entry.
  - Keep changes small and focused. Add tests for deterministic game logic.

---

Maintenance checklist for operators
- Monitor: errors, suspicious patterns, payout amounts.
- Backup: daily snapshot of MongoDB and archived logs.
- Key rotation: rotate Pi API keys and secrets periodically.
- Audit: regular checks that house edge config and payout table match public statements.

---

License & credits
- MIT License © 2025 — Built for the Pi Network Ecosystem
- See LICENSE for details.

---
