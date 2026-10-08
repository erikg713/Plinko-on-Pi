# Pi Plinko

![Pi Network Logo](assets/pi-logo.png)

**Drop balls. Chase multipliers. Win Pi.**

Pi Plinko is a mobile-first Plinko game built for the Pi Network ecosystem. Players place Pi bets, watch the ball drop through a pegged board, and aim for multipliers up to x1000 using Pi SDK payments and a verifiable fairness model.

The project is designed to demonstrate how lightweight browser games can integrate smoothly with Pi Browser, deliver fast mobile play, and support real utility within the Pi ecosystem.

## 🚀 Features

- Real Pi bets and payouts via Pi SDK
- Canvas-based Plinko gameplay and physics
- Adjustable risk levels and multiplier ranges
- Provably fair outcomes using client/server seed logic
- Auto-bet mode and strategy support
- Leaderboards, stats, and challenge tracking
- Responsive UI with dark mode and touch-friendly controls
- Static frontend deployment for Pi Browser apps

## 🛠️ Tech Stack

- Frontend: HTML5, Canvas, Vanilla JavaScript
- Pi integration: Pi SDK (`https://sdk.minepi.com/pi-sdk.js`)
- Styling: CSS3 with responsive mobile-first design
- Hosting: Vercel, Netlify, or similar static hosting
- Fairness model: client seed + server seed + nonce validation

## 📱 Screenshots

![Gameplay 1](assets/screenshot1.jpg)
![Gameplay 2](assets/screenshot2.jpg)
![Gameplay 3](assets/screenshot3.jpg)
![Gameplay 4](assets/screenshot4.jpg)
![Gameplay 5](assets/screenshot5.jpg)
![Gameplay 6](assets/screenshot6.jpg)

## 🚀 Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/erikg713/Plinko-on-Pi.git
   cd Plinko-on-Pi/frontend
   ```

2. Deploy the `frontend` folder to a static host such as Vercel or Netlify.

3. Register the app in the Pi Developer Portal and configure the app URL for Pi Browser.

4. Test the game in Pi Browser on Testnet or Mainnet.

## 🔒 Provably Fair

Pi Plinko uses a verifiable random generation flow built around:

- a client seed
- a server seed
- a nonce per round

Before a round, the server commits to a seed hash. The final game outcome is then derived from the combined seed and nonce values, allowing players to verify the result after the round is complete. This provides a transparent fairness mechanism rather than relying on blind trust.

## 🎯 Why It Matters

This project highlights a practical and user-friendly use case for Pi Network:

- real Pi utility in a browser-based game
- mobile-first gameplay optimized for Pi Browser
- transparent fairness model for trust and adoption
- lightweight architecture that is easy to deploy and extend

## 🌐 Deployment Notes

This frontend is designed for static hosting and can be deployed with minimal configuration. For a production-ready rollout, the project can be extended with:

- backend seed generation
- payout verification
- secure game logging
- leaderboard persistence
- analytics and user tracking

## 🤝 Contributing

Contributions are welcome. Priority areas include:

- gameplay tuning and physics polish
- fairness verification tooling
- sound and animation improvements
- mobile UX enhancements
- backend infrastructure for seed management and analytics

## ⚠️ Disclaimer

This project is for educational and showcase purposes. Gambling carries financial risk. Please play responsibly and comply with all local laws and platform policies.

---

Built for the Pi ecosystem and designed to showcase a mobile-first gaming experience on Pi Browser.
```

