import React from "react";

export default function Leaderboard({ data }) {
  return (
    <div>
      <h2>🏆 Leaderboard</h2>
      <ul>
        {data.map((entry, i) => (
          <li key={i}>
            {entry.rank}. {entry.user} — {entry.totalWinnings} Pi
          </li>
        ))}
      </ul>
    </div>
  );
}
