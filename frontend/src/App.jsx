import React, { useState, useEffect, useCallback } from "react";
import PlinkoBoard from "./components/PlinkoBoard.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import Wallet from "./components/Wallet.jsx";
import { api, getSessionToken, setSessionToken } from "./api";

const PI_SANDBOX =
  import.meta.env.VITE_PI_SANDBOX === "true";

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function piAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.Pi !== "undefined" &&
    typeof window.Pi.authenticate === "function"
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [amount, setAmount] = useState("1");
  const [rows, setRows] = useState(12);
  const [risk, setRisk] = useState("low");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastGame, setLastGame] = useState(null);
  const [animPath, setAnimPath] = useState("");
  const [animating, setAnimating] = useState(false);
  const [highlightBin, setHighlightBin] = useState(-1);

  /* ---------- Pi SDK init ---------- */
  useEffect(() => {
    if (!piAvailable()) {
      setError(
        "Pi SDK not found. Open this app in the Pi Browser."
      );
      return;
    }
    try {
      window.Pi.init({
        version: "2.0",
        sandbox: PI_SANDBOX,
      });
    } catch (err) {
      setError(`Pi.init failed: ${err.message}`);
    }

    // resume session if we have one
    if (getSessionToken()) {
      api
        .me()
        .then((res) => {
          setUser(res.data.player || res.data);
          refreshBalance();
        })
        .catch(() => setSessionToken(null));
    }

    api
      .leaderboard()
      .then((res) => setLeaderboard(res.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await api.wallet();
      setBalance(res.data.available);
      setUser((u) =>
        u ? { ...u, balance: res.data.available } : u
      );
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------- auth ---------- */

  async function handleIncompletePayment(payment) {
    // A previous payment never finished (dropped connection).
    // Ask the backend to reconcile it against the Pi Platform.
    try {
      const paymentId =
        payment.identifier || payment.id;
      if (paymentId && getSessionToken()) {
        await api.reconcilePayment(paymentId);
      }
    } catch (err) {
      console.warn("reconcile failed", err);
    }
  }

  async function handleLogin() {
    setError("");
    setStatus("");
    if (!piAvailable()) {
      setError(
        "Pi SDK not found. Open this app in the Pi Browser."
      );
      return;
    }
    setBusy(true);
    try {
      const auth = await window.Pi.authenticate(
        ["username", "payments"],
        handleIncompletePayment
      );
      if (!auth || !auth.accessToken) {
        throw new Error(
          "Pi authentication returned no access token."
        );
      }
      const res = await api.login(auth.accessToken);
      setSessionToken(res.data.token);
      setUser(res.data.player);
      await refreshBalance();
      const lb = await api.leaderboard();
      setLeaderboard(lb.data || []);
    } catch (err) {
      setError(`Login failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    setSessionToken(null);
    setUser(null);
    setBalance(null);
  }

  /* ---------- betting ---------- */

  function createPiPayment(paymentData) {
    return new Promise((resolve, reject) => {
      let approved = null;
      let completed = null;

      window.Pi.createPayment(
        paymentData,
        {
          onReadyForServerApproval: (paymentId) => {
            approved = (async () => {
              try {
                await api.approvePayment(paymentId);
              } catch (err) {
                reject(err);
                throw err;
              }
            })();
          },
          onReadyForServerCompletion: (
            paymentId,
            txid
          ) => {
            completed = (async () => {
              try {
                await api.completePayment(
                  paymentId,
                  txid
                );
                resolve({ paymentId, txid });
              } catch (err) {
                reject(err);
              }
            })();
          },
          onCancel: (paymentId) => {
            reject(
              new Error(
                `Payment cancelled (${paymentId}).`
              )
            );
          },
          onError: (error) => {
            reject(
              new Error(
                `Pi payment error: ${
                  (error && error.message) ||
                  error
                }`
              )
            );
          },
        }
      );

      // safety net: if neither callback fires, the promise
      // stays pending until the user acts in the wallet.
      void approved;
      void completed;
    });
  }

  async function handleDrop() {
    setError("");
    setStatus("");
    setLastGame(null);
    setHighlightBin(-1);

    const wager = parseFloat(amount);
    if (!wager || wager <= 0) {
      setError("Enter a bet amount greater than 0.");
      return;
    }
    if (!user) {
      setError("Sign in with Pi first.");
      return;
    }
    if (!piAvailable()) {
      setError("Pi SDK not found.");
      return;
    }

    setBusy(true);
    try {
      // 1. Commit the provably-fair round BEFORE the bet.
      setStatus("Committing provably-fair round…");
      const commit = await api.commitRound();
      const roundId = commit.data.roundId;
      const serverSeedHash = commit.data.serverSeedHash;
      const clientSeed = randomHex(16);

      // 2. Take the wager via a real Pi payment (U2A).
      setStatus("Waiting for Pi payment approval…");
      const { paymentId } = await createPiPayment({
        amount: wager,
        memo: "Plinko-on-Pi bet",
        metadata: {
          uid: user.username,
          roundId,
          clientSeed,
          rows,
          risk,
        },
      });

      // 3. Settle the bet server-side. The outcome is derived
      //    from HMAC(serverSeed, clientSeed-nonce) — the
      //    client never decides what it won.
      setStatus("Settling bet on the server…");
      const bet = await api.placeBet({
        amount: wager,
        rows,
        risk,
        roundId,
        clientSeed,
        paymentId,
      });

      const game = bet.data.game;
      setLastGame({
        ...game,
        serverSeedHash,
      });

      // 4. Animate along the server-provided path (visual only).
      setAnimPath(game.path || "");
      setAnimating(true);
      setStatus("");
      await refreshBalance();
    } catch (err) {
      setError(err.message || "Bet failed.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function handleAnimationDone() {
    setAnimating(false);
    if (lastGame && typeof lastGame.resultSlot === "number") {
      setHighlightBin(lastGame.resultSlot);
    }
    api
      .leaderboard()
      .then((res) => setLeaderboard(res.data || []))
      .catch(() => {});
  }

  const profit =
    lastGame && lastGame.profit != null
      ? Number(lastGame.profit)
      : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="pi">π</span> Plinko on Pi
        </div>
        {user ? (
          <button
            className="secondary"
            onClick={handleLogout}
          >
            {user.username} · out
          </button>
        ) : null}
      </header>

      {PI_SANDBOX && (
        <div className="notice">
          Sandbox mode — Test-Pi only, no real value moves.
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {status && <div className="notice">{status}</div>}

      {!user && (
        <div className="card center">
          <p className="muted">
            Sign in with your Pi account to play.
          </p>
          <button onClick={handleLogin} disabled={busy}>
            {busy ? "Signing in…" : "Sign in with Pi"}
          </button>
        </div>
      )}

      {user && (
        <>
          <div className="card">
            <PlinkoBoard
              rows={rows}
              risk={risk}
              path={animPath}
              animating={animating}
              highlightBin={highlightBin}
              onAnimationDone={handleAnimationDone}
            />
          </div>

          <div className="card">
            <h2>Place a bet</h2>
            <div className="row">
              <label className="field">
                Bet (Pi)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value)
                  }
                  disabled={busy || animating}
                />
              </label>
              <label className="field">
                Rows
                <select
                  value={rows}
                  onChange={(e) =>
                    setRows(Number(e.target.value))
                  }
                  disabled={busy || animating}
                >
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                    (r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="field">
                Risk
                <select
                  value={risk}
                  onChange={(e) =>
                    setRisk(e.target.value)
                  }
                  disabled={busy || animating}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                onClick={handleDrop}
                disabled={busy || animating}
                style={{ flex: 1 }}
              >
                {busy
                  ? "Processing…"
                  : animating
                  ? "Dropping…"
                  : `Drop ball · ${amount || "0"} π`}
              </button>
            </div>

            {lastGame && !animating && (
              <div className="result">
                <div>
                  Landed on{" "}
                  <span className="mult">
                    {lastGame.multiplier}x
                  </span>
                </div>
                <div
                  className={
                    profit >= 0 ? "win" : "loss"
                  }
                >
                  {profit >= 0 ? "+" : ""}
                  {profit.toFixed(2)} Pi
                </div>
                <div className="verify">
                  <div>
                    <b>serverSeedHash</b>{" "}
                    {lastGame.serverSeedHash}
                  </div>
                  <div>
                    <b>serverSeed</b>{" "}
                    {lastGame.serverSeed}
                  </div>
                  <div>
                    <b>clientSeed</b>{" "}
                    {lastGame.clientSeed}
                  </div>
                  <div>
                    <b>nonce</b> {lastGame.nonce}
                  </div>
                  <div>
                    <b>path</b> {lastGame.path}
                  </div>
                  <div className="small muted">
                    Verify: HMAC-SHA256(serverSeed,
                    clientSeed-nonce) → path bits
                    (0=left, 1=right).
                  </div>
                </div>
              </div>
            )}
          </div>

          <Wallet
            user={{ ...user, balance }}
            onBalanceChange={refreshBalance}
          />
        </>
      )}

      <Leaderboard data={leaderboard} />

      <div className="card">
        <h2>How it works</h2>
        <div className="small muted">
          <p>
            Every bet is funded by a real Pi payment and
            settled on the server. The ball path is derived
            from HMAC-SHA256(serverSeed,
            clientSeed-nonce) — the server commits to the
            seed hash before you bet and reveals the seed
            after, so every round is verifiable.
          </p>
          <p>
            Winnings land in your in-app balance and can be
            withdrawn to your Pi wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
