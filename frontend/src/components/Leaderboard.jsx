import React from "react";

export default function Leaderboard({ data }) {
  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="card">
      <h2>Top winners</h2>
      {rows.length === 0 ? (
        <div className="muted small">
          No winners yet — be the first.
        </div>
      ) : (
        <table className="leaderboard">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Total won</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.player_id || i}>
                <td>{i + 1}</td>
                <td>
                  {row.username || "anonymous"}
                </td>
                <td>
                  {Number(
                    row.total_won || 0
                  ).toFixed(2)}{" "}
                  Pi
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
