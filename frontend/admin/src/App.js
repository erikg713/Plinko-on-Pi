import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("https://yourbackend.com/admin/metrics", {
          headers: { "x-api-key": "supersecretkey123" } // secure API key
        });
        const data = await res.json();
        setMetrics(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching metrics:", err);
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) return <p>⏳ Loading metrics...</p>;
  if (!metrics) return <p>❌ Error loading metrics</p>;

  return (
    <div className="dashboard">
      <h1>📊 Plinko Admin Dashboard</h1>

      <div className="cards">
        <div className="card">🎲 Total Bets: {metrics.totalBets}</div>
        <div className="card">💰 Total Wagered: {metrics.totalWagered.toFixed(4)} Pi</div>
        <div className="card">🏆 Total Payouts: {metrics.totalPayouts.toFixed(4)} Pi</div>
        <div className="card profit">📈 Profit: {metrics.profit.toFixed(4)} Pi</div>
      </div>

      <section>
        <h2>🏆 Leaderboard</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Total Winnings (Pi)</th>
            </tr>
          </thead>
          <tbody>
            {metrics.leaderboard.map((p, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{p._id}</td>
                <td>{p.totalWinnings.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>🎲 Recent Bets</h2>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Bet Amount</th>
              <th>Multiplier</th>
              <th>Winnings</th>
              <th>TxID</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recentBets.map((bet, idx) => (
              <tr key={idx}>
                <td>{bet.user}</td>
                <td>{bet.betAmount.toFixed(4)}</td>
                <td>{bet.multiplier}x</td>
                <td>{bet.winnings.toFixed(4)}</td>
                <td>{bet.txid.slice(0, 10)}...</td>
                <td>{new Date(bet.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;
