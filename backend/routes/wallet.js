/**
 * Plinko-on-Pi
 * backend/routes/wallet.js
 *
 * Authenticated wallet API.
 *
 * Routes:
 *
 *   GET  /wallet
 *   GET  /wallet/balance
 *   GET  /wallet/transactions
 *   GET  /wallet/summary
 *
 *   POST /wallet/deposit
 *   POST /wallet/withdraw
 *
 * IMPORTANT:
 * ---------------------------------------------------------
 * The client NEVER supplies a new balance.
 *
 * Balance changes must be performed server-side inside a
 * database transaction.
 *
 * Pi deposits/withdrawals must eventually be connected to
 * verified Pi payment transactions. A client-provided
 * "amount" is NOT proof of payment.
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");
const config = require("../config");

const router = express.Router();

/* =========================================================
 * Constants
 * ========================================================= */

const MAX_TRANSACTION_LIMIT = 100;

const DEFAULT_LIMIT = 25;

const VALID_CURRENCIES = new Set([
    "PI",
]);

/* =========================================================
 * Helpers
 * ========================================================= */

function getRequestId(req) {
    return (
        req.requestId ||
        crypto.randomUUID()
    );
}

function asyncRoute(handler) {
    return async (
        req,
        res,
        next
    ) => {
        try {
            await handler(
                req,
                res,
                next
            );
        } catch (error) {
            next(error);
        }
    };
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
            requestId:
                getRequestId(req),
        },
    });
}

function requirePlayer(
    req,
    res,
    next
) {
    if (!req.player?.id) {
        return errorResponse(
            res,
            401,
            "AUTH_REQUIRED",
            "Player authentication is required.",
            req
        );
    }

    next();
}

function parseLimit(value) {
    const parsed =
        Number(
            value ??
                DEFAULT_LIMIT
        );

    if (
        !Number.isInteger(parsed) ||
        parsed < 1
    ) {
        return DEFAULT_LIMIT;
    }

    return Math.min(
        parsed,
        MAX_TRANSACTION_LIMIT
    );
}

function parseOffset(value) {
    const parsed =
        Number(value ?? 0);

    if (
        !Number.isInteger(parsed) ||
        parsed < 0
    ) {
        return 0;
    }

    return parsed;
}

function normalizeAmount(value) {
    const amount =
        Number(value);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return null;
    }

    return Number(
        amount.toFixed(8)
    );
}

function isValidCurrency(
    currency
) {
    return VALID_CURRENCIES.has(
        String(
            currency || "PI"
        ).toUpperCase()
    );
}

/* =========================================================
 * GET /wallet
 *
 * Complete wallet information.
 * ========================================================= */

router.get(
    "/",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const wallet =
                await db.one(
                    `
                    SELECT
                        id,
                        currency,
                        available_balance,
                        locked_balance,
                        total_deposited,
                        total_withdrawn,
                        created_at,
                        updated_at
                    FROM wallets
                    WHERE player_id = $1
                    `,
                    [
                        req.player.id,
                    ]
                );

            if (!wallet) {
                return errorResponse(
                    res,
                    404,
                    "WALLET_NOT_FOUND",
                    "Wallet was not found.",
                    req
                );
            }

            const available =
                Number(
                    wallet.available_balance
                );

            const locked =
                Number(
                    wallet.locked_balance
                );

            return res.json({
                data: {
                    id:
                        wallet.id,

                    currency:
                        wallet.currency,

                    availableBalance:
                        available,

                    lockedBalance:
                        locked,

                    totalBalance:
                        available +
                        locked,

                    totalDeposited:
                        Number(
                            wallet.total_deposited
                        ),

                    totalWithdrawn:
                        Number(
                            wallet.total_withdrawn
                        ),

                    createdAt:
                        wallet.created_at,

                    updatedAt:
                        wallet.updated_at,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /wallet/balance
 *
 * Lightweight endpoint for the game UI.
 * ========================================================= */

router.get(
    "/balance",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const wallet =
                await db.one(
                    `
                    SELECT
                        currency,
                        available_balance,
                        locked_balance
                    FROM wallets
                    WHERE player_id = $1
                    `,
                    [
                        req.player.id,
                    ]
                );

            if (!wallet) {
                return errorResponse(
                    res,
                    404,
                    "WALLET_NOT_FOUND",
                    "Wallet was not found.",
                    req
                );
            }

            return res.json({
                data: {
                    currency:
                        wallet.currency,

                    available:
                        Number(
                            wallet.available_balance
                        ),

                    locked:
                        Number(
                            wallet.locked_balance
                        ),

                    total:
                        Number(
                            wallet.available_balance
                        ) +
                        Number(
                            wallet.locked_balance
                        ),
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /wallet/summary
 * ========================================================= */

router.get(
    "/summary",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const summary =
                await db.one(
                    `
                    SELECT
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN type =
                                        'deposit'
                                    AND status =
                                        'completed'
                                    THEN amount
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS deposits,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN type =
                                        'withdrawal'
                                    AND status =
                                        'completed'
                                    THEN amount
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS withdrawals,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN type =
                                        'wager'
                                    AND status =
                                        'completed'
                                    THEN amount
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS wagers,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN type =
                                        'payout'
                                    AND status =
                                        'completed'
                                    THEN amount
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS payouts

                    FROM transactions

                    WHERE
                        player_id = $1
                    `,
                    [
                        req.player.id,
                    ]
                );

            return res.json({
                data: {
                    deposits:
                        Number(
                            summary.deposits
                        ),

                    withdrawals:
                        Number(
                            summary.withdrawals
                        ),

                    wagers:
                        Number(
                            summary.wagers
                        ),

                    payouts:
                        Number(
                            summary.payouts
                        ),
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /wallet/transactions
 * ========================================================= */

router.get(
    "/transactions",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const limit =
                parseLimit(
                    req.query.limit
                );

            const offset =
                parseOffset(
                    req.query.offset
                );

            const result =
                await db.query(
                    `
                    SELECT
                        id,
                        game_id,
                        type,
                        status,
                        amount,
                        balance_before,
                        balance_after,
                        reference,
                        metadata,
                        created_at,
                        completed_at
                    FROM transactions
                    WHERE player_id = $1
                    ORDER BY
                        created_at DESC
                    LIMIT $2
                    OFFSET $3
                    `,
                    [
                        req.player.id,
                        limit,
                        offset,
                    ]
                );

            return res.json({
                data:
                    result.rows.map(
                        (transaction) => ({
                            id:
                                transaction.id,

                            gameId:
                                transaction.game_id,

                            type:
                                transaction.type,

                            status:
                                transaction.status,

                            amount:
                                Number(
                                    transaction.amount
                                ),

                            balanceBefore:
                                Number(
                                    transaction.balance_before
                                ),

                            balanceAfter:
                                Number(
                                    transaction.balance_after
                                ),

                            reference:
                                transaction.reference,

                            metadata:
                                transaction.metadata,

                            createdAt:
                                transaction.created_at,

                            completedAt:
                                transaction.completed_at,
                        })
                    ),

                pagination: {
                    limit,
                    offset,
                    returned:
                        result.rows.length,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * POST /wallet/deposit
 *
 * IMPORTANT:
 *
 * This endpoint creates a deposit request.
 *
 * It DOES NOT credit the wallet merely because the client
 * says that a payment happened.
 *
 * A verified Pi payment callback/webhook must finalize the
 * deposit.
 * ========================================================= */

router.post(
    "/deposit",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const body =
                req.body || {};

            const amount =
                normalizeAmount(
                    body.amount
                );

            const currency =
                String(
                    body.currency ||
                        "PI"
                ).toUpperCase();

            const paymentId =
                typeof body.paymentId ===
                    "string"
                    ? body.paymentId.trim()
                    : null;

            if (
                amount === null
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_AMOUNT",
                    "Deposit amount must be a positive number.",
                    req
                );
            }

            if (
                !isValidCurrency(
                    currency
                )
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_CURRENCY",
                    "Unsupported wallet currency.",
                    req
                );
            }

            /*
             * A payment ID is required so the server can verify
             * the actual Pi payment instead of trusting the amount
             * submitted by the browser.
             */
            if (
                !paymentId ||
                paymentId.length >
                    255
            ) {
                return errorResponse(
                    res,
                    400,
                    "PAYMENT_ID_REQUIRED",
                    "A verified Pi payment ID is required.",
                    req
                );
            }

            const existing =
                await db.one(
                    `
                    SELECT
                        id,
                        status,
                        amount
                    FROM transactions
                    WHERE
                        reference = $1
                    LIMIT 1
                    `,
                    [
                        `pi:${paymentId}`,
                    ]
                );

            if (existing) {
                return res.status(200).json({
                    data: {
                        transactionId:
                            existing.id,

                        status:
                            existing.status,

                        amount:
                            Number(
                                existing.amount
                            ),

                        duplicate:
                            true,
                    },

                    requestId:
                        getRequestId(req),
                });
            }

            /*
             * Create a pending transaction.
             *
             * Do NOT update available_balance here.
             */
            const transaction =
                await db.one(
                    `
                    INSERT INTO transactions (
                        player_id,
                        type,
                        status,
                        amount,
                        balance_before,
                        balance_after,
                        reference,
                        metadata,
                        created_at
                    )
                    SELECT
                        $1,
                        'deposit',
                        'pending',
                        $2,
                        w.available_balance,
                        w.available_balance,
                        $3,
                        $4,
                        NOW()
                    FROM wallets w
                    WHERE
                        w.player_id = $1
                    RETURNING
                        id,
                        status,
                        amount,
                        reference,
                        created_at
                    `,
                    [
                        req.player.id,
                        amount,
                        `pi:${paymentId}`,
                        {
                            currency,
                            paymentId,
                            source:
                                "pi_payment",
                        },
                    ]
                );

            if (!transaction) {
                return errorResponse(
                    res,
                    404,
                    "WALLET_NOT_FOUND",
                    "Wallet was not found.",
                    req
                );
            }

            return res.status(202).json({
                data: {
                    transactionId:
                        transaction.id,

                    status:
                        transaction.status,

                    amount:
                        Number(
                            transaction.amount
                        ),

                    currency,

                    paymentId,

                    message:
                        "Deposit submitted for payment verification.",
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * POST /wallet/withdraw
 *
 * Creates a pending withdrawal request.
 *
 * Wallet funds are moved from available -> locked.
 *
 * Actual Pi transfer should happen through a server-side
 * payment service.
 * ========================================================= */

router.post(
    "/withdraw",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const body =
                req.body || {};

            const amount =
                normalizeAmount(
                    body.amount
                );

            const currency =
                String(
                    body.currency ||
                        "PI"
                ).toUpperCase();

            const destination =
                typeof body.destination ===
                    "string"
                    ? body.destination.trim()
                    : "";

            const idempotencyKey =
                req.get(
                    "Idempotency-Key"
                );

            if (
                !idempotencyKey ||
                idempotencyKey.length >
                    128
            ) {
                return errorResponse(
                    res,
                    400,
                    "IDEMPOTENCY_KEY_REQUIRED",
                    "Idempotency-Key is required.",
                    req
                );
            }

            if (
                amount === null
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_AMOUNT",
                    "Withdrawal amount must be a positive number.",
                    req
                );
            }

            if (
                !isValidCurrency(
                    currency
                )
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_CURRENCY",
                    "Unsupported wallet currency.",
                    req
                );
            }

            if (
                !destination ||
                destination.length >
                    255
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_DESTINATION",
                    "A valid withdrawal destination is required.",
                    req
                );
            }

            const existing =
                await db.one(
                    `
                    SELECT
                        id,
                        status,
                        amount
                    FROM transactions
                    WHERE
                        idempotency_key = $1
                    LIMIT 1
                    `,
                    [
                        idempotencyKey,
                    ]
                );

            if (existing) {
                return res.status(200).json({
                    data: {
                        transactionId:
                            existing.id,

                        status:
                            existing.status,

                        amount:
                            Number(
                                existing.amount
                            ),

                        duplicate:
                            true,
                    },

                    requestId:
                        getRequestId(req),
                });
            }

            const result =
                await db.transaction(
                    async (client) => {
                        /*
                         * Lock wallet row.
                         */
                        const wallet =
                            await client.query(
                                `
                                SELECT
                                    id,
                                    currency,
                                    available_balance,
                                    locked_balance
                                FROM wallets
                                WHERE
                                    player_id = $1
                                FOR UPDATE
                                `,
                                [
                                    req.player.id,
                                ]
                            );

                        if (
                            !wallet
                                .rows
                                .length
                        ) {
                            const error =
                                new Error(
                                    "Wallet not found."
                                );

                            error.code =
                                "WALLET_NOT_FOUND";

                            throw error;
                        }

                        const current =
                            Number(
                                wallet
                                    .rows[0]
                                    .available_balance
                            );

                        if (
                            current <
                            amount
                        ) {
                            const error =
                                new Error(
                                    "Insufficient balance."
                                );

                            error.code =
                                "INSUFFICIENT_BALANCE";

                            throw error;
                        }

                        /*
                         * Move funds from available to locked.
                         */
                        await client.query(
                            `
                            UPDATE wallets
                            SET
                                available_balance =
                                    available_balance - $1,

                                locked_balance =
                                    locked_balance + $1,

                                updated_at = NOW()
                            WHERE
                                player_id = $2
                            `,
                            [
                                amount,
                                req.player.id,
                            ]
                        );

                        const transaction =
                            await client.query(
                                `
                                INSERT INTO transactions (
                                    player_id,
                                    type,
                                    status,
                                    amount,
                                    balance_before,
                                    balance_after,
                                    idempotency_key,
                                    reference,
                                    metadata,
                                    created_at
                                )
                                VALUES (
                                    $1,
                                    'withdrawal',
                                    'pending',
                                    $2,
                                    $3,
                                    $4,
                                    $5,
                                    $6,
                                    $7,
                                    NOW()
                                )
                                RETURNING
                                    id,
                                    status,
                                    amount,
                                    created_at
                                `,
                                [
                                    req.player.id,
                                    amount,
                                    current,
                                    Number(
                                        (
                                            current -
                                            amount
                                        ).toFixed(
                                            8
                                        )
                                    ),
                                    idempotencyKey,
                                    `withdrawal:${crypto.randomUUID()}`,
                                    {
                                        currency,
                                        destination,
                                    },
                                ]
                            );

                        return {
                            transaction:
                                transaction
                                    .rows[0],

                            balance:
                                Number(
                                    (
                                        current -
                                        amount
                                    ).toFixed(
                                        8
                                    )
                                ),
                        };
                    }
                );

            return res.status(202).json({
                data: {
                    transactionId:
                        result.transaction
                            .id,

                    status:
                        result.transaction
                            .status,

                    amount:
                        Number(
                            result.transaction
                                .amount
                        ),

                    currency,

                    availableBalance:
                        result.balance,

                    message:
                        "Withdrawal submitted for processing.",
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * Error handler
 * ========================================================= */

router.use(
    (
        error,
        req,
        res,
        next
    ) => {
        if (
            res.headersSent
        ) {
            return next(error);
        }

        console.error(
            "[WALLET ERROR]",
            {
                requestId:
                    getRequestId(req),

                code:
                    error.code,

                message:
                    error.message,

                stack:
                    config.env.production
                        ? undefined
                        : error.stack,
            }
        );

        if (
            error.code ===
            "INSUFFICIENT_BALANCE"
        ) {
            return errorResponse(
                res,
                400,
                "INSUFFICIENT_BALANCE",
                "Insufficient available wallet balance.",
                req
            );
        }

        if (
            error.code ===
            "WALLET_NOT_FOUND"
        ) {
            return errorResponse(
                res,
                404,
                "WALLET_NOT_FOUND",
                "Wallet was not found.",
                req
            );
        }

        return errorResponse(
            res,
            500,
            "WALLET_ERROR",
            "Unable to process wallet request.",
            req
        );
    }
);

module.exports = router;
