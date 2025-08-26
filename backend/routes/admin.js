const express = require("express");
const Bet = require("../models/Bet");
const { adminAuth } = require("../middleware/auth");
const router = express.Router();

router.get("/metrics", adminAuth, async (req, res) => {
  try {
    const totalBets = await Bet.countDocuments();
    const totalWagered = await Bet.aggregate([{ $group: { _id: null, total: { $sum: "$betAmount" } } }]);
    const totalPayouts = await Bet.aggregate([{ $group: { _id: null, total: { $sum: "$winnings" } } }]);

    const profit = (totalWagered[0]?.total || 0) - (totalPayouts[0]?.total || 0);

    res.json({
      totalBets,
      totalWagered: totalWagered[0]?.total || 0,
      totalPayouts: totalPayouts[0]?.total || 0,
      profit
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
