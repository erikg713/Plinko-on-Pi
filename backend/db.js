// backend/server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose"); // Added Mongoose to the server file for connection
const { verifyPayment, completePayment } = require("./payments");
const { PORT, ADMIN_API_KEY, DATABASE_URL } = require("./config");
const Bet = require("./models/Bet");
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected successfully!");
  // Start server after successful database connection
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

// All routes remain the same as before
app.get("/", (req, res) => {
  res.send("✅ Plinko Backend Running");
});

app.get("/leaderboard", async (req, res) => {
  try {
    const leaders = await Bet.aggregate([
      { $group: { _id: "$user", totalWinnings: { $sum: "$winnings" } } },
      { $sort: { totalWinnings: -1 } },
      { $limit: 10 }
    ]);
    const formatted = leaders.map((entry, idx) => ({
      rank: idx + 1,
      user: entry._id,
      totalWinnings: +entry.totalWinnings.toFixed(4)
    }));
    res.json(formatted);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/payment-webhook", async (req, res) => {
  try {
    const { paymentId, txid, user, betAmount, multiplier } = req.body;
    if (!paymentId || !txid || !user || !betAmount || !multiplier) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    console.log("💰 Payment received:", paymentId);
    const payment = await verifyPayment(paymentId);
    if (!payment || payment.status !== "completed") {
      return res.status(400).json({ error: "Invalid or incomplete payment" });
    }
    const winnings = Number((betAmount * multiplier * 0.95).toFixed(4));
    const houseEdge = Number((betAmount - winnings).toFixed(4));
    console.log(`🎉 User ${user} won ${winnings} Pi!`);
    console.log(`🏦 House kept ${houseEdge} Pi.`);
    await completePayment(paymentId, txid);
    await Bet.create({
      user,
      betAmount,
      multiplier,
      winnings,
      txid,
      paymentId,
      createdAt: new Date()
    });
    res.json({ success: true, winnings });
  } catch (err) {
    console.error("Payment webhook error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/metrics", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== ADMIN_API_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const totalBets = await Bet.countDocuments();
    const totalWageredAgg = await Bet.aggregate([{ $group: { _id: null, total: { $sum: "$betAmount" } } }]);
    const totalPayoutsAgg = await Bet.aggregate([{ $group: { _id: null, total: { $sum: "$winnings" } } }]);
    const totalWagered = totalWageredAgg[0]?.total || 0;
    const totalPayouts = totalPayoutsAgg[0]?.total || 0;
    const profit = totalWagered - totalPayouts;
    const recentBets = await Bet.find().sort({ createdAt: -1 }).limit(10);
    const leaderboard = await Bet.aggregate([
      { $group: { _id: "$user", totalWinnings: { $sum: "$winnings" } } },
      { $sort: { totalWinnings: -1 } },
      { $limit: 10 }
    ]);
    res.json({
      totalBets,
      totalWagered,
      totalPayouts,
      profit,
      recentBets,
      leaderboard
    });
  } catch (err) {
    console.error("Admin metrics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
