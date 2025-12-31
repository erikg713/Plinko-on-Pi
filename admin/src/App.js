import React, { useState, useEffect } from 'react';
import './App.css';
import SeedsManager from './components/SeedsManager';

// In render:
{activeTab === 'seeds' && <SeedsManager />}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentSeed, setCurrentSeed] = useState('a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef');
  const [hashedSeed, setHashedSeed] = useState('sha256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069');
  const [newSeed, setNewSeed] = useState('');

  // Mock data - replace with real API calls later
  const stats = {
    totalBets: 12457,
    totalVolume: '892,341 Pi',
    activePlayers: 342,
    houseProfit: '8,923 Pi',
  };

  const recentBets = [
    { id: 'BET-8921', user: 'pioneer_abc123', amount: 50, multiplier: 'x130', win: 6500, time: '2 min ago' },
    { id: 'BET-8920', user: 'degen_xyz', amount: 100, multiplier: 'x0.5', win: 0, time: '3 min ago' },
    { id: 'BET-8919', user: 'moonboy_69', amount: 10, multiplier: 'x1000', win: 10000, time: '5 min ago' },
    { id: 'BET-8918', user: 'pi_whale', amount: 500, multiplier: 'x9', win: 4500, time: '8 min ago' },
  ];

  const rotateSeed = () => {
    if (!newSeed) return alert('Enter a new seed, degen.');
    setCurrentSeed(newSeed);
    setHashedSeed(`sha256: ${Math.random().toString(36).substring(2)}`); // Mock hash
    setNewSeed('');
    alert('Server seed rotated. New hashed seed published to players.');
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="admin-header">
        <div className="logo">EdgeRush Admin</div>
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>LIVE - Mainnet</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          Dashboard
        </div>
        <div className={`nav-item ${activeTab === 'bets' ? 'active' : ''}`} onClick={() => setActiveTab('bets')}>
          Bet History
        </div>
        <div className={`nav-item ${activeTab === 'seeds' ? 'active' : ''}`} onClick={() => setActiveTab('seeds')}>
          Provably Fair Seeds
        </div>
        <div className={`nav-item ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>
          Players
        </div>
        <div className={`nav-item ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>
          Manual Payouts
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            <h1>Dashboard</h1>
            <div className="dashboard-grid">
              <div className="stat-card">
                <div className="stat-label">Total Bets Today</div>
                <div className="stat-value">{stats.totalBets.toLocaleString()}</div>
                <div className="stat-change positive">+18.4%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Volume</div>
                <div className="stat-value">{stats.totalVolume}</div>
                <div className="stat-change positive">+42.1%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Players</div>
                <div className="stat-value">{stats.activePlayers}</div>
                <div className="stat-change positive">+67 online</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">House Profit (24h)</div>
                <div className="stat-value">{stats.houseProfit}</div>
                <div className="stat-change positive">+1.0% edge</div>
              </div>
            </div>

            <h2>Recent Big Wins</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bet ID</th>
                  <th>User</th>
                  <th>Bet Amount</th>
                  <th>Multiplier</th>
                  <th>Win</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentBets.map(bet => (
                  <tr key={bet.id}>
                    <td>{bet.id}</td>
                    <td>{bet.user}</td>
                    <td>{bet.amount} Pi</td>
                    <td style={{ color: bet.multiplier.includes('x0') ? '#ff3366' : '#00ff88' }}>
                      {bet.multiplier}
                    </td>
                    <td style={{ color: bet.win > 0 ? '#00ff88' : '#ff3366' }}>
                      {bet.win > 0 ? `+${bet.win}` : 'Bust'}
                    </td>
                    <td>{bet.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {activeTab === 'seeds' && (
          <>
            <h1>Provably Fair Seed Management</h1>
            <div className="stat-card">
              <h3>Current Server Seed (Hidden)</h3>
              <div className="seed-box current-seed">{currentSeed}</div>

              <h3>Hashed Seed (Public - Shown to Players)</h3>
              <div className="seed-box hashed-seed">{hashedSeed}</div>

              <h3>Rotate Server Seed</h3>
              <input
                type="text"
                placeholder="Enter new random 64-char hex seed"
                value={newSeed}
                onChange={(e) => setNewSeed(e.target.value)}
                style={{ width: '100%', padding: '1rem', margin: '1rem 0', background: '#111', border: '1px solid #444', color: '#fff' }}
              />
              <button className="btn btn-primary" onClick={rotateSeed}>
                Rotate Seed & Publish New Hash
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
                Players can verify all past bets with revealed old seeds. New hash is live immediately.
              </p>
            </div>
          </>
        )}

        {activeTab === 'bets' && (
          <><h1>Full Bet History</h1><p>Table + filters coming soon, degen.</p></>
        )}

        {activeTab === 'players' && (
          <><h1>Player Management</h1><p>Search, ban, view stats – next update.</p></>
        )}

        {activeTab === 'payouts' && (
          <><h1>Manual Payouts</h1><p>For disputes or bonuses – secure Pi.transfer coming.</p></>
        )}
      </main>
    </div>
  );
}

export default App;
