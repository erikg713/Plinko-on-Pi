/**
 * Plinko-on-Pi
 * backend/lib/piApi.js
 *
 * Server-side Pi Platform API client.
 *
 * Uses the app's API key (never exposed to the browser) for:
 *   - GET    /v2/payments/{payment_id}          (verify)
 *   - POST   /v2/payments/{payment_id}/approve  (approve U2A)
 *   - POST   /v2/payments/{payment_id}/complete (complete U2A)
 *   - POST   /v2/payments                       (create A2U)
 *
 * The user access token flow (GET /v2/me) lives in
 * routes/auth.js because it authenticates with the *user's*
 * token, not the app key.
 */

"use strict";

const config = require("../config");

function baseUrl() {
    const raw =
        (config.pi.apiUrl || "").replace(
            /\/+$/,
            ""
        );

    return raw || "https://api.minepi.com";
}

function appKey() {
    return config.pi.apiKey || "";
}

function timeoutMs() {
    return (
        config.pi.timeoutMs || 10000
    );
}

async function piFetch(
    path,
    { method = "GET", body } = {}
) {
    const key = appKey();

    if (!key) {
        const error = new Error(
            "Pi API key is not configured (PI_API_KEY)."
        );

        error.code =
            "PI_API_KEY_MISSING";

        throw error;
    }

    const controller =
        new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs()
    );

    let response;

    try {
        response = await fetch(
            `${baseUrl()}${path}`,
            {
                method,
                headers: {
                    Authorization: `Key ${key}`,
                    "Content-Type":
                        "application/json",
                },
                body:
                    body === undefined
                        ? undefined
                        : JSON.stringify(
                              body
                          ),
                signal:
                    controller.signal,
            }
        );
    } catch (err) {
        const error = new Error(
            "Could not reach the Pi Platform API."
        );

        error.code =
            "PI_API_UNREACHABLE";
        error.cause = err;

        throw error;
    } finally {
        clearTimeout(timeout);
    }

    let data = null;

    try {
        data =
            await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error = new Error(
            (data &&
                (data.message ||
                    data.error)) ||
                `Pi Platform API error (${response.status}).`
        );

        error.code =
            "PI_API_ERROR";
        error.status =
            response.status;
        error.data = data;

        throw error;
    }

    return data;
}

/* =========================================================
 * Payments
 * ========================================================= */

async function getPayment(
    paymentId
) {
    if (!paymentId) {
        throw new Error(
            "paymentId is required."
        );
    }

    return piFetch(
        `/v2/payments/${encodeURIComponent(
            paymentId
        )}`
    );
}

async function approvePayment(
    paymentId
) {
    return piFetch(
        `/v2/payments/${encodeURIComponent(
            paymentId
        )}/approve`,
        { method: "POST" }
    );
}

async function completePayment(
    paymentId,
    txid
) {
    if (!txid) {
        throw new Error(
            "txid is required to complete a payment."
        );
    }

    return piFetch(
        `/v2/payments/${encodeURIComponent(
            paymentId
        )}/complete`,
        {
            method: "POST",
            body: { txid },
        }
    );
}

/*
 * App-to-User payment (payouts / withdrawals).
 *
 * NOTE: wiring this to real value movement is a deliberate,
 * reviewed step. Callers must treat a created A2U payment as
 * pending until the Pi Platform confirms it.
 */
async function createAppToUserPayment({
    uid,
    amount,
    memo,
    metadata,
}) {
    if (!uid || !amount) {
        throw new Error(
            "uid and amount are required for A2U payments."
        );
    }

    return piFetch(`/v2/payments`, {
        method: "POST",
        body: {
            payment: {
                amount: Number(amount),
                memo:
                    memo ||
                    "Plinko-on-Pi withdrawal",
                metadata:
                    metadata || {},
            },
            uid,
        },
    });
}

module.exports = {
    baseUrl,
    getPayment,
    approvePayment,
    completePayment,
    createAppToUserPayment,
};
