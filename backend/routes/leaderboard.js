const express = require("express");
const Bet = require("../models/Bet");
const router = express.Router();

// Leaderboard (top winners)
router.get("/", async (req, res) => {
  try {
    const leaders = await Bet.aggregate([
      { $group: { _id: "$user", totalWinnings: { $sum: "$winnings" } } },
      { $sort: { totalWinnings: -1 } },
      { $limit: 10 }
    ]);

    res.json(leaders.map((u, i) => ({ rank: i + 1, user: u._id, winnings: u.totalWinnings })));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
