# Plinko-on-Pi Backend

Backend services for **Plinko-on-Pi**.

The backend is responsible for game sessions, provably-fair game generation, player data, transactions, administrative operations, API authentication, and server-side validation.

> The backend is authoritative. Client-side values must never be trusted for game outcomes, balances, wagers, payouts, or cryptographic verification.

---

## Architecture

```text
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── schemas/
│   │
│   ├── auth/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── game/
│   ├── provably_fair/
│   ├── services/
│   ├── transactions/
│   ├── admin/
│   ├── utils/
│   └── server.*
│
├── tests/
├── migrations/
├── scripts/
├── .env.example
└── README.md

The exact directory layout may vary depending on the backend runtime.


---

Core Responsibilities

The backend handles:

Player authentication

Pi user/session validation

Game creation

Wager validation

Plinko board generation

Provably-fair result generation

Server-side payout calculation

Balance validation

Transaction processing

Game history

Player statistics

Administrative controls

Audit logging

Rate limiting

Health checks

API security



---

Security Model

The backend is the source of truth.

Never trust values supplied by the browser for:

balance
wager amount
payout
multiplier
game result
seed
transaction status
admin privileges
player identity

All important values must be independently validated on the server.


---

Provably Fair System

Plinko-on-Pi uses a deterministic cryptographic process for game outcomes.

A typical game uses:

server seed
client seed
nonce

The result is derived from these values using a cryptographically secure hash/HMAC construction.

Conceptually:

result = HMAC(
    server_seed,
    client_seed + nonce
)

The exact implementation is defined by the backend provably-fair module.

Server Seed

The server seed must remain secret while it is active.

It must never be returned to the client before the appropriate seed-reveal event.

Store only the server-seed hash publicly during the active period.

Example:

server seed:
    [SECRET]

server seed hash:
    8b7f...

The hash allows players to verify that the server seed was not changed after the commitment was published.


---

Game Lifecycle

A normal game follows this lifecycle:

REQUEST
   |
   v
VALIDATE PLAYER
   |
   v
VALIDATE WAGER
   |
   v
CREATE GAME
   |
   v
RESERVE BALANCE
   |
   v
GENERATE RESULT
   |
   v
CALCULATE PAYOUT
   |
   v
SETTLE GAME
   |
   v
RECORD TRANSACTION
   |
   v
RETURN RESULT

The client should never determine the payout.


---

Game Validation

Before accepting a wager, the backend should validate:

authenticated player

player account status

wager amount

minimum wager

maximum wager

available balance

game configuration

board configuration

request nonce/idempotency key

rate limits


Example validation:

wager > 0
wager >= minimum_wager
wager <= maximum_wager
wager <= available_balance

Invalid wagers must be rejected before game execution.


---

Idempotency

Game creation and financial operations must support idempotency.

Clients should provide an idempotency key when required:

Idempotency-Key: <unique-request-id>

A repeated request using the same key must not create multiple games or duplicate transactions.

Example:

request #1
    |
    +-- game created

request #2
    |
    +-- same idempotency key
    |
    +-- return existing game


---

API

The backend API should be versioned.

Example:

/api/v1


---

Health

GET /api/v1/health

Example response:

{
    "status": "ok",
    "service": "plinko-backend",
    "version": "1.0.0",
    "timestamp": "2026-08-17T00:00:00Z"
}


---

Player API

Get Current Player

GET /api/v1/player/me

Example:

{
    "id": "player-id",
    "username": "player",
    "balance": 125.50,
    "currency": "PI"
}


---

Player Balance

GET /api/v1/player/balance

Example:

{
    "balance": 125.50,
    "currency": "PI"
}


---

Game API

Create Game

POST /api/v1/games

Example request:

{
    "bet": 1.0,
    "rows": 12,
    "risk": "medium"
}

Example response:

{
    "id": "game_123",
    "status": "completed",
    "bet": 1.0,
    "multiplier": 2.4,
    "payout": 2.4,
    "currency": "PI"
}

The backend determines the actual result.


---

Get Game

GET /api/v1/games/:gameId


---

Game History

GET /api/v1/games/history

Supported parameters may include:

page
limit
from
to
status

Example:

GET /api/v1/games/history?page=1&limit=25


---

Provably Fair API

Current Seed Commitment

GET /api/v1/provably-fair/current

Example:

{
    "serverSeedHash": "8b7f...",
    "clientSeed": "player-seed",
    "nonce": 42
}

The active server seed itself must not be exposed.


---

Verify Game

POST /api/v1/provably-fair/verify

Example:

{
    "serverSeed": "...",
    "clientSeed": "...",
    "nonce": 42,
    "gameId": "game_123"
}

Example response:

{
    "valid": true,
    "gameId": "game_123",
    "result": {
        "path": "LRRLLRLR",
        "slot": 7,
        "multiplier": 2.4
    }
}


---

Transactions

All financial operations must be recorded.

A transaction should contain information equivalent to:

{
    "id": "tx_123",
    "playerId": "player_123",
    "type": "game_payout",
    "amount": 2.4,
    "currency": "PI",
    "status": "completed",
    "reference": "game_123",
    "createdAt": "2026-08-17T00:00:00Z"
}

Recommended transaction states:

pending
processing
completed
failed
cancelled

Financial records should be append-only whenever practical.


---

Administrative API

Administrative endpoints must require elevated authorization.

Example:

GET /api/v1/admin/dashboard

Possible dashboard response:

{
    "stats": {
        "totalPlayers": 1250,
        "activePlayers": 42,
        "totalGames": 98231,
        "totalWagered": 18342.12,
        "totalPaid": 17511.94,
        "platformProfit": 830.18,
        "pendingTransactions": 3,
        "failedTransactions": 1
    }
}


---

Admin Health

GET /api/v1/admin/health

Possible response:

{
    "database": {
        "status": "healthy",
        "latencyMs": 4
    },
    "api": {
        "status": "healthy",
        "latencyMs": 2
    },
    "gameEngine": {
        "status": "healthy"
    },
    "transactions": {
        "status": "healthy"
    }
}


---

Admin Games

GET /api/v1/admin/games

Supports administrative filtering such as:

player
gameId
status
date
minimumBet
maximumBet


---

Admin Transactions

GET /api/v1/admin/transactions

Administrators should be able to inspect:

transaction ID

player

type

amount

status

reference

timestamps

failure reason



---

Authentication

Authentication must be handled server-side.

Never accept:

{
    "isAdmin": true
}

from an untrusted client.

Administrative authorization must come from authenticated server-side identity and authorization rules.

Recommended authorization hierarchy:

PUBLIC
  |
PLAYER
  |
ADMIN
  |
SUPER_ADMIN

Every protected endpoint should verify the required role.


---

Rate Limiting

Rate limits should be applied to:

authentication
game creation
balance operations
transaction operations
provably-fair verification
admin APIs

Game creation should have a stricter limit than read-only endpoints.

Example policy:

GET endpoints:
    higher limit

POST /games:
    lower limit

financial operations:
    strict limit

admin endpoints:
    authenticated limit


---

Input Validation

Never pass raw client input directly into:

database queries

shell commands

file paths

HTML

logs

SQL

transaction operations


Validate and normalize all inputs.

Use parameterized database queries.


---

Error Responses

Use consistent JSON errors.

Example:

{
    "error": {
        "code": "INSUFFICIENT_BALANCE",
        "message": "Insufficient balance for this wager.",
        "requestId": "req_123"
    }
}

Recommended error codes include:

UNAUTHORIZED
FORBIDDEN
INVALID_REQUEST
INVALID_WAGER
INSUFFICIENT_BALANCE
GAME_NOT_FOUND
GAME_ALREADY_SETTLED
RATE_LIMITED
TRANSACTION_FAILED
SERVICE_UNAVAILABLE
INTERNAL_ERROR

Do not expose stack traces or internal database errors to clients.


---

Logging

Backend logs should include:

timestamp
request ID
route
authenticated user ID
operation
result
latency
error code

Never log:

passwords
private keys
server seeds
authentication tokens
session secrets
unencrypted financial credentials

Sensitive values must be redacted.


---

Audit Logging

Administrative and financial operations should be auditable.

Examples:

ADMIN_LOGIN
ADMIN_LOGOUT
ADMIN_USER_UPDATE
ADMIN_GAME_INSPECTION
ADMIN_CONFIG_CHANGE
TRANSACTION_CREATED
TRANSACTION_SETTLED
GAME_CREATED
GAME_SETTLED
SEED_ROTATED

An audit record should include:

{
    "id": "audit_123",
    "actorId": "admin_123",
    "action": "ADMIN_CONFIG_CHANGE",
    "resource": "game_config",
    "resourceId": "default",
    "timestamp": "2026-08-17T00:00:00Z"
}


---

Environment Variables

Create a local environment file from:

.env.example

Typical configuration:

NODE_ENV=development

PORT=3000

DATABASE_URL=

API_PREFIX=/api/v1

JWT_SECRET=

PI_API_URL=

PI_APP_ID=

PI_API_KEY=

SERVER_SEED=

SERVER_SEED_ROTATION_INTERVAL=

MIN_WAGER=0.01
MAX_WAGER=100

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

Never commit real secrets.

Add:

.env
.env.*
!.env.example

to .gitignore where appropriate.


---

Development

Install dependencies:

npm install

Start development mode:
```
cd backend
npm run db:migrate
npm run dev
```
Run production:
```
npm start
```
Run tests:
```
npm test
```
Run linting:
```
npm run lint
```
Run formatting:
```
npm run format
```

---

Database

Database migrations should be version controlled.

Typical migration workflow:
```
npm run migrate
```
Rollback:
```
npm run migrate:rollback
```
Never modify production schemas manually without a migration.


---

Testing

The backend should have tests covering:

authentication
authorization
game generation
provably-fair verification
wager validation
payout calculation
balance accounting
transaction idempotency
rate limiting
admin authorization
API error handling
database operations

Critical game and financial logic should have deterministic unit tests.


---

Game Integrity Requirements

The following rules are mandatory:

1. The client cannot determine the game result.


2. The client cannot determine the payout.


3. The client cannot modify its balance.


4. Server seeds remain secret until revealed.


5. Server-seed commitments cannot be modified after publication.


6. Every settled game has a unique ID.


7. Every financial operation has a unique transaction ID.


8. Duplicate requests cannot create duplicate financial operations.


9. Game settlement is atomic.


10. Administrative actions are audited.




---

Atomic Game Settlement

Game settlement should behave as one logical operation:

BEGIN
  |
  +-- validate game
  |
  +-- validate balance reservation
  |
  +-- calculate result
  |
  +-- calculate payout
  |
  +-- update player balance
  |
  +-- create transaction
  |
  +-- mark game settled
  |
COMMIT

If a critical operation fails:

ROLLBACK

This prevents partial balance updates.


---

Deployment

Production deployment should include:

HTTPS

secure environment variables

production database

database backups

structured logging

monitoring

rate limiting

CORS configuration

secure headers

authentication

authorization

health checks


The backend should fail closed when security configuration is missing.

For example:

missing ADMIN_SECRET
        |
        v
do not start admin API

rather than:

missing ADMIN_SECRET
        |
        v
disable authentication


---

Health Check

The service should expose a lightweight health endpoint:

GET /api/v1/health

A deeper administrative health endpoint can verify:

database
cache
game engine
transaction service
Pi integration
background workers


---

Production Checklist

Before production:

[ ] Authentication enabled

[ ] Admin authorization enabled

[ ] HTTPS enabled

[ ] Database migrations applied

[ ] Database backups configured

[ ] Rate limiting enabled

[ ] CORS restricted

[ ] Secure headers enabled

[ ] Secrets stored outside source control

[ ] Server seed protected

[ ] Provably-fair verification tested

[ ] Game settlement tested

[ ] Transaction idempotency tested

[ ] Balance accounting tested

[ ] Audit logging enabled

[ ] Error responses sanitized

[ ] Monitoring enabled

[ ] Health checks working

[ ] Automated tests passing



---

Development Principles

The backend follows these principles:

Security first
Server authoritative
Deterministic game verification
Atomic financial operations
Explicit validation
Least privilege
Auditable administration
Fail closed
No client-side trust


---

License

Private project.

All rights reserved.
