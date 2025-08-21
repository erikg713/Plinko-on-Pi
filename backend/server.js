// backend/server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { verifyPayment, completePayment } = require("./payments");
const { PORT, ADMIN_API_KEY } = require("./config");
const Bet = require("./models/Bet"); // Bet model
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Plinko Backend Running");
});

// ✅ Leaderboard: Returns top 10 players by winnings
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

// ✅ Pi payment webhook handler
app.post("/payment-webhook", async (req, res) => {
  try {
    const { paymentId, txid, user, betAmount, multiplier } = req.body;

    if (!paymentId || !txid || !user || !betAmount || !multiplier) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("💰 Payment received:", paymentId);

    // Verify with Pi API
    const payment = await verifyPayment(paymentId);
    if (!payment || payment.status !== "completed") {
      return res.status(400).json({ error: "Invalid or incomplete payment" });
    }

    // Calculate winnings (95% payout → 5% house edge)
    const winnings = Number((betAmount * multiplier * 0.95).toFixed(4));
    const houseEdge = Number((betAmount - winnings).toFixed(4));

    console.log(`🎉 User ${user} won ${winnings} Pi!`);
    console.log(`🏦 House kept ${houseEdge} Pi.`);

    // Approve and finalize
    await completePayment(paymentId, txid);

    // Log bet into DB
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

// ✅ Admin dashboard metrics (secured with API key)
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

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});const Bet = require("./models/Bet"); // Ensure Bet model is imported

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check route
app.get("/", (req, res) => {
  res.send("✅ Plinko Backend Running");
});

// Leaderboard route: Returns top 10 players by total winnings
app.get("/leaderboard", async (req, res) => {
  try {
    const leaders = await Bet.aggregate([
      {
        $group: {
          _id: "$user",
          totalWinnings: { $sum: "$winnings" }
        }
      },
      { $sort: { totalWinnings: -1 } },
      { $limit: 10 }
    ]);

    // Optionally, map the response for clarity
    const formattedLeaders = leaders.map((entry, idx) => ({
      rank: idx + 1,
      user: entry._id,
      totalWinnings: +entry.totalWinnings.toFixed(4)
    }));

    res.json(formattedLeaders);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Pi payment webhook handler
app.post("/payment-webhook", async (req, res) => {
  try {
    const { paymentId, txid, user, betAmount, multiplier } = req.body;
    if (!paymentId || !txid || !user || !betAmount || !multiplier) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("💰 Payment received:", paymentId);

    // Verify payment status from Pi API
    const payment = await verifyPayment(paymentId);

    if (!payment || payment.status !== "completed") {
      return res.status(400).json({ error: "Invalid or incomplete payment" });
    }

    // Calculate winnings (5% house edge)
    const winnings = Number((betAmount * multiplier * 0.95).toFixed(4));
    const houseEdge = Number((betAmount - winnings).toFixed(4));

    console.log(`🎉 User ${user} won ${winnings} Pi!`);
    console.log(`🏦 House kept ${houseEdge} Pi.`);

    // Complete the payment
    await completePayment(paymentId, txid);

    // Log the bet in the database for leaderboard tracking
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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
    console.log("💰 Payment received:", paymentId);

    // Verify with Pi API
    const payment = await verifyPayment(paymentId);

    if (payment && payment.status === "completed") {
      // Calculate winnings (95% payout → 5% house edge)
      const winnings = betAmount * multiplier * 0.95;

      console.log(`🎉 User ${user} won ${winnings} Pi!`);
      console.log(`🏦 House kept ${betAmount - winnings} Pi.`);

      // Approve and finalize
      await completePayment(paymentId, txid);

      return res.json({ success: true, winnings });
    }

    return res.status(400).json({ error: "Invalid or incomplete payment" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
// Admin dashboard metrics (secure this with API key or JWT)
app.get("/admin/metrics", async (req, res) => {
  try {
    const totalBets = await Bet.countDocuments();
    const totalWagered = await Bet.aggregate([{ $group: { _id: null, total: { $sum: "$betAmount" } } }]);
    const totalPayouts = await Bet.aggregate([{ $group: { _id: null, total: { $sum: "$winnings" } } }]);

    const recentBets = await Bet.find().sort({ timestamp: -1 }).limit(10);

    const leaderboard = await Bet.aggregate([
      { $group: { _id: "$user", totalWinnings: { $sum: "$winnings" } } },
      { $sort: { totalWinnings: -1 } },
      { $limit: 10 }
    ]);

    const profit = (totalWagered[0]?.total || 0) - (totalPayouts[0]?.total || 0);

    res.json({
      totalBets,
      totalWagered: totalWagered[0]?.total || 0,
      totalPayouts: totalPayouts[0]?.total || 0,
      profit,
      recentBets,
      leaderboard
    });
  } catch (err) {
    console.error("Admin metrics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
