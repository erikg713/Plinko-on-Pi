const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE}/leaderboard`);
  return res.json();
}

export async function fetchMetrics() {
  const res = await fetch(`${API_BASE}/admin/metrics`, {
    headers: { "x-admin-secret": process.env.REACT_APP_ADMIN_SECRET || "changeme" }
  });
  return res.json();
}

export async function placeBet(userId, betAmount) {
  const res = await fetch(`${API_BASE}/place-bet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, betAmount })
  });
  if (!res.ok) throw new Error("Bet failed");
  return res.json();
}
