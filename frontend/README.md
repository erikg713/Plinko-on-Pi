# Plinko-on-Pi

![Pi Network Logo](assets/pi-logo.png)

**Drop balls. Chase multipliers. Win Pi.**

Pi Plinko is a mobile-first Plinko game built for the Pi Network ecosystem. Players place Pi bets, watch the ball fall through a pegged board, and win multipliers up to x1000 using Pi SDK payments and a provably fair randomization model.

Built for the Pi Browser, this project is optimized for fast mobile play, lightweight deployment, and simple integration with Pi authentication and transfers.

## 🚀 Features

- Real Pi bets and payouts via Pi SDK
- Canvas-based Plinko gameplay and physics
- Adjustable risk levels with multiple peg rows
- Provably fair outcomes using client/server seed logic
- Auto-bet mode and strategy support
- Leaderboards, stats, and challenge tracking
- Responsive UI with dark mode and touch support
- Easy static deployment for Pi Browser apps

## 🛠️ Tech Stack

- Frontend: HTML5, Canvas, Vanilla JavaScript
- Pi integration: Pi SDK (`https://sdk.minepi.com/pi-sdk.js`)
- Styling: CSS3 with responsive design
- Hosting: Static hosting on Vercel, Netlify, or similar
- Platform: Pi Developer Portal / Pi Browser

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

2. Open the app locally in a browser or deploy the `frontend` directory to a static host.

3. Register the app in the Pi Developer Portal and configure the app URL used in Pi Browser.

4. Test the game in Pi Browser on Mainnet or Testnet.

## 🔒 Provably Fair

Pi Plinko uses a verifiable random generation approach based on:
- a client seed
- a server seed
- a nonce per round

The server publishes the seed hash before play, and the final outcome can be verified after the round is complete. This gives players a transparent, auditable mechanism for checking fairness rather than relying on blind trust.

## 🌐 Deployment

This frontend is designed for static hosting and can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- any other static hosting provider

For production use, pair the frontend with a backend service for:
- server-generated seeds
- secure payout verification
- game-state logging
- leaderboard persistence

## 🤝 Contributing

Contributions are welcome. Priority areas include:
- gameplay polish
- physics tuning
- sound and animation improvements
- fairness verification tooling
- mobile UX refinements
- backend seed/payout infrastructure

## ⚠️ Disclaimer

This project is for entertainment and educational purposes. Gambling carries financial risk. Please play responsibly and ensure compliance with local laws and platform rules.

---

Built for the Pi ecosystem and designed to showcase a mobile-first gaming experience on Pi Browser.
```

Why this version is better:
- It sounds like a real product README, not a brainstorm dump
- It keeps the most important judge-facing points
- It removes repetition and random filler
- It still includes the exact assets folder and screenshots
- It balances polish and technical clarity

If you want, I can make it even stronger in one of these directions:
- More hackathon/judge-focused
- More developer-focused
- More product/marketing-focused
- Shorter and sharper for GitHub homepage style
