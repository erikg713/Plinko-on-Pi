/**
 * Plinko-on-Pi
 * backend/routes/store.js
 *
 * SKILL GAME store — fixed-price Pi purchases.
 *
 * Pi payments here buy ONLY:
 *   - drop packs (extra aimed drops; same drops free players get
 *     by waiting — they never affect scoring or odds)
 *   - cosmetic board themes (purely visual)
 *
 * What this store NEVER does:
 *   - sell wagers, stakes, or entries into chance outcomes
 *   - pay out Pi or anything of value for winning
 *   - link a purchase to a game result in any way
 *
 * The Pi payment flow itself (approve / complete / reconcile in
 * routes/payments.js) is unchanged: every payment is verified
 * against the Pi Platform API, and one completed payment grants
 * exactly one item (no double-spend).
 *
 * Routes:
 *   GET  /store/catalog   (public)
 *   POST /store/purchase  (auth)
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");

const router = express.Router();

const {
    authenticate: requirePlayer,
} = require("../middleware/auth");

/* =========================================================
 * Catalog — fixed prices in Pi. Cosmetic / convenience only.
 * ========================================================= */

const CATALOG = [
    {
        id: "drop_pack_10",
        kind: "drops",
        name: "Drop Pack ×10",
        description: "10 extra drops. Same drops free players earn by waiting.",
        pricePi: 1,
        drops: 10,
    },
    {
        id: "drop_pack_50",
        kind: "drops",
        name: "Drop Pack ×50",
        description: "50 extra drops for long sessions.",
        pricePi: 4,
        drops: 50,
    },
    {
        id: "theme_neon",
        kind: "theme",
        name: "Neon Board Theme",
        description: "A neon look for your Plinko board. Cosmetic only.",
        pricePi: 2,
        theme: "neon",
    },
    {
        id: "theme_gold",
        kind: "theme",
        name: "Gold Board Theme",
        description: "A gold look for your Plinko board. Cosmetic only.",
        pricePi: 5,
        theme: "gold",
    },
];

function findItem(itemId) {
    return CATALOG.find((i) => i.id === itemId) || null;
}

/* =========================================================
 * Helpers
 * ========================================================= */

function requestId(req) {
    return req.requestId || crypto.randomUUID();
}

function errorResponse(res, status, code, message, req) {
    return res.status(status).json({
        error: { code, message, requestId: requestId(req) },
    });
}

function codedError(code, message, status) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = status || 400;
    return error;
}

function asyncRoute(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            next(error);
        }
    };
}

/* =========================================================
 * GET /store/catalog — public
 * ========================================================= */

router.get(
    "/catalog",
    asyncRoute(async (req, res) => {
        return res.json({
            data: CATALOG.map((i) => ({
                id: i.id,
                kind: i.kind,
                name: i.name,
                description: i.description,
                pricePi: i.pricePi,
            })),
            requestId: requestId(req),
        });
    })
);

/* =========================================================
 * POST /store/purchase
 * ========================================================= */

router.post(
    "/purchase",
    requirePlayer,
    asyncRoute(async (req, res) => {
        const playerId = req.player.id;
        const body = req.body || {};

        const item = findItem(String(body.itemId || ""));
        if (!item) {
            return errorResponse(res, 400, "UNKNOWN_ITEM", "That store item doesn't exist.", req);
        }

        const paymentId = String(body.paymentId || "").trim();
        if (!paymentId || paymentId.length > 128) {
            return errorResponse(
                res, 400, "INVALID_PAYMENT",
                "A completed Pi paymentId is required.", req
            );
        }

        const idempotencyKey = req.get("Idempotency-Key");
        if (!idempotencyKey || idempotencyKey.length > 128) {
            return errorResponse(
                res, 400, "IDEMPOTENCY_KEY_REQUIRED",
                "A valid Idempotency-Key header is required.", req
            );
        }

        const result = await db.transaction(async (client) => {
            // Idempotency: never grant the same request twice.
            const dup = await client.query(
                `SELECT id FROM store_purchases WHERE idempotency_key = $1 LIMIT 1`,
                [idempotencyKey]
            );
            if (dup.rows.length) {
                const existing = await client.query(
                    `SELECT * FROM store_purchases WHERE id = $1`,
                    [dup.rows[0].id]
                );
                return { duplicate: true, purchase: existing.rows[0] };
            }

            /*
             * The purchase must be funded by exactly one completed Pi
             * payment of EXACTLY the item price. Lock it so it can
             * never fund two purchases (no double-spend).
             */
            const payRes = await client.query(
                `SELECT id, amount, status, used_by_game_id, used_by_purchase_id
                 FROM pi_payments
                 WHERE pi_payment_id = $1 AND player_id = $2
                 FOR UPDATE`,
                [paymentId, playerId]
            );
            if (!payRes.rows.length) {
                throw codedError("PAYMENT_NOT_FOUND", "No such Pi payment for this player.");
            }
            const payment = payRes.rows[0];
            if (payment.status !== "completed") {
                throw codedError("PAYMENT_NOT_COMPLETED", "The Pi payment is not completed.");
            }
            if (payment.used_by_game_id || payment.used_by_purchase_id) {
                throw codedError("PAYMENT_ALREADY_USED", "This Pi payment was already used.");
            }
            if (Math.abs(Number(payment.amount) - item.pricePi) > 1e-9) {
                throw codedError(
                    "PAYMENT_AMOUNT_MISMATCH",
                    `This item costs exactly ${item.pricePi} Pi.`
                );
            }

            // Grant the item.
            let granted;
            if (item.kind === "drops") {
                await client.query(
                    `INSERT INTO drop_inventory (player_id)
                     VALUES ($1)
                     ON CONFLICT (player_id) DO NOTHING`,
                    [playerId]
                );
                await client.query(
                    `UPDATE drop_inventory
                     SET purchased_drops = purchased_drops + $1, updated_at = NOW()
                     WHERE player_id = $2`,
                    [item.drops, playerId]
                );
                granted = { drops: item.drops };
            } else if (item.kind === "theme") {
                await client.query(
                    `INSERT INTO drop_inventory (player_id)
                     VALUES ($1)
                     ON CONFLICT (player_id) DO NOTHING`,
                    [playerId]
                );
                await client.query(
                    `UPDATE drop_inventory
                     SET themes = array_append(themes, $1),
                         updated_at = NOW()
                     WHERE player_id = $2 AND NOT (themes @> ARRAY[$1])`,
                    [item.theme, playerId]
                );
                granted = { theme: item.theme };
            }

            const purchaseRes = await client.query(
                `INSERT INTO store_purchases (
                    player_id, item_id, item_kind, pi_payment_id,
                    price_pi, idempotency_key, granted
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [
                    playerId, item.id, item.kind, paymentId,
                    item.pricePi, idempotencyKey,
                    JSON.stringify(granted),
                ]
            );

            await client.query(
                `UPDATE pi_payments
                 SET used_by_purchase_id = $1, updated_at = NOW()
                 WHERE pi_payment_id = $2`,
                [purchaseRes.rows[0].id, paymentId]
            );

            return { duplicate: false, purchase: purchaseRes.rows[0], granted };
        });

        return res.status(result.duplicate ? 200 : 201).json({
            data: {
                purchase: {
                    id: result.purchase.id,
                    itemId: result.purchase.item_id,
                    pricePi: Number(result.purchase.price_pi),
                    createdAt: result.purchase.created_at,
                },
                granted: result.granted || JSON.parse(result.purchase.granted || "{}"),
                duplicate: result.duplicate,
            },
            requestId: requestId(req),
        });
    })
);

/* =========================================================
 * Route error handler
 * ========================================================= */

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("[STORE ROUTE ERROR]", {
        requestId: requestId(req),
        code: error.code,
        message: error.message,
    });
    const status = error.statusCode || 500;
    const code = error.code || "STORE_INTERNAL_ERROR";
    const message = status < 500 ? error.message : "Unable to complete purchase.";
    return errorResponse(res, status, code, message, req);
});

module.exports = router;
