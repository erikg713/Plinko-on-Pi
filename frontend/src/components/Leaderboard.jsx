import React, { useState } from "react";
import { api } from "../api";

/*
 * Leaderboard — skill rankings, points only (skill edition).
 * No Pi, no money, no payouts anywhere here.
 */

const BOARDS = [
  { id: "top-scorers", label: "Top scorers", columns: ["Player", "Points", "Runs", "Best run"] },
  { id: "best-streaks", label: "Best streaks", columns: ["Player", "Streak", "Target hits", "Runs"] },
  { id: "sharpest-aim", label: "Sharpest aim", columns: ["Player", "Accuracy", "Runs"] },
];

function rowCells(boardId, row) {
  if (boardId === "top-scorers")
    return [row.username || "anonymous", row.points, row.runs, row.best_run];
  if (boardId === "best-streaks")
    return [row.username || "anonymous", row.streak, row.target_hits, row.runs];
  return [row.username || "anonymous", `${Math.round(Number(row.accuracy || 0) * 100)}%`, row.runs];
}

export default function Leaderboard() {
  const [boardId, setBoardId] = useState("top-scorers");
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const board = BOARDS.find((b) => b.id === boardId);

  async function load(id) {
    setBoardId(id);
    setLoaded(false);
    try {
      const res = await api.leaderboard(id);
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoaded(true);
    }
  }

  // lazy-load the default board on first render
  React.useEffect(() => {
    load("top-scorers");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <h2>Leaderboard</h2>
      <div className="row" style={{ marginBottom: 8 }}>
        {BOARDS.map((b) => (
          <button
            key={b.id}
            className={b.id === boardId ? "" : "secondary"}
            onClick={() => load(b.id)}
            style={{ flex: 1 }}
          >
            {b.label}
          </button>
        ))}
      </div>
      {!loaded ? (
        <div className="muted small">Loading…</div>
      ) : data.length === 0 ? (
        <div className="muted small">
          No scores yet — be the first.
        </div>
      ) : (
        <table className="leaderboard">
          <thead>
            <tr>
              <th>#</th>
              {board.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.username || i}>
                <td>{i + 1}</td>
                {rowCells(boardId, row).map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="small muted" style={{ marginTop: 8 }}>
        Points are scores only — they can't be turned into Pi.
      </div>
    </div>
  );
}
