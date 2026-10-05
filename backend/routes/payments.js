/**
 * Plinko-on-Pi
 * backend/routes/payments.js
 *
 * Pi Network U2A (user-to-app) payment endpoints.
 *
 * Frontend flow (Pi SDK):
 *   1. Pi.createPayment({ amount, memo, metadata },
 *        { onReadyForServerApproval, onReadyForServerCompletion,
 *          onCancel, onError })
 *   2. onReadyForServerApproval(paymentId)
 *        -> POST /payments/approve { paymentId }
 *        -> server verifies with the Pi Platform API, then approves.
 *   3. User confirms in the Pi wallet.
 *   4. onReadyForServerCompletion(paymentId, txid)
 *        -> POST /payments/complete { paymentId, txid }
 *        -> server verifies the txid matches, then completes.
 *   5. POST /bets { paymentId, ... } settles the wager against
 *      the completed payment (1:1 link, enforced in bets.js).
 *
 * Recovery:
 *   Pi.authenticate(..., onIncompletePaymentFound) ->
 *   POST /payments/reconcile { paymentId } finishes stranded
 *   payments so user funds are never lost mid-flow.
 *
 * Every state change is verified against the Pi Platform API
 * with the server API key. The client is never trusted about
 * payment status.
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");

const {
    authenticate,
} = require("../middleware/auth");

const piApi = require("../lib/piApi");

const router = express.Router();

/* =========================================================
 * Helpers
 * ========================================================= */

function getRequestId(req) {
    return req.requestId || crypto.randomUUID();
}

function errorResponse(
    res,
    status,
    code,
    message,
    req
) {
    return res.status(status).json({
        error: {
            code,
            message,
            requestId: getRequestId(req),
        },
    });
}

function asyncRoute(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res);
        } catch (error) {
            next(error);
        }
    };
}

function publicPayment(row) {
    return {
        id: row.id,
        paymentId: row.pi_payment_id,
        amount: Number(row.amount),
        memo: row.memo,
        status: row.status,
        txid: row.txid,
        usedByGameId: row.used_by_game_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/*
 * Upsert the Pi payment into our ledger. The Pi Platform is
 * the source of truth for status; this table is our local
 * mirror plus the 1:1 bet link.
 */
async function upsertPayment(
    client,
    {
        playerId,
        piPaymentId,
        amount,
        memo,
        status,
        txid,
        raw,
    }
) {
    const res = await client.query(
        `INSERT INTO pi_payments (
            player_id, pi_payment_id, amount, memo,
            status, txid, raw, updated_at
         ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
         )
         ON CONFLICT (pi_payment_id) DO UPDATE SET
            status = EXCLUDED.status,
            txid = COALESCE(EXCLUDED.txid, pi_payments.txid),
            raw = EXCLUDED.raw,
            updated_at = NOW()
         RETURNING *`,
        [
            playerId,
            piPaymentId,
            amount,
            memo || null,
            status,
            txid || null,
            JSON.stringify(raw || {}),
        ]
    );

    return res.rows[0];
}

/*
 * The payment must have been created by this player. The
 * frontend stamps metadata.uid at Pi.createPayment time;
 * the Pi Platform echoes metadata back on GET /payments.
 */
function assertOwnedByPlayer(
    piPayment,
    player
) {
    const metaUid =
        piPayment &&
        piPayment.metadata &&
        (piPayment.metadata.uid ||
            piPayment.metadata.pi_uid);

    if (
        metaUid &&
        metaUid !== player.externalId &&
        metaUid !== player.username
    ) {
        const error = new Error(
            "This Pi payment belongs to a different player."
        );

        error.code = "PAYMENT_OWNERSHIP_MISMATCH";
        error.statusCode = 403;

        throw error;
    }
}

/* =========================================================
 * POST /payments/approve
 * ========================================================= */

router.post(
    "/approve",
    authenticate,
    asyncRoute(async (req, res) => {
        const paymentId = String(
            req.body && req.body.paymentId
                ? req.body.paymentId
                : ""
        ).trim();

        if (!paymentId) {
            return errorResponse(
                res,
                400,
                "INVALID_PAYMENT_ID",
                "paymentId is required.",
                req
            );
        }

        // 1. Read the live payment from the Pi Platform.
        const piPayment =
            await piApi.getPayment(paymentId);

        assertOwnedByPlayer(
            piPayment,
            req.player
        );

        const txStatus =
            piPayment.status || {};

        if (
            txStatus.cancelled ||
            txStatus.user_cancelled
        ) {
            await db.query(
                `INSERT INTO pi_payments (
                    player_id, pi_payment_id, amount, memo,
                    status, raw, updated_at
                 ) VALUES ($1,$2,$3,$4,'cancelled',$5,NOW())
                 ON CONFLICT (pi_payment_id) DO UPDATE SET
                    status = 'cancelled',
                    raw = EXCLUDED.raw,
                    updated_at = NOW()`,
                [
                    req.player.id,
                    paymentId,
                    Number(
                        piPayment.amount || 0
                    ),
                    piPayment.memo || null,
                    JSON.stringify(
                        piPayment
                    ),
                ]
            );

            return errorResponse(
                res,
                409,
                "PAYMENT_CANCELLED",
                "This Pi payment was cancelled.",
                req
            );
        }

        // 2. Approve on the Pi Platform.
        const approved =
            await piApi.approvePayment(
                paymentId
            );

        // 3. Mirror locally.
        const row = await db.transaction(
            async (client) =>
                upsertPayment(client, {
                    playerId: req.player.id,
                    piPaymentId: paymentId,
                    amount: Number(
                        piPayment.amount || 0
                    ),
                    memo:
                        piPayment.memo ||
                        null,
                    status: "approved",
                    raw:
                        approved ||
                        piPayment,
                })
        );

        return res.json({
            data: {
                payment:
                    publicPayment(row),
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * POST /payments/complete
 * ========================================================= */

router.post(
    "/complete",
    authenticate,
    asyncRoute(async (req, res) => {
        const body = req.body || {};

        const paymentId = String(
            body.paymentId || ""
        ).trim();

        const txid = String(
            body.txid || ""
        ).trim();

        if (!paymentId || !txid) {
            return errorResponse(
                res,
                400,
                "INVALID_INPUT",
                "paymentId and txid are required.",
                req
            );
        }

        // 1. Read the live payment and verify the txid matches
        //    what the Pi Platform recorded. Never trust the
        //    client about this.
        const piPayment =
            await piApi.getPayment(paymentId);

        assertOwnedByPlayer(
            piPayment,
            req.player
        );

        const chainTxid =
            piPayment.transaction &&
            piPayment.transaction.txid;

        if (chainTxid && chainTxid !== txid) {
            return errorResponse(
                res,
                409,
                "TXID_MISMATCH",
                "The txid does not match the Pi Platform record.",
                req
            );
        }

        // 2. Complete on the Pi Platform.
        const completed =
            await piApi.completePayment(
                paymentId,
                txid
            );

        // 3. Mirror locally as completed: now usable by /bets.
        const row = await db.transaction(
            async (client) =>
                upsertPayment(client, {
                    playerId: req.player.id,
                    piPaymentId: paymentId,
                    amount: Number(
                        piPayment.amount || 0
                    ),
                    memo:
                        piPayment.memo ||
                        null,
                    status: "completed",
                    txid,
                    raw:
                        completed ||
                        piPayment,
                })
        );

        return res.json({
            data: {
                payment:
                    publicPayment(row),
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * POST /payments/reconcile
 *
 * Recovery for onIncompletePaymentFound: ask the Pi Platform
 * what really happened and finish the payment accordingly.
 * ========================================================= */

router.post(
    "/reconcile",
    authenticate,
    asyncRoute(async (req, res) => {
        const paymentId = String(
            req.body && req.body.paymentId
                ? req.body.paymentId
                : ""
        ).trim();

        if (!paymentId) {
            return errorResponse(
                res,
                400,
                "INVALID_PAYMENT_ID",
                "paymentId is required.",
                req
            );
        }

        const piPayment =
            await piApi.getPayment(paymentId);

        assertOwnedByPlayer(
            piPayment,
            req.player
        );

        const status = piPayment.status || {};
        const txid =
            piPayment.transaction &&
            piPayment.transaction.txid;

        let localStatus = "created";

        if (
            status.cancelled ||
            status.user_cancelled
        ) {
            localStatus = "cancelled";
        } else if (
            status.developer_completed &&
            status.transaction_verified
        ) {
            /*
             * The chain settled but our complete call never
             * landed (e.g. dropped connection). Finish it now.
             */
            if (txid) {
                await piApi.completePayment(
                    paymentId,
                    txid
                );
            }

            localStatus = "completed";
        } else if (
            status.developer_approved
        ) {
            localStatus = "approved";
        }

        const row = await db.transaction(
            async (client) =>
                upsertPayment(client, {
                    playerId: req.player.id,
                    piPaymentId: paymentId,
                    amount: Number(
                        piPayment.amount || 0
                    ),
                    memo:
                        piPayment.memo ||
                        null,
                    status: localStatus,
                    txid: txid || null,
                    raw: piPayment,
                })
        );

        return res.json({
            data: {
                payment:
                    publicPayment(row),
                reconciled: true,
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * GET /payments
 *
 * The player's own payment history.
 * ========================================================= */

router.get(
    "/",
    authenticate,
    asyncRoute(async (req, res) => {
        const limit = Math.min(
            Math.max(
                Number(
                    req.query.limit ||
                        25
                ),
                1
            ),
            100
        );

        const result = await db.query(
            `SELECT id, pi_payment_id, amount, memo, status,
                    txid, used_by_game_id, created_at, updated_at
             FROM pi_payments
             WHERE player_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [req.player.id, limit]
        );

        return res.json({
            data: {
                payments: result.rows.map(
                    publicPayment
                ),
            },
            requestId: getRequestId(req),
        });
    })
);

module.exports = router;
