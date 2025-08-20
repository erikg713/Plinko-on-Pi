const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { verifyPayment, completePayment } = require("./payments");
const { PORT } = require("./config");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple route
app.get("/", (req, res) => {
  res.send("✅ Plinko Backend Running");
});

// Handle Pi payment callback
app.post("/payment-webhook", async (req, res) => {
  try {
    const { paymentId, txid, user, betAmount, multiplier } = req.body;

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
