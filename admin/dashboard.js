async function fetchDashboard() {
  try {
    const res = await fetch("https://yourbackend.com/admin/metrics");
    const data = await res.json();

    document.getElementById("totalBets").innerText = data.totalBets;
    document.getElementById("totalWagered").innerText = data.totalWagered.toFixed(2);
    document.getElementById("totalPayouts").innerText = data.totalPayouts.toFixed(2);
    document.getElementById("totalProfit").innerText = data.profit.toFixed(2);

    // Recent Bets
    const betsTable = document.getElementById("recentBets");
    betsTable.innerHTML = "";
    data.recentBets.forEach(bet => {
      let row = `<tr>
        <td>${bet.user}</td>
        <td>${bet.betAmount}</td>
        <td>x${bet.multiplier}</td>
        <td>${bet.winnings.toFixed(2)}</td>
        <td>${new Date(bet.timestamp).toLocaleString()}</td>
      </tr>`;
      betsTable.innerHTML += row;
    });

    // Leaderboard
    const list = document.getElementById("leaderboardList");
    list.innerHTML = "";
    data.leaderboard.forEach(player => {
      let li = document.createElement("li");
      li.textContent = `${player._id} — ${player.totalWinnings.toFixed(2)} Pi`;
      list.appendChild(li);
    });

  } catch (err) {
    console.error("Dashboard fetch error:", err);
  }
}

// Refresh every 30s
fetchDashboard();
setInterval(fetchDashboard, 30000);
