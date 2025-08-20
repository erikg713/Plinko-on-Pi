let user = null;

// Initialize Pi SDK
Pi.init({ version: "2.0" });

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    user = await Pi.authenticate(["username", "payments"], onIncompletePaymentFound);
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("gameArea").style.display = "block";
    console.log("Logged in as:", user);
  } catch (err) {
    console.error("Login failed", err);
  }
});

async function onIncompletePaymentFound(payment) {
  console.log("Incomplete payment:", payment);
}

document.getElementById("playBtn").addEventListener("click", async () => {
  const betAmount = parseFloat(document.getElementById("betAmount").value);

  try {
    const payment = await Pi.createPayment({
      amount: betAmount,
      memo: "Plinko Bet",
      metadata: { bet: betAmount }
    }, {
      onReadyForServerApproval: (paymentId) => console.log("Approve:", paymentId),
      onReadyForServerCompletion: (paymentId, txid) => console.log("Complete:", paymentId, txid),
      onCancel: (paymentId) => console.log("Cancelled:", paymentId),
      onError: (error, paymentId) => console.error("Error:", error, paymentId)
    });

    // Once payment is confirmed → Run game
    const multiplier = playPlinko();
    const winnings = betAmount * multiplier * 0.95; // 5% house edge
    document.getElementById("result").innerText = 
      `Ball landed on x${multiplier} → You won ${winnings.toFixed(2)} Pi!`;

    // TODO: send winnings from backend wallet
  } catch (err) {
    console.error("Payment failed", err);
  }
});
