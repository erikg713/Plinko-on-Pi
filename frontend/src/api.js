/*
 * Plinko on Pi — backend API client.
 *
 * The backend is the authority for everything: auth, payments,
 * bets, and verification. The client never computes outcomes.
 */

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  ) + "/api/v1";

const TOKEN_KEY = "plinko_session_token";

export function getSessionToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function request(path, { method = "GET", body, headers } = {}) {
  const token = getSessionToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(
      (data && data.error && data.error.message) ||
        `Request failed (${res.status})`
    );
    err.code = data && data.error && data.error.code;
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  login: (accessToken) =>
    request("/auth/login", {
      method: "POST",
      body: { accessToken },
    }),

  me: () => request("/auth/me"),

  commitRound: () =>
    request("/provably-fair/commit", { method: "POST" }),

  approvePayment: (paymentId) =>
    request("/payments/approve", {
      method: "POST",
      body: { paymentId },
    }),

  completePayment: (paymentId, txid) =>
    request("/payments/complete", {
      method: "POST",
      body: { paymentId, txid },
    }),

  reconcilePayment: (paymentId) =>
    request("/payments/reconcile", {
      method: "POST",
      body: { paymentId },
    }),

  placeBet: ({ amount, rows, risk, roundId, clientSeed, paymentId }) =>
    request("/bets", {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: { amount, rows, risk, roundId, clientSeed, paymentId },
    }),

  myBets: (limit = 25) =>
    request(`/bets?limit=${limit}`),

  wallet: () => request("/wallet/balance"),

  withdraw: (amount) =>
    request("/wallet/withdraw", {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: { amount, currency: "PI" },
    }),

  leaderboard: () =>
    request("/leaderboard/top-winners"),

  verifyGame: (gameId) =>
    request(`/provably-fair/${gameId}`),
};
