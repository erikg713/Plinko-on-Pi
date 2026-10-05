/**
 * Plinko-on-Pi
 * backend/routes/bets.js
 *
 * Player betting API.
 *
 * Routes:
 *   POST /bets
 *   GET  /bets
 *   GET  /bets/:gameId
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const config = require("../config");
const db = require("../db");

const {
    derivePath,
    multiplierFor,
} = require("../lib/provablyFair");

const router = express.Router();

const {
    authenticate: requirePlayer,
} = require("../middleware/auth");

/* =========================================================
 * Constants
 * ========================================================= */

const ALLOWED_RISKS = new Set([
    "low",
    "medium",
    "high",
]);

/* =========================================================
 * Helpers
 * ========================================================= */

function requestId(req) {
    return (
        req.requestId ||
        crypto.randomUUID()
    );
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
                requestId(req),
        },
    });
}

function codedError(code, message, status) {
    const error = new Error(message);

    error.code = code;
    error.statusCode = status || 400;

    return error;
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

function isPositiveNumber(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0
    );
}

function normalizeAmount(value) {
    const amount =
        Number(value);

    if (
        !Number.isFinite(amount)
    ) {
        return null;
    }

    return Number(
        amount.toFixed(8)
    );
}

function randomInt(max) {
    return crypto.randomInt(
        0,
        max
    );
}

/* =========================================================
 * Player authentication
 * =========================================================
 *
 * Expected:
 *
 * req.player = {
 *     id: "uuid",
 *     externalId: "...",
 * }
 *
 * The real authentication middleware should populate this.
 */

/* =========================================================
 * Bet validation
 * ========================================================= */

function validateBet(body) {
    const amount = normalizeAmount(body.amount);
    const rows = Number(body.rows);
    const risk = String(body.risk || config.game.defaultRisk).toLowerCase();

    if (amount === null || !isPositiveNumber(amount)) {
        return { valid: false, code: "INVALID_AMOUNT",
            message: "Bet amount must be a positive number." };
    }
    if (amount < config.game.minWager || amount > config.game.maxWager) {
        return { valid: false, code: "INVALID_AMOUNT",
            message: `Bet amount must be between ${config.game.minWager} and ${config.game.maxWager}.` };
    }
    if (!Number.isInteger(rows)) {
        return { valid: false, code: "INVALID_ROWS",
            message: "Rows must be an integer." };
    }
    if (rows < config.game.minRows || rows > config.game.maxRows) {
        return { valid: false, code: "INVALID_ROWS",
            message: `Rows must be between ${config.game.minRows} and ${config.game.maxRows}.` };
    }
    if (!ALLOWED_RISKS.has(risk)) {
        return { valid: false, code: "INVALID_RISK",
            message: "Risk must be low, medium, or high." };
    }

    const roundId = String(body.roundId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roundId)) {
        return { valid: false, code: "INVALID_ROUND",
            message: "A valid provably-fair roundId (from /provably-fair/commit) is required." };
    }

    const clientSeed = String(body.clientSeed || "").trim();
    if (!/^[a-f0-9]{8,128}$/i.test(clientSeed)) {
        return { valid: false, code: "INVALID_CLIENT_SEED",
            message: "clientSeed must be 8-128 hex characters." };
    }

    const paymentId = String(body.paymentId || "").trim();
    if (!paymentId || paymentId.length > 128) {
        return { valid: false, code: "INVALID_PAYMENT",
            message: "A completed Pi paymentId is required to fund the bet." };
    }

    return { valid: true,
        value: { amount, rows, risk, roundId, clientSeed, paymentId } };
}

/* =========================================================
 * Plinko result
 * =========================================================
 *
 * This is intentionally deterministic from the generated
 * random bytes for the round.
 *
 * Production provably-fair generation should be moved into
 * a dedicated service and use the committed server seed +
 * client seed + nonce.
 */

/* =========================================================
 * POST /bets
 * ========================================================= */

router.post(
    "/",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const validation =
                validateBet(
                    req.body || {}
                );

            if (
                !validation.valid
            ) {
                return errorResponse(
                    res,
                    400,
                    validation.code,
                    validation.message,
                    req
                );
            }

            const {
                amount,
                rows,
                risk,
            } =
                validation.value;

            /*
             * Idempotency prevents accidental double bets.
             */
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
                    "A valid Idempotency-Key header is required.",
                    req
                );
            }

            const playerId =
                req.player.id;

            const result =
                await db.transaction(
                    async (client) => {
                        // Idempotency: never settle the same request twice.
                        const existing = await client.query(
                            `SELECT t.game_id FROM transactions t
                             WHERE t.idempotency_key = $1 LIMIT 1`,
                            [idempotencyKey]
                        );

                        if (existing.rows.length) {
                            const game = await client.query(
                                `SELECT * FROM games WHERE id = $1`,
                                [existing.rows[0].game_id]
                            );
                            const round = await client.query(
                                `SELECT server_seed FROM provably_fair_rounds WHERE game_id = $1`,
                                [existing.rows[0].game_id]
                            );
                            return {
                                duplicate: true,
                                game: game.rows[0],
                                serverSeed: round.rows.length ? round.rows[0].server_seed : null,
                            };
                        }

                        /*
                         * 1. The wager must be funded by exactly one
                         *    completed Pi payment. Lock it so it can
                         *    never fund two bets (no double-spend).
                         */
                        const payRes = await client.query(
                            `SELECT id, amount, status, used_by_game_id
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
                        if (payment.used_by_game_id) {
                            throw codedError("PAYMENT_ALREADY_USED", "This Pi payment already funded a bet.");
                        }
                        if (Math.abs(Number(payment.amount) - amount) > 1e-9) {
                            throw codedError("PAYMENT_AMOUNT_MISMATCH", "Bet amount must equal the Pi payment amount.");
                        }

                        /*
                         * 2. The provably-fair round must have been
                         *    committed BEFORE this bet, and be unused.
                         */
                        const roundRes = await client.query(
                            `SELECT id, server_seed, server_seed_hash, client_seed, nonce, revealed
                             FROM provably_fair_rounds
                             WHERE id = $1 AND player_id = $2
                             FOR UPDATE`,
                            [roundId, playerId]
                        );

                        if (!roundRes.rows.length) {
                            throw codedError("ROUND_NOT_FOUND", "No such provably-fair round for this player.");
                        }
                        const round = roundRes.rows[0];
                        if (round.revealed) {
                            throw codedError("ROUND_ALREADY_USED", "This provably-fair round was already used.");
                        }
                        if (!round.server_seed) {
                            throw codedError("ROUND_INVALID", "Round has no server seed.");
                        }

                        /*
                         * 3. Derive the outcome EXCLUSIVELY server-side.
                         *    The client-supplied multiplier/winnings are
                         *    never read. Ever.
                         */
                        const { path, position } = derivePath(
                            round.server_seed,
                            clientSeed,
                            Number(round.nonce),
                            rows
                        );
                        const multiplier = multiplierFor(position, rows, risk);
                        const payout = Number((amount * multiplier).toFixed(8));
                        const profit = Number((payout - amount).toFixed(8));
                        const pathStr = path.join("");

                        /*
                         * 4. Record the settled game, linked to the
                         *    funding Pi payment.
                         */
                        const gameRes = await client.query(
                            `INSERT INTO games (
                                player_id, status, bet_amount, payout_amount,
                                multiplier, profit, rows, risk, result_slot,
                                path, nonce, server_seed_hash, client_seed,
                                payment_id, completed_at
                             ) VALUES (
                                $1, 'completed', $2, $3, $4, $5, $6, $7, $8,
                                $9, $10, $11, $12, $13, NOW()
                             ) RETURNING *`,
                            [
                                playerId, amount, payout, multiplier, profit,
                                rows, risk, position, pathStr, round.nonce,
                                round.server_seed_hash, clientSeed, paymentId,
                            ]
                        );
                        const createdGame = gameRes.rows[0];

                        /*
                         * 5. Reveal the server seed and retire the round.
                         */
                        await client.query(
                            `UPDATE provably_fair_rounds
                             SET revealed = TRUE, revealed_at = NOW(), game_id = $1
                             WHERE id = $2`,
                            [createdGame.id, roundId]
                        );

                        /*
                         * 6. Consume the Pi payment (1:1 link).
                         */
                        await client.query(
                            `UPDATE pi_payments
                             SET used_by_game_id = $1, updated_at = NOW()
                             WHERE pi_payment_id = $2`,
                            [createdGame.id, paymentId]
                        );

                        /*
                         * 7. Credit the payout to the internal wallet.
                         *    The wager itself arrived on-chain via the Pi
                         *    payment, so only the payout moves the
                         *    internal balance.
                         */
                        await client.query(
                            `INSERT INTO wallets (player_id)
                             VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
                            [playerId]
                        );
                        const walletRes = await client.query(
                            `SELECT available_balance FROM wallets
                             WHERE player_id = $1 FOR UPDATE`,
                            [playerId]
                        );
                        const currentBalance = Number(walletRes.rows[0].available_balance);
                        const newBalance = Number((currentBalance + payout).toFixed(8));
                        await client.query(
                            `UPDATE wallets
                             SET available_balance = $1, updated_at = NOW()
                             WHERE player_id = $2`,
                            [newBalance, playerId]
                        );

                        /*
                         * 8. Ledger entries: the on-chain wager and the
                         *    internal payout credit.
                         */
                        await client.query(
                            `INSERT INTO transactions (
                                player_id, game_id, type, status, amount,
                                balance_before, balance_after,
                                idempotency_key, reference, metadata, completed_at
                             ) VALUES (
                                $1, $2, 'wager', 'completed', $3,
                                $4, $4, $5, $6, $7, NOW()
                             )`,
                            [
                                playerId, createdGame.id, amount,
                                currentBalance, idempotencyKey, paymentId,
                                { onchain: true, rows, risk },
                            ]
                        );
                        await client.query(
                            `INSERT INTO transactions (
                                player_id, game_id, type, status, amount,
                                balance_before, balance_after,
                                reference, metadata, completed_at
                             ) VALUES (
                                $1, $2, 'payout', 'completed', $3,
                                $4, $5, $6, $7, NOW()
                             )`,
                            [
                                playerId, createdGame.id, payout,
                                currentBalance, newBalance,
                                `payout:${createdGame.id}`,
                                { multiplier },
                            ]
                        );

                        /*
                         * 9. Player statistics.
                         */
                        await client.query(
                            `UPDATE players
                             SET balance = $1,
                                 total_wagered = total_wagered + $2,
                                 total_won = total_won + $3,
                                 total_games = total_games + 1,
                                 last_seen_at = NOW(),
                                 updated_at = NOW()
                             WHERE id = $4`,
                            [newBalance, amount, payout, playerId]
                        );

                        return {
                            duplicate: false,
                            game: createdGame,
                            payout,
                            newBalance,
                            serverSeed: round.server_seed,
                            path: pathStr,
                            position,
                        };
                    }
                );

            if (
                result.duplicate
            ) {
                return res.status(200).json({
                    data: {
                        game:
                            result.game,
                        serverSeed:
                            result.serverSeed,
                        duplicate:
                            true,
                    },

                    requestId:
                        requestId(req),
                });
            }

            return res.status(201).json({
                data: {
                    game: {
                        id:
                            result.game.id,

                        status:
                            result.game.status,

                        betAmount:
                            result.game.bet_amount,

                        payoutAmount:
                            result.game
                                .payout_amount,

                        multiplier:
                            result.game
                                .multiplier,

                        profit:
                            result.game.profit,

                        rows:
                            result.game.rows,

                        risk:
                            result.game.risk,

                        resultSlot:
                            result.game
                                .result_slot,

                        path:
                            result.game.path,

                        nonce:
                            result.game.nonce,

                        serverSeedHash:
                            result.game
                                .server_seed_hash,

                        clientSeed:
                            result.game
                                .client_seed,

                        serverSeed:
                            result.serverSeed,

                        createdAt:
                            result.game
                                .created_at,
                    },

                    balance:
                        result.newBalance,
                },

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /bets
 * ========================================================= */

router.get(
    "/",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
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

            const offset = Math.max(
                Number(
                    req.query.offset ||
                        0
                ),
                0
            );

            const result =
                await db.query(
                    `
                    SELECT
                        id,
                        status,
                        bet_amount,
                        payout_amount,
                        multiplier,
                        profit,
                        rows,
                        risk,
                        result_slot,
                        path,
                        nonce,
                        server_seed_hash,
                        client_seed,
                        created_at,
                        completed_at
                    FROM games
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
                    result.rows,

                pagination: {
                    limit,
                    offset,
                    returned:
                        result.rows.length,
                },

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /bets/:gameId
 * ========================================================= */

router.get(
    "/:gameId",
    requirePlayer,
    asyncRoute(
        async (req, res) => {
            const game =
                await db.one(
                    `
                    SELECT
                        g.id,
                        g.status,
                        g.bet_amount,
                        g.payout_amount,
                        g.multiplier,
                        g.profit,
                        g.rows,
                        g.risk,
                        g.result_slot,
                        g.path,
                        g.nonce,
                        g.server_seed_hash,
                        g.client_seed,
                        g.created_at,
                        g.completed_at,

                        pf.result_hash,
                        pf.revealed,
                        pf.revealed_at
                    FROM games g
                    LEFT JOIN
                        provably_fair_rounds pf
                        ON pf.game_id = g.id
                    WHERE
                        g.id = $1
                        AND g.player_id = $2
                    `,
                    [
                        req.params.gameId,
                        req.player.id,
                    ]
                );

            if (!game) {
                return errorResponse(
                    res,
                    404,
                    "BET_NOT_FOUND",
                    "Bet was not found.",
                    req
                );
            }

            return res.json({
                data: game,

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * Route error handler
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
            "[BETS ROUTE ERROR]",
            {
                requestId:
                    requestId(req),

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

        let status = 500;
        let code =
            "BET_INTERNAL_ERROR";
        let message =
            "Unable to process bet.";

        if (
            error.code ===
            "INSUFFICIENT_BALANCE"
        ) {
            status = 400;
            code =
                "INSUFFICIENT_BALANCE";
            message =
                "Insufficient wallet balance.";
        }

        if (
            error.code ===
            "WALLET_NOT_FOUND"
        ) {
            status = 404;
            code =
                "WALLET_NOT_FOUND";
            message =
                "Player wallet was not found.";
        }

        return errorResponse(
            res,
            status,
            code,
            message,
            req
        );
    }
);

module.exports = router;
