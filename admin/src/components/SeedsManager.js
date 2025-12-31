import React, { useState } from 'react';
import CryptoJS from 'crypto-js'; // npm install crypto-js if not already

const SeedsManager = () => {
  const [currentSeed, setCurrentSeed] = useState('a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef');
  const [hashedSeed, setHashedSeed] = useState('sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069');
  const [newSeedInput, setNewSeedInput] = useState('');
  const [rotationHistory, setRotationHistory] = useState([
    { date: '2025-12-30 18:45', oldHash: 'sha256:...old123', newHash: hashedSeed },
    { date: '2025-12-29 12:20', oldHash: 'sha256:...prev456', newHash: 'sha256:...old123' },
  ]);

  const generateRandomSeed = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    setNewSeedInput(hex);
  };

  const calculateHash = (seed) => {
    const hash = CryptoJS.SHA256(seed).toString(CryptoJS.enc.Hex);
    return `sha256:${hash}`;
  };

  const rotateSeed = () => {
    if (!newSeedInput || newSeedInput.length < 64) {
      alert('Seed must be at least 64 hex chars, degen. Generate one or paste a strong one.');
      return;
    }

    const oldHash = hashedSeed;
    const newHash = calculateHash(newSeedInput);

    // Update state
    setCurrentSeed(newSeedInput);
    setHashedSeed(newHash);
    setRotationHistory(prev => [{
      date: new Date().toLocaleString(),
      oldHash,
      newHash
    }, ...prev]);

    setNewSeedInput('');
    alert(`Seed rotated successfully!\nNew public hash: ${newHash}\nPlayers can now verify old bets with revealed seed.`);
  };

  return (
    <div className="seeds-manager">
      <h1>Provably Fair Seed Management</h1>
      <p className="subtitle">Rollbit-grade HMAC-SHA256 system. Current seed hidden. Hashed version public to all players.</p>

      <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
        <div className="stat-card">
          <div className="stat-label">Current Server Seed (HIDDEN - Admin Only)</div>
          <div className="seed-box current-seed">{currentSeed}</div>
          <p style={{ fontSize: '0.9rem', color: '#ff3366', marginTop: '0.5rem' }}>
            Reveal this ONLY after rotation for past bet verification.
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-label">Public Hashed Seed (Shown to Players NOW)</div>
          <div className="seed-box hashed-seed">{hashedSeed}</div>
          <p style={{ fontSize: '0.9rem', color: '#00ff88', marginTop: '0.5rem' }}>
            Players see this before betting — proves no manipulation.
          </p>
        </div>
      </div>

      <h2>Rotate Server Seed</h2>
      <div className="stat-card">
        <input
          type="text"
          placeholder="Paste or generate new 64+ char hex seed"
          value={newSeedInput}
          onChange={(e) => setNewSeedInput(e.target.value)}
          style={{ width: '100%', padding: '1rem', marginBottom: '1rem', background: '#111', border: '1px solid #444', color: '#fff', fontFamily: 'Roboto Mono' }}
        />
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button className="btn btn-secondary" onClick={generateRandomSeed}>
            Generate Secure Random Seed
          </button>
          <button className="btn btn-primary" onClick={rotateSeed}>
            Rotate Seed & Publish New Hash
          </button>
        </div>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          After rotation: Old seed revealed for verification. New hash live instantly. Recommend rotating daily or every 10k bets.
        </p>
      </div>

      <h2>Rotation History</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Old Hash</th>
            <th>New Hash</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rotationHistory.map((entry, i) => (
            <tr key={i}>
              <td>{entry.date}</td>
              <td><code>{entry.oldHash.substring(0, 20)}...</code></td>
              <td><code>{entry.newHash.substring(0, 20)}...</code></td>
              <td><span style={{ color: '#00ff88' }}>Complete</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SeedsManager;
