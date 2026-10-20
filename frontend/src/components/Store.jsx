import React, { useState } from "react";
import { api } from "../api";

/*
 * Store — fixed-price Pi purchases (skill edition).
 *
 * Drop packs and cosmetic board themes ONLY. Nothing here is a
 * wager, a stake, or an entry into a chance outcome, and nothing
 * pays out. Buying never affects scoring.
 */

export default function Store({
  user,
  inventory,
  onInventoryChange,
  theme,
  onThemeChange,
}) {
  const [catalog, setCatalog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadCatalog() {
    if (catalog) return;
    try {
      const res = await api.catalog();
      setCatalog(res.data || []);
    } catch {
      /* ignore */
    }
  }

  function createPiPayment(paymentData) {
    return new Promise((resolve, reject) => {
      window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: (paymentId) => {
          api.approvePayment(paymentId).catch((err) => {
            reject(err);
            throw err;
          });
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          api
            .completePayment(paymentId, txid)
            .then(() => resolve({ paymentId, txid }))
            .catch(reject);
        },
        onCancel: (paymentId) =>
          reject(new Error(`Payment cancelled (${paymentId}).`)),
        onError: (error) =>
          reject(
            new Error(
              `Pi payment error: ${(error && error.message) || error}`
            )
          ),
      });
    });
  }

  async function handleBuy(item) {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      // Fixed price, fixed item — the payment can only ever buy
      // exactly this item, never a chance at winning.
      const { paymentId } = await createPiPayment({
        amount: item.pricePi,
        memo: `Plinko-on-Pi: ${item.name}`,
        metadata: { uid: user.username, itemId: item.id },
      });
      const res = await api.purchase({ itemId: item.id, paymentId });
      if (item.kind === "theme" && res.data?.granted?.theme) {
        onThemeChange(res.data.granted.theme);
      }
      setMsg(`Got it — ${item.name} added to your account.`);
      if (onInventoryChange) onInventoryChange();
    } catch (err) {
      setMsg(`Purchase failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const drops = inventory?.drops;
  const ownedThemes = inventory?.themes || ["midnight"];

  return (
    <div className="card">
      <h2>Drops &amp; Store</h2>

      <div className="wallet-line">
        <span className="muted">Drops available</span>
        <span className="balance">
          {drops ? drops.free + drops.purchased : "—"}
        </span>
      </div>
      {drops && (
        <div className="small muted" style={{ marginTop: 4 }}>
          {drops.free} free (regen {drops.cap} max)
          {drops.purchased > 0 && ` · ${drops.purchased} from packs`}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <label className="field">
          Board theme
          <select
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
          >
            {ownedThemes.map((th) => (
              <option key={th} value={th}>
                {th.charAt(0).toUpperCase() + th.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          style={{ alignSelf: "flex-end" }}
          onClick={loadCatalog}
        >
          {catalog ? "Refresh store" : "Open store"}
        </button>
      </div>

      {catalog && (
        <div style={{ marginTop: 12 }}>
          {catalog.map((item) => {
            const owned =
              item.kind === "theme" &&
              ownedThemes.includes(item.theme);
            return (
              <div
                key={item.id}
                className="store-item"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderTop: "1px solid #1e2440",
                }}
              >
                <div>
                  <div>
                    <b>{item.name}</b>
                  </div>
                  <div className="small muted">
                    {item.description}
                  </div>
                </div>
                {owned ? (
                  <span className="small muted">Owned</span>
                ) : (
                  <button
                    className="secondary"
                    disabled={busy || !user}
                    onClick={() => handleBuy(item)}
                  >
                    {busy ? "…" : `${item.pricePi} π`}
                  </button>
                )}
              </div>
            );
          })}
          <div className="small muted" style={{ marginTop: 8 }}>
            Drop packs and themes only. Nothing here is a bet, and
            nothing pays out — points can't be turned into Pi.
          </div>
        </div>
      )}

      {msg && (
        <div className="small muted" style={{ marginTop: 8 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
