/**
 * Plinko-on-Pi
 * backend/routes/wallet.js
 *
 * SKILL GAME — this is NOT a money wallet.
 *
 * There is no Pi balance here, no winnings, no deposits, and no
 * withdrawals. Pi moves only through the Pi Platform itself when
 * a player buys a fixed-price store item (drop packs, cosmetic
 * themes); the receipt is recorded in store_purchases.
 *
 * This endpoint returns the player's game inventory:
 *   - drops (free regenerating + purchased)
 *   - owned cosmetic themes
 *   - store purchase history
 *
 * Routes:
 *   GET /wallet
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");
const config = require("../config");

const router = express.Router();

const {
    authenticate: requirePlayer,
} = require("../middleware/auth");

function getRequestId(req) {
    return req.requestId || crypto.randomUUID();
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

function errorResponse(res, status, code, message, req) {
    return res.status(status).json({
        error: { code, message, requestId: getRequestId(req) },
    });
}

router.get(
    "/",
    requirePlayer,
    asyncRoute(async (req, res) => {
        const playerId = req.player.id;

        const invRes = await db.query(
            `INSERT INTO drop_inventory (player_id)
             VALUES ($1)
             ON CONFLICT (player_id) DO NOTHING
             RETURNING free_drops, purchased_drops, themes, next_regen_at`,
            [playerId]
        );
        let inv = invRes.rows[0];
        if (!inv) {
            const cur = await db.query(
                `SELECT free_drops, purchased_drops, themes, next_regen_at
                 FROM drop_inventory WHERE player_id = $1`,
                [playerId]
            );
            inv = cur.rows[0];
        }

        const purchases = await db.query(
            `SELECT item_id, item_kind, price_pi, created_at
             FROM store_purchases
             WHERE player_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [playerId]
        );

        return res.json({
            data: {
                drops: {
                    free: Number(inv.free_drops),
                    purchased: Number(inv.purchased_drops),
                    cap: config.skill.freeDropsCap,
                    nextRegenAt: inv.next_regen_at,
                },
                themes: inv.themes || ["midnight"],
                purchases: purchases.rows.map((p) => ({
                    itemId: p.item_id,
                    kind: p.item_kind,
                    pricePi: Number(p.price_pi),
                    createdAt: p.created_at,
                })),
            },
            requestId: getRequestId(req),
        });
    })
);

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("[WALLET ROUTE ERROR]", {
        requestId: getRequestId(req),
        message: error.message,
    });
    return errorResponse(res, 500, "WALLET_INTERNAL_ERROR", "Unable to load inventory.", req);
});

module.exports = router;
