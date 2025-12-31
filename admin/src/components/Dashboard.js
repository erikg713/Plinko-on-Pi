import React from 'react';

const Dashboard = () => {
  // Mock real-time data - replace with API fetch later
  const stats = {
    totalBets: 12457,
    totalVolume: '892,341 Pi',
    activePlayers: 342,
    houseProfit: '8,923 Pi',
    bigWinsToday: 18,
    edgeHitRate: '0.42%',
  };

  const recentBets = [
    { id: 'BET-8921', user: 'pioneer_abc123', amount: 50, multiplier: 'x130', win: 6500, profit: true, time: '2 min ago' },
    { id: 'BET-8920', user: 'degen_xyz', amount: 100, multiplier: 'x0.5', win: 0, profit: false, time: '3 min ago' },
    { id: 'BET-8919', user: 'moonboy_69', amount: 10, multiplier: 'x1000', win: 10000, profit: true, time: '5 min ago' },
    { id: 'BET-8918', user: 'pi_whale', amount: 500, multiplier: 'x9', win: 4500, profit: true, time: '8 min ago' },
    { id: 'BET-8917', user: 'edge_chaser', amount: 200, multiplier: 'x10000', win: 2000000, profit: true, time: '12 min ago' },
  ];

  return (
    <div className="dashboard">
      <h1>Dashboard Overview</h1>
      <p className="subtitle">Live stats from EdgeRush on Pi Network – degen activity in real time.</p>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Total Bets (24h)</div>
          <div className="stat-value">{stats.totalBets.toLocaleString()}</div>
          <div className="stat-change positive">+18.4% vs yesterday</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Volume</div>
          <div className="stat-value">{stats.totalVolume}</div>
          <div className="stat-change positive">+42.1% volume surge</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Players</div>
          <div className="stat-value">{stats.activePlayers}</div>
          <div className="stat-change positive">+67 online now</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">House Profit (24h)</div>
          <div className="stat-value">{stats.houseProfit}</div>
          <div className="stat-change positive">Holding 1.0% edge</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">x1000+ Hits Today</div>
          <div className="stat-value">{stats.bigWinsToday}</div>
          <div className="stat-change positive">Edge chasers feasting</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Max Edge Hit Rate</div>
          <div className="stat-value">{stats.edgeHitRate}</div>
          <div className="stat-change negative">Degen mode active</div>
        </div>
      </div>

      <h2>Recent Activity & Big Wins</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Bet ID</th>
            <th>Player</th>
            <th>Bet</th>
            <th>Multiplier</th>
            <th>Payout</th>
            <th>Profit/Loss</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {recentBets.map((bet) => (
            <tr key={bet.id} className={bet.profit ? 'win-row' : 'loss-row'}>
              <td><strong>{bet.id}</strong></td>
              <td>{bet.user}</td>
              <td>{bet.amount} Pi</td>
              <td style={{
                color: bet.multiplier.includes('x0') || bet.multiplier === 'x0.5' ? '#ff3366' : 
                       bet.multiplier.includes('x1000') || bet.multiplier.includes('x10000') ? '#00ffcc' : '#ffff00'
              }}>
                <strong>{bet.multiplier}</strong>
              </td>
              <td style={{ color: bet.win > 0 ? '#00ff88' : '#ff3366' }}>
                {bet.win > 0 ? `+${bet.win.toLocaleString()} Pi` : 'BUST'}
              </td>
              <td style={{ color: bet.profit ? '#00ff88' : '#ff3366' }}>
                {bet.profit ? 'PLAYER WIN' : 'HOUSE WIN'}
              </td>
              <td>{bet.time}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '2rem', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
        Real-time updates via WebSocket coming next. EdgeRush is live and eating.
      </div>
    </div>
  );
};

export default Dashboard;
