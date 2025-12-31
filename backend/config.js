// backend/src/config.js
// EdgeRush Backend Config - All env vars centralized, validated, ready to dominate

require('dotenv').config(); // Load .env early

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/edgerush',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'fallback_super_weak_secret_change_this_now',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Provably Fair Core
  currentServerSeed: process.env.CURRENT_SERVER_SEED || null, // MUST be set in .env for production
  hashedServerSeed: null, // Calculated on startup

  // Game Settings (Rollbit-grade)
  houseEdge: 0.01, // 1% house edge = 99% RTP
  maxBetAmount: 1000000, // Max bet in Pi (adjust as needed)
  minBetAmount: 1,
  maxMultiDrop: 100, // Max balls per drop

  // Rate Limiting
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: 1000,

  // CORS (update with your actual domains)
  allowedOrigins: [
    'http://localhost:3000', // Frontend dev
    'http://localhost:3001', // Admin dev
    process.env.FRONTEND_URL || 'https://your-edgerush-frontend.vercel.app',
    process.env.ADMIN_URL || 'https://your-edgerush-admin.vercel.app',
  ],
};

// Validate critical env vars
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
const missing = requiredEnvVars.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('🚨 MISSING REQUIRED ENV VARS:', missing.join(', '));
  console.error('Fix your .env file, degen. Server will crash without these.');
  process.exit(1);
}

// Validate or generate hashed seed
if (!config.currentServerSeed) {
  console.warn('⚠️  NO CURRENT_SERVER_SEED in .env – generating temporary one (NOT for production)');
  const crypto = require('crypto');
  config.currentServerSeed = crypto.randomBytes(32).toString('hex');
}

const cryptoJS = require('crypto-js');
config.hashedServerSeed = `sha256:${cryptoJS.SHA256(config.currentServerSeed).toString(cryptoJS.enc.Hex)}`;

console.log('🔒 Current Hashed Seed (Public):', config.hashedServerSeed);
// DO NOT log the raw currentServerSeed in production

// Development helpers
if (config.nodeEnv === 'development') {
  console.log('🛠️  Running in DEVELOPMENT mode');
  console.log('🌐 Server will listen on port:', config.port);
  console.log('🍃 MongoDB URI:', config.mongoUri);
}

module.exports = config;
