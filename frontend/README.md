# Pi Plinko

![Pi Network Logo](assets/pi-logo.png)

**🏆 Drop balls. Chase multipliers. Win Pi. Provably fair. Pi Network adoption in action.**

## The Vision

Pi Plinko is a **mobile-first gambling dApp** built exclusively for the Pi Network ecosystem. This project demonstrates:

1. **Real economic utility** – Pioneers bet actual Pi currency via SDK, watching live payouts.
2. **Scalable engagement** – Addictive Plinko mechanics drive user retention and platform adoption.
3. **Cryptographic fairness** – Full verifiable randomization using client/server seed hashing (same tech as Stake.com, BC.Game).
4. **Lightweight Pi Browser integration** – Vanilla JS + Canvas means fast load times and zero bloat.

**Why judges should care:** This isn't a toy. It's a production-ready game that could drive millions of Pi transactions on Mainnet. The code is clean, the UX is smooth, and the fairness model is bulletproof.

## 🎯 Key Features (Judge Checklist)

✅ **Pi SDK v2.0 integration**
- Full `createPayment()` and app-to-user transfers
- Seamless auth via Pi Browser
- Real Pi bets → real payouts (no fake currency)

✅ **Provably fair randomization**
- Client seed + server seed + nonce → SHA256 deterministic outcomes
- Player can audit every bet independently post-game
- No "trust us" – pure cryptography

✅ **Production-grade UX**
- Canvas-based physics engine (realistic ball bounces)
- Responsive mobile-first design (Pi Browser optimized)
- Dark mode, sound effects, touch controls
- Auto-bet strategies and leaderboard tracking

✅ **Hackathon-quality code**
- Vanilla JS (no bloated frameworks)
- Clean architecture (separation of physics, UI, payments)
- Deployment-ready (static hosting, Pi Developer Portal integration)
- Full fairness verification tooling

✅ **Scalability potential**
- Can handle 1000s of concurrent players (static frontend)
- Backend-optional for MVP (full fairness possible client-side)
- Analytics-ready (track daily active users, retention, payout rates)

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | HTML5, Canvas 2D, Vanilla JS |
| **Payments** | Pi SDK v2.0 (`sdk.minepi.com/pi-sdk.js`) |
| **Styling** | CSS3 + Flexbox (responsive, <50KB) |
| **Hosting** | Vercel / Netlify / GitHub Pages (free HTTPS) |
| **Fairness** | Client-seed + server-seed HMAC-SHA256 |
| **Backend (optional)** | Node.js/Express for seed management & logging |

## 📱 Screenshots

![Gameplay 1](assets/screenshot1.jpg)
![Gameplay 2](assets/screenshot2.jpg)
![Gameplay 3](assets/screenshot3.jpg)
![Gameplay 4](assets/screenshot4.jpg)
![Gameplay 5](assets/screenshot5.jpg)
![Gameplay 6](assets/screenshot6.jpg)

## 🚀 Quick Start (30 seconds)

1. Clone:
   ```bash
   git clone https://github.com/erikg713/Plinko-on-Pi.git
   cd Plinko-on-Pi/frontend
   ```

2. Deploy (pick one):
   - **Vercel**: `vercel deploy`
   - **Netlify**: Drag & drop `frontend/` folder
   - **Local**: Open `index.html` in browser

3. Register on Pi Developer Portal (`develop.pi` in Pi Browser)

4. Test in Pi Browser (Testnet or Mainnet)

## 🔒 Provably Fair Deep Dive

**The fairness model every blockchain gambler demands:**

```
Round Flow:
  1. Server generates random seed, publishes ONLY its SHA256 hash (commitment)
  2. Player sets/changes client seed (default: browser-generated)
  3. Nonce increments (0, 1, 2, ...) per bet
  
Outcome Generation:
  outcome_hash = HMAC-SHA256(server_seed, client_seed + "-" + nonce)
  path_bits = hex_to_binary(outcome_hash[:4])  // First 4 hex chars
  
  For each row (0 to N):
    direction[i] = path_bits[i] % 2  // 0=left, 1=right
  
  final_slot = count_lefts(path_bits)
  multiplier = payout_table[final_slot]

Post-Game Verification:
  player_computed = verify_plinko(server_seed, client_seed, nonce)
  if (player_computed == game_result) ✅ provably fair
  else ❌ rigged (doesn't happen)
```

**Why this matters:**
- Outcome determined **before drop** (can't be manipulated mid-flight)
- Unpredictable to both player **and** server (neither controls result alone)
- Verifiable by **anyone** with math skills (no black box)
- Same model used by licensed gambling platforms (Stake.com, BC.Game, FairSpin)

## 🎮 Game Design

| Mechanic | Implementation |
|----------|---|
| **Risk Levels** | 8, 12, 16 peg rows → multiplier ranges (x2–x100, x2–x500, x5–x1000) |
| **House Edge** | Adjustable per risk level (1–5% standard) |
| **Auto-Bet** | Player-configurable loops with loss-chase or win-chase strategies |
| **Stats** | Win rate, avg multiplier, biggest win, session P&L |
| **Leaderboard** | Daily/weekly/all-time top earners |
| **Challenges** | Time-limited goals (e.g., "hit 3x multiplier 5 times") |

## 📊 Adoption Potential

**What makes this a Pi Network game-changer:**

1. **Revenue driver**: 1–5% house edge on real Pi bets = direct platform income
2. **User retention**: Gambling is addictive; players return daily
3. **Viral growth**: Leaderboards + social proof drive referrals
4. **Mainnet readiness**: Can launch day-one on mainnet with zero infrastructure changes
5. **Extensible**: Can add tournaments, team play, NFT multipliers, liquidity pools

## 🌐 Deployment Checklist

- [ ] Push code to GitHub repo
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Register app on Pi Developer Portal (`develop.pi`)
- [ ] Test in Pi Browser on Testnet
- [ ] Set up analytics (Google Analytics, Mixpanel, or custom)
- [ ] Configure backend seed server (if pursuing full provable fairness audit trail)
- [ ] Launch on Mainnet

## 🤝 Contributing

Contributions wanted. **High-impact priorities:**

- **Gameplay**: Physics tuning, multiplier balancing, new mechanics
- **Fairness**: Backend seed server, player verification UI
- **UX**: Sound design, animations, accessibility (mobile VoiceOver)
- **Analytics**: Retention tracking, payout auditing, fraud detection
- **Scaling**: WebSocket multiplayer, live chat, social features

## 💰 Business Model (Optional)

- **House edge**: 1–5% on all bets (standard in crypto gambling)
- **Premium battle pass**: Cosmetics, custom balls, leaderboard badges
- **Sponsorships**: Pi Network events, hackathons, developer grants
- **Liquidty pools**: Advanced players can earn yields on house liquidity

## ⚠️ Disclaimer

This project is for **hackathon showcase and educational purposes**. Gambling carries real financial risk. Comply with local regulations and platform policies. Play responsibly.

---

**Built to win Pi Hackathons and drive adoption on the Open Network.** 🔥💰🚀

For questions, reach out or open an issue. This is just the beginning.
