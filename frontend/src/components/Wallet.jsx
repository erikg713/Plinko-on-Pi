import React, { useState } from "react";
import { api } from "../api";

export default function Wallet({ user, onBalanceChange }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!user) return null;

  async function handleWithdraw() {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setMsg("Enter an amount greater than 0.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await api.withdraw(value);
      setMsg(
        `Withdrawal ${res.data.status}: ${value} Pi. ` +
          (res.data.message || "")
      );
      setAmount("");
      if (onBalanceChange) onBalanceChange();
    } catch (err) {
      setMsg(`Withdraw failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Wallet</h2>
      <div className="wallet-line">
        <span className="muted">Winnings balance</span>
        <span className="balance">
          {user.balance != null
            ? Number(user.balance).toFixed(2)
            : "—"}{" "}
          Pi
        </span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label className="field">
          Withdraw amount (Pi)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <button
          className="secondary"
          onClick={handleWithdraw}
          disabled={busy}
          style={{ alignSelf: "flex-end" }}
        >
          {busy ? "…" : "Withdraw"}
        </button>
      </div>
      {msg && (
        <div className="small muted" style={{ marginTop: 8 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
