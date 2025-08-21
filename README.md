# 🎰 Plinko on Pi

A Web3-powered **Plinko Game DApp** that runs exclusively in the **Pi Browser**.  
Players bet Pi Coins, drop a ball into the Plinko board, and win prizes based on where it lands.  
The house earns profit via a built-in edge system.

---

## ✨ Features
- ✅ **Physics-based gameplay** using Matter.js
- ✅ **Pi Network SDK integration** for authentication & payments
- ✅ **House edge system** for sustainable profit
- ✅ **Secure backend** with Node.js + Express
- ✅ **MongoDB database** for logs and bet tracking
- ✅ **Leaderboard system** for competitive gameplay
- ✅ **Responsive UI** for Pi Browser compatibility

---

## 📂 Project Structure

plinko-dapp/ │── frontend/       # Game frontend (HTML/CSS/JS) │   ├── index.html │   ├── style.css │   ├── app.js │   ├── plinko.js │   └── libs/matter.min.js │ │── backend/        # Backend API (Node.js/Express) │   ├── server.js │   ├── config.js │   ├── payments.js │   ├── db.js │   └── package.json │ └── .env            # API keys and secrets

---

## ⚙️ Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-username/plinko-on-pi.git
cd plinko-on-pi

2. Install Backend Dependencies

cd backend
npm install

3. Configure Environment

Create a .env file inside backend/:

PI_API_KEY=your_pi_api_key_here
MONGO_URI=mongodb+srv://yourusername:yourpassword@cluster.mongodb.net/plinko
PORT=5000

4. Start Backend

npm start

5. Deploy Frontend

Host the frontend/ folder on:

Netlify / Vercel (recommended)

Or upload directly to Pi Browser Developer Portal



---

🚀 Deployment

Frontend → Netlify/Vercel or Pi Dev Portal

Backend → Render, Heroku, or VPS

Database → MongoDB Atlas



---

💰 Monetization

House Edge → 5% of all bets

Ads or Sponsors → integrate for extra revenue

Premium Features → skins, power-ups, VIP access



---

🏆 Leaderboard

The leaderboard shows the Top 10 players ranked by total winnings.
It refreshes every 60 seconds.


---

🛡️ Security

All payments verified via Pi Network API

Backend never trusts client-only data

MongoDB stores logs securely



---

📜 License

MIT License © 2025 — Built for the Pi Network Ecosystem


---
