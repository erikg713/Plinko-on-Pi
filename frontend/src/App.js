/* frontend/app.js
   Cleaner, more robust frontend integration with Pi SDK and backend.
   - Consolidates duplicated logic
   - Validates inputs and handles errors gracefully
   - Uses short, readable helper functions
   - Keeps UI responsive while network/payment/game operations run
*/

const BACKEND_URL = window.BACKEND_URL || "https://yourbackend.com";
let user = null;
const HOUSE_EDGE = 0.05;
const LEADERBOARD_POLL_MS = 60_000; // 60s

// Cached DOM elements
const els = {
  loginBtn: document.getElementById("loginBtn"),
  playBtn: document.getElementById("playBtn"),
  betAmount: document.getElementById("betAmount"),
  result: document.getElementById("result"),
  userInfo: document.getElementById("userInfo"),
  gameArea: document.getElementById("gameArea"),
  leaderboardList: document.getElementById("leaderboardList"),
};

// Small helper to avoid repeating try/catch/finally UI toggles
function setButtonState(button, { disabled = false, text = null } = {}) {
  if (!button) return;
  button.disabled = disabled;
  if (typeof text === "string") button.dataset.origText = button.innerText, (button.innerText = text);
  else if (text === null && button.dataset.origText) button.innerText = button.dataset.origText;
}

// Fetch wrapper with timeout and JSON convenience
async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Initialize Pi SDK if available
function initPi() {
  if (typeof Pi !== "undefined" && Pi && typeof Pi.init === "function") {
    try {
      Pi.init({ version: "2.0" });
      console.info("Pi SDK initialized.");
    } catch (err) {
      console.warn("Pi.init failed:", err);
    }
  } else {
    console.warn("Pi SDK not found. Payment features will be disabled.");
  }
}

// Handler for any incomplete payments Pi discovers
function onIncompletePaymentFound(payment) {
  console.info("Incomplete payment found:", payment);
  // Optionally notify backend to reconcile
  // fetch(`${BACKEND_URL}/reconcile`, { method: "POST", body: JSON.stringify(payment) })
}

// Safe wrapper to run the plinko animation/physics.
// This checks for global functions from the rest of the app (setupPlinko, dropBall, playPlinko).
// Returns a Promise resolving to the multiplier number.
function runPlinkoGame() {
  return new Promise((resolve) => {
    // If dropBall exists and accepts a callback -> use it
    if (typeof dropBall === "function") {
      try {
        // dropBall(cb) is expected to call cb(multiplier)
        dropBall((multiplier) => {
          resolve(Number(multiplier) || 0);
        });
        return;
      } catch (err) {
        console.warn("dropBall threw, falling back:", err);
      }
    }

    // If playPlinko returns a multiplier synchronously
    if (typeof playPlinko === "function") {
      try {
        const m = playPlinko();
        resolve(Number(m) || 0);
        return;
      } catch (err) {
        console.warn("playPlinko threw, falling back:", err);
      }
    }

    // As a last resort, simulate a multiplier distribution
    // (This should never be used in production if you have a real physics game.)
    const simulated = [0, 0.5, 1, 1.5, 2, 3][Math.floor(Math.random() * 6)];
    setTimeout(() => resolve(simulated), 700);
  });
}

// Compute winnings after house edge
function computeWinnings(betAmount, multiplier) {
  const gross = betAmount * multiplier;
  return +(gross * (1 - HOUSE_EDGE));
}

// Login with Pi and notify backend for verification
async function loginWithPi() {
  if (typeof Pi === "undefined" || !Pi || typeof Pi.authenticate !== "function") {
    alert("Pi SDK not available. Please open this page in the Pi Browser.");
    return;
  }

  setButtonState(els.loginBtn, { disabled: true, text: "Signing in…" });
  try {
    const piUser = await Pi.authenticate(["username", "payments", "profile"], onIncompletePaymentFound);
    if (!piUser) throw new Error("Authentication returned no user.");

    // Send to backend to verify KYC / create session
    const res = await fetchWithTimeout(`${BACKEND_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(piUser),
    }, 10_000);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Auth failed: ${res.status} ${txt}`);
    }

    const result = await res.json();

    if (result && result.allowed) {
      user = { ...piUser, username: result.username || piUser.username };
      els.userInfo.innerHTML = `✅ Welcome, ${user.username} (KYC: ${result.kyc ? "Verified" : "Unverified"})`;
      els.loginBtn.style.display = "none";
      els.gameArea.style.display = "block";
      console.info("Login successful:", user);
    } else {
      els.userInfo.innerHTML = `❌ Access denied. You must complete Pi KYC to play.`;
      console.warn("Login blocked by backend:", result);
    }
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login error. Please try again.");
  } finally {
    setButtonState(els.loginBtn, { disabled: false });
  }
}

// Play button handler: create payment, run game, notify backend
async function handlePlay() {
  const raw = (els.betAmount && els.betAmount.value) || "";
  const betAmount = Number(parseFloat(raw));

  if (!betAmount || !isFinite(betAmount) || betAmount <= 0) {
    alert("Enter a valid bet amount greater than 0.");
    return;
  }

  // Ensure user is logged in
  if (!user) {
    alert("Please sign in with Pi before playing.");
    return;
  }

  setButtonState(els.playBtn, { disabled: true, text: "Processing…" });
  els.result.innerText = "";

  try {
    // Create Pi payment
    let payment = null;
    if (typeof Pi !== "undefined" && Pi && typeof Pi.createPayment === "function") {
      try {
        payment = await Pi.createPayment({
          amount: betAmount,
          memo: "Plinko Bet",
          metadata: { bet: betAmount }
        }, {
          onReadyForServerApproval: (paymentId) => console.log("Payment ready for approval:", paymentId),
          onReadyForServerCompletion: (paymentId, txid) => console.log("Payment completed:", paymentId, txid),
          onCancel: (paymentId) => console.log("Payment cancelled:", paymentId),
          onError: (error, paymentId) => console.error("Payment error:", error, paymentId)
        });
      } catch (err) {
        // Allow fallback (e.g., if Pi Browser not used) but warn
        console.warn("Pi.createPayment failed or was cancelled:", err);
        throw err;
      }
    } else {
      throw new Error("Pi.createPayment not available.");
    }

    // Run the visual/physics game to determine a multiplier
    const multiplier = await runPlinkoGame();
    const winnings = computeWinnings(betAmount, multiplier);

    // Update UI
    els.result.innerText = `Ball landed on x${multiplier} → You won ${winnings.toFixed(2)} Pi!`;

    // Send result to backend for reconciliation and payout handling
    const payload = {
      paymentId: payment?.identifier || payment?.id || null,
      txid: payment?.transaction?.txid || null,
      user: user.username,
      betAmount,
      multiplier,
      winnings
    };

    // Best-effort notify backend; don't block UI for long
    fetchWithTimeout(`${BACKEND_URL}/payment-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 8_000).then((res) => {
      if (!res.ok) console.warn("Webhook responded with non-OK:", res.status);
    }).catch((err) => {
      console.warn("Webhook failed:", err);
    });

  } catch (err) {
    console.error("Play failed:", err);
    alert("Payment or game failed. See console for details.");
  } finally {
    setButtonState(els.playBtn, { disabled: false });
  }
}

// Leaderboard loading with graceful degradation
let leaderboardTimer = null;
async function loadLeaderboard() {
  if (!els.leaderboardList) return;
  try {
    const res = await fetchWithTimeout(`${BACKEND_URL}/leaderboard`, {}, 8_000);
    if (!res.ok) {
      console.warn("Leaderboard fetch non-OK:", res.status);
      return;
    }
    const data = await res.json();
    // Expect array of { _id, totalWinnings }
    els.leaderboardList.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No leaderboard data yet.";
      els.leaderboardList.appendChild(li);
      return;
    }
    data.forEach((player) => {
      const li = document.createElement("li");
      const name = player._id || player.username || "anonymous";
      const winnings = typeof player.totalWinnings === "number" ? player.totalWinnings.toFixed(2) : "0.00";
      li.textContent = `${name} — ${winnings} Pi`;
      els.leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.warn("Leaderboard fetch error:", err);
  }
}

// Attach DOM event listeners and initialize periodic tasks
function attachHandlers() {
  if (els.loginBtn) els.loginBtn.addEventListener("click", loginWithPi);
  if (els.playBtn) els.playBtn.addEventListener("click", handlePlay);

  // Initial leaderboard load and polling
  loadLeaderboard();
  leaderboardTimer = setInterval(loadLeaderboard, LEADERBOARD_POLL_MS);
}

// Boot sequence
(function boot() {
  // If the rest of the app needs setup (e.g. canvas, physics), call it if available
  if (typeof setupPlinko === "function") {
    try {
      setupPlinko();
    } catch (err) {
      console.warn("setupPlinko threw an error:", err);
    }
  }

  initPi();
  attachHandlers();
})();
