/*
 * Plinko on Pi — backend API client (skill edition).
 *
 * The backend is the authority for: auth, Pi payments, skill-run
 * scoring, drop inventory, and the store. Points are scores only —
 * they are never convertible to Pi or anything of value.
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
  /* ---------- auth (Pi sign-in, unchanged) ---------- */

  login: (accessToken) =>
    request("/auth/login", {
      method: "POST",
      body: { accessToken },
    }),

  me: () => request("/auth/me"),

  /* ---------- Pi payments (fixed-price store purchases only) ---------- */

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

  /* ---------- skill runs ---------- */

  startRun: ({ dropX, rows, spread }) =>
    request("/runs/start", {
      method: "POST",
      body: { dropX, rows, spread },
    }),

  submitRun: ({ runId, path, bin, releaseMs }) =>
    request("/runs/submit", {
      method: "POST",
      body: { runId, path, bin, releaseMs },
    }),

  myRuns: (limit = 25) =>
    request(`/runs?limit=${limit}`),

  /* ---------- inventory ---------- */

  inventory: () => request("/wallet"),

  /* ---------- store (drop packs + cosmetic themes) ---------- */

  catalog: () => request("/store/catalog"),

  purchase: ({ itemId, paymentId }) =>
    request("/store/purchase", {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: { itemId, paymentId },
    }),

  /* ---------- leaderboards (points only) ---------- */

  leaderboard: (board = "top-scorers") =>
    request(`/leaderboard/${board}`),
};
