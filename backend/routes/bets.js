const express = require("express");
const Bet = require("../models/Bet");
const User = require("../models/User");
const router = express.Router();

// Get recent bets
router.get("/recent", async (req, res) => {
  try {
    const bets = await Bet.find().sort({ createdAt: -1 }).limit(20);
    res.json(bets);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Place bet (after payment verified via webhook)
router.post("/", async (req, res) => {
  const { user, betAmount, multiplier, winnings, txid, paymentId } = req.body;
  try {
    const bet = await Bet.create({ user, betAmount, multiplier, winnings, txid, paymentId });
    await User.safeIncrementTotals(user, { wager: betAmount, winnings });
    res.json(bet);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
