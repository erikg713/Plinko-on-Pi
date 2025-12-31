# EdgeRush Backend

**Server for EdgeRush – Ultimate Provably Fair Plinko dApp on Pi Network**

Node.js/Express backend powering real-time bets, provably fair outcomes, seed rotation, admin API, and secure bet/payout logging. Designed for high-volume degen action – 99% RTP, 1% house edge, Rollbit-grade fairness.

Handles:
- Provably fair outcome generation (HMAC-SHA256)
- Server seed storage & rotation (encrypted)
- Bet history & real-time stats
- Webhook endpoints for frontend/admin
- Future: Pi SDK server-side payment approval/completion

## 🚀 Tech Stack

- **Node.js** v20+
- **Express.js** – Fast API routes
- **MongoDB** – Bet logs, seeds, players (via Mongoose)
- **Crypto-js** – SHA256/HMAC for provably fair
- **dotenv** – Env config
- **cors** & **helmet** – Security basics
- **socket.io** (planned) – Real-time dashboard updates

## 📂 Project Structure
```
backend/ ├── src/ │   ├── routes/         # API endpoints │   ├── controllers/    # Business logic │   ├── models/         # Mongoose schemas (Bet, Seed, Player) │   ├── utils/          # Provably fair generator, hash utils │   ├── middleware/     # Auth, error handling │   └── server.js       # Express app bootstrap ├── .env                # Secrets (DB_URI, JWT_SECRET, etc.) ├── package.json └── README.md
```
---
## ⚙️ Quick Start

1. Clone & enter:
   ```bash
   git clone https://github.com/yourusername/edgerush.git
   cd edgerush/backend
   ```
   npm install
   PORT=5000
MONGO_URI=mongodb://localhost:27017/edgerush
JWT_SECRET=your_super_secure_jwt_secret_here
CURRENT_SERVER_SEED=initial_random_64_hex_seed_here
NODE_ENV=development
node utils/generateSeed.js
u
npm run dev    # nodemon for hot reload
# or
npm start
