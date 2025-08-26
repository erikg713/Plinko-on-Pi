require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/plinko",
  PI_API_KEY: process.env.PI_API_KEY,
  ADMIN_SECRET: process.env.ADMIN_SECRET || "changeme" // for admin routes
};    new URL(value);
    return value;
  } catch (err) {
    throw new Error(`Invalid ${name}: ${String(value)}. Please provide a valid URL.`);
  }
}

const NODE_ENV = (process.env.NODE_ENV || 'development').trim();
const IS_PRODUCTION = NODE_ENV === 'production';

const PORT = (() => {
  const raw = process.env.PORT ?? DEFAULTS.PORT;
  // allow string numbers like "5000"
  return parsePort(raw);
})();

const PI_API_URL = validateUrl(process.env.PI_API_URL ?? DEFAULTS.PI_API_URL, 'PI_API_URL');

const PI_API_KEY = (process.env.PI_API_KEY || '').trim() || null;

// Require PI_API_KEY in production; allow missing key in development with a warning.
if (IS_PRODUCTION && !PI_API_KEY) {
  throw new Error(
    'PI_API_KEY is required in production. Set PI_API_KEY in environment variables (see Pi Developer Portal).'
  );
}

if (!PI_API_KEY) {
  // Masking just in case logs accidentally include it later
  // (We do not log the key itself.)
  /* eslint-disable no-console */
  console.warn('PI_API_KEY is not set. Pi API calls will be unauthenticated or may fail. This is allowed in non-production environments.');
  /* eslint-enable no-console */
}

// Safely build headers for outgoing Pi API requests
const PI_API_HEADERS = {
  'Content-Type': 'application/json',
  ...(PI_API_KEY ? { Authorization: `Bearer ${PI_API_KEY}` } : {})
};

const config = Object.freeze({
  NODE_ENV,
  IS_PRODUCTION,
  PORT,
  PI_API_URL,
  PI_API_KEY, // sensitive: keep this only for places that truly need it
  PI_API_HEADERS
});

module.exports = config;
