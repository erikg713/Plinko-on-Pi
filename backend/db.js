/**
 * backend/db.js
 *
 * MongoDB connection helper using Mongoose.
 * - Handles connection lifecycle (connect, disconnect, error logging).
 * - Auto-retries in development.
 * - Ensures graceful shutdown on SIGINT / SIGTERM.
 */

'use strict';

const mongoose = require('mongoose');
const { MONGO_URI, NODE_ENV } = require('./config');

let isConnected = false;

/**
 * Connect to MongoDB
 */
async function connectDB() {
  if (isConnected) return;

  try {
    mongoose.set('strictQuery', true); // prevent query warnings

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // keep 10 sockets in pool
      serverSelectionTimeoutMS: 10000
    });

    isConnected = true;
    console.log(`✅ MongoDB connected → ${MONGO_URI}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);

    // In dev, auto-retry every 5s
    if (NODE_ENV !== 'production') {
      console.log('🔄 Retrying MongoDB connection in 5s...');
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1); // fail fast in prod
    }
  }
}

/**
 * Disconnect gracefully (used on shutdown).
 */
async function disconnectDB() {
  if (!isConnected) return;

  try {
    await mongoose.disconnect();
    console.log('🛑 MongoDB disconnected');
    isConnected = false;
  } catch (err) {
    console.error('⚠️ Error disconnecting MongoDB:', err.message);
  }
}

// Handle process termination (PM2, Docker, Ctrl+C, etc.)
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB
};
