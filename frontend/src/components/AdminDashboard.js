import React, { useEffect, useState } from "react";
import { fetchMetrics } from "../api";

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetchMetrics().then(setMetrics);
  }, []);

  if (!metrics) return <p>Loading admin metrics...</p>;

  return (
    <div className="admin">
      <h2>📊 Admin Dashboard</h2>
      <p>Total Bets: {metrics.totalBets}</p>
      <p>Total Wagered: {metrics.totalWagered} Pi</p>
      <p>Total Payouts: {metrics.totalPayouts} Pi</p>
      <p>Profit: {metrics.profit} Pi</p>
    </div>
  );
}
