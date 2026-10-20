import React, { useState, useEffect, useCallback, useRef } from "react";
import PlinkoBoard from "./components/PlinkoBoard.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import Store from "./components/Store.jsx";
import { api, getSessionToken, setSessionToken } from "./api";

const PI_SANDBOX =
  import.meta.env.VITE_PI_SANDBOX === "true";

function piAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.Pi !== "undefined" &&
    typeof window.Pi.authenticate === "function"
  );
}

/*
 * Client-side drop simulation (the "physics").
 *
 * The ball falls row by row; at each peg it bounces left or right.
 * The player's AIM shifts the odds: dropping at position dropX
 * biases each bounce toward that side of the board. The outcome is
 * produced here, on the player's device, from their aim — the
 * server never decides where the ball lands. It only verifies the
 * submitted path is self-consistent and scores it.
 */
function simulateDrop(rows, dropX) {
  const desiredMean = dropX * rows;
  // Per-bounce right probability, biased toward the aim point.
  // dropX=0.5 -> fair coin; dropX=0/1 -> 25%/75% lean.
  const pRight = 0.5 + (desiredMean - rows / 2) / (rows * 2);
  const rand = new Uint32Array(rows);
  crypto.getRandomValues(rand);
  let path = "";
  let k = 0;
  for (let r = 0; r < rows; r += 1) {
    const roll = rand[r] / 4294967296;
    if (roll < pRight && k < r + 1) {
      path += "R";
      k += 1;
    } else {
      path += "L";
    }
  }
  return { path, bin: k };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [theme, setTheme] = useState("midnight");
  const [rows, setRows] = useState(12);
  const [spread, setSpread] = useState("medium");
  const [dropX, setDropX] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // aiming phase: { runId, targetBin, sweepMs, sweepStart }
  const [aim, setAim] = useState(null);
  const [sweepPos, setSweepPos] = useState(0); // 0..1 sweep indicator
  const sweepRaf = useRef(null);

  const [animPath, setAnimPath] = useState("");
  const [animating, setAnimating] = useState(false);
  const [highlightBin, setHighlightBin] = useState(-1);
  const [lastRun, setLastRun] = useState(null);

  /* ---------- Pi SDK init ---------- */
  useEffect(() => {
    if (!piAvailable()) {
      setError("Pi SDK not found. Open this app in the Pi Browser.");
      return;
    }
    try {
      window.Pi.init({ version: "2.0", sandbox: PI_SANDBOX });
    } catch (err) {
      setError(`Pi.init failed: ${err.message}`);
    }

    if (getSessionToken()) {
      api
        .me()
        .then((res) => {
          setUser(res.data.player || res.data);
          refreshInventory();
        })
        .catch(() => setSessionToken(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshInventory = useCallback(async () => {
    try {
      const res = await api.inventory();
      setInventory(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------- auth (Pi sign-in, unchanged) ---------- */

  async function handleIncompletePayment(payment) {
    try {
      const paymentId = payment.identifier || payment.id;
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
      setError("Pi SDK not found. Open this app in the Pi Browser.");
      return;
    }
    setBusy(true);
    try {
      const auth = await window.Pi.authenticate(
        ["username", "payments"],
        handleIncompletePayment
      );
      if (!auth || !auth.accessToken) {
        throw new Error("Pi authentication returned no access token.");
      }
      const res = await api.login(auth.accessToken);
      setSessionToken(res.data.token);
      setUser(res.data.player);
      await refreshInventory();
    } catch (err) {
      setError(`Login failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    setSessionToken(null);
    setUser(null);
    setInventory(null);
    stopSweep();
    setAim(null);
  }

  /* ---------- sweep (timing skill input) ---------- */

  function stopSweep() {
    if (sweepRaf.current) {
      cancelAnimationFrame(sweepRaf.current);
      sweepRaf.current = null;
    }
  }

  function startSweep(sweepMs, sweepStart) {
    stopSweep();
    const tick = () => {
      const t = (performance.now() - sweepStart) / sweepMs;
      // ping-pong 0..1..0
      const phase = t % 2;
      setSweepPos(phase < 1 ? phase : 2 - phase);
      sweepRaf.current = requestAnimationFrame(tick);
    };
    sweepRaf.current = requestAnimationFrame(tick);
  }

  useEffect(
    () => () => stopSweep(),
    []
  );

  /* ---------- skill drop flow ---------- */

  async function handleAim() {
    setError("");
    setStatus("");
    setLastRun(null);
    setHighlightBin(-1);

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
      // 1. Register the run server-side (consumes 1 drop, assigns
      //    the target bin). No Pi changes hands — drops are free
      //    (regenerating) or from fixed-price store packs.
      setStatus("Aiming…");
      const start = await api.startRun({ dropX, rows, spread });
      const { runId, targetBin, sweepMs } = start.data;
      await refreshInventory();

      // 2. Timing phase: the marker sweeps; release to drop.
      const sweepStart = performance.now();
      setAim({ runId, targetBin, sweepMs, sweepStart });
      startSweep(sweepMs, sweepStart);
      setStatus("Release at the right moment!");
    } catch (err) {
      setError(err.message || "Couldn't start run.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    if (!aim) return;
    const releaseMs = performance.now() - aim.sweepStart;
    stopSweep();
    setAim(null);
    setStatus("");

    // 3. The ball falls according to the player's aim, simulated
    //    right here. The server never decides the outcome.
    const { path, bin } = simulateDrop(rows, dropX);

    setBusy(true);
    try {
      const res = await api.submitRun({
        runId: aim.runId,
        path,
        bin,
        releaseMs: Math.round(releaseMs),
      });
      const scored = res.data;

      // 4. Animate along the player's own path (visual only).
      setAnimPath(path);
      setAnimating(true);
      setLastRun({ ...scored, rows, spread });
      await refreshInventory();
    } catch (err) {
      setError(err.message || "Couldn't score run.");
    } finally {
      setBusy(false);
    }
  }

  function handleAnimationDone() {
    setAnimating(false);
    if (lastRun && typeof lastRun.bin === "number") {
      setHighlightBin(lastRun.bin);
    }
  }

  function cancelAim() {
    stopSweep();
    setAim(null);
    setStatus("");
  }

  const dropsLeft = inventory
    ? inventory.drops.free + inventory.drops.purchased
    : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="pi">π</span> Plinko on Pi
        </div>
        {user ? (
          <button className="secondary" onClick={handleLogout}>
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
          <p className="muted">Sign in with your Pi account to play.</p>
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
              risk={spread}
              path={animPath}
              animating={animating}
              highlightBin={highlightBin}
              targetBin={aim ? aim.targetBin : lastRun ? lastRun.targetBin : -1}
              dropX={dropX}
              theme={theme}
              onAnimationDone={handleAnimationDone}
            />
          </div>

          <div className="card">
            <h2>Aim your drop</h2>
            <div className="row">
              <label className="field" style={{ flex: 2 }}>
                Drop position
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(dropX * 100)}
                  onChange={(e) => setDropX(Number(e.target.value) / 100)}
                  disabled={busy || animating || !!aim}
                />
              </label>
              <label className="field">
                Rows
                <select
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                  disabled={busy || animating || !!aim}
                >
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Spread
                <select
                  value={spread}
                  onChange={(e) => setSpread(e.target.value)}
                  disabled={busy || animating || !!aim}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>

            {aim && (
              <div style={{ marginTop: 12 }}>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  Release when the marker hits the center for an aim
                  bonus — land in the gold TARGET bin for +50% and a
                  streak.
                </div>
                <div
                  className="sweep-track"
                  style={{
                    position: "relative",
                    height: 26,
                    background: "#141a33",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: "#ffd166",
                      transform: "translateX(-50%)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      bottom: 3,
                      width: 10,
                      borderRadius: 5,
                      background: "#7c5cff",
                      left: `calc(${(sweepPos * 100).toFixed(1)}% - 5px)`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="row" style={{ marginTop: 12 }}>
              {!aim ? (
                <button
                  onClick={handleAim}
                  disabled={busy || animating}
                  style={{ flex: 1 }}
                >
                  {busy
                    ? "Aiming…"
                    : animating
                    ? "Dropping…"
                    : `Aim drop · ${dropsLeft ?? "—"} left`}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRelease}
                    style={{ flex: 1 }}
                  >
                    Release!
                  </button>
                  <button
                    className="secondary"
                    onClick={cancelAim}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {lastRun && !animating && (
              <div className="result">
                <div>
                  Landed in bin{" "}
                  <b>
                    {lastRun.bin}
                    {lastRun.hitTarget ? " — TARGET HIT!" : ""}
                  </b>
                </div>
                <div className="score-line">
                  <span className="mult">+{lastRun.points} pts</span>
                  {lastRun.streak > 1 && (
                    <span className="streak">
                      {" "}
                      · {lastRun.streak}x streak
                    </span>
                  )}
                </div>
                <div className="verify">
                  <div>
                    Base {lastRun.base} + target {lastRun.targetBonus} +
                    streak {lastRun.streakBonus} + aim{" "}
                    {lastRun.aimBonus}
                  </div>
                  <div className="small muted">
                    Points are scores only — they can't be turned
                    into Pi.
                  </div>
                </div>
              </div>
            )}
          </div>

          <Store
            user={user}
            inventory={inventory}
            onInventoryChange={refreshInventory}
            theme={theme}
            onThemeChange={setTheme}
          />
        </>
      )}

      <Leaderboard />

      <div className="card">
        <h2>How it works</h2>
        <div className="small muted">
          <p>
            This is a <b>skill game</b> — there is no betting, no
            wagering, and nothing of value on the line.
          </p>
          <p>
            Pick a drop position, time your release, and score
            points. Hit the gold target bin for bonus points and to
            build a streak. Drops are free and regenerate over time;
            the store sells extra drop packs and cosmetic board
            themes for fixed Pi prices — buying never affects your
            score.
          </p>
          <p>
            The ball's path is simulated on your device from your
            aim. The server verifies each submission and keeps the
            leaderboards honest.
          </p>
        </div>
      </div>
    </div>
  );
}
