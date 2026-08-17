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

const router = express.Router();

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

/* =========================================================
 * Bet validation
 * ========================================================= */

function validateBet(body) {
    const amount =
        normalizeAmount(
            body.amount
        );

    const rows =
        Number(body.rows);

    const risk =
        String(
            body.risk ||
                config.game.defaultRisk
        ).toLowerCase();

    if (
        amount === null ||
        !isPositiveNumber(
            amount
        )
    ) {
        return {
            valid: false,
            code: "INVALID_AMOUNT",
            message:
                "Bet amount must be a positive number.",
        };
    }

    if (
        amount <
        Number(
            config.game.minWager
        )
    ) {
        return {
            valid: false,
            code: "BET_TOO_SMALL",
            message:
                `Minimum wager is ${config.game.minWager}.`,
        };
    }

    if (
        amount >
        Number(
            config.game.maxWager
        )
    ) {
        return {
            valid: false,
            code: "BET_TOO_LARGE",
            message:
                `Maximum wager is ${config.game.maxWager}.`,
        };
    }

    if (
        !Number.isInteger(
            rows
        )
    ) {
        return {
            valid: false,
            code: "INVALID_ROWS",
            message:
                "Rows must be an integer.",
        };
    }

    if (
        rows <
        config.game.minRows ||
        rows >
        config.game.maxRows
    ) {
        return {
            valid: false,
            code: "INVALID_ROWS",
            message:
                `Rows must be between ${config.game.minRows} and ${config.game.maxRows}.`,
        };
    }

    if (
        !ALLOWED_RISKS.has(
            risk
        )
    ) {
        return {
            valid: false,
            code: "INVALID_RISK",
            message:
                "Risk must be low, medium, or high.",
        };
    }

    return {
        valid: true,

        value: {
            amount,
            rows,
            risk,
        },
    };
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

function generateResult(
    rows,
    risk
) {
    const slots =
        rows + 1;

    let position = 0;

    const path = [];

    for (
        let i = 0;
        i < rows;
        i += 1
    ) {
        const direction =
            randomInt(2) === 0
                ? "L"
                : "R";

        path.push(
            direction
        );

        if (
            direction === "R"
        ) {
            position += 1;
        }
    }

    /*
     * Basic multiplier curves.
     *
     * These should eventually come from a database/config
     * controlled payout table rather than being embedded here.
     */

    const curves = {
        low: [
            1.5,
            1.25,
            1.1,
            1.0,
            0.8,
            1.0,
            1.1,
            1.25,
            1.5,
        ],

        medium: [
            3.0,
            1.8,
            1.3,
            0.9,
            0.5,
            0.9,
            1.3,
            1.8,
            3.0,
        ],

        high: [
            10.0,
            3.0,
            1.5,
            0.5,
            0.2,
            0.5,
            1.5,
            3.0,
            10.0,
        ],
    };

    const curve =
        curves[risk];

    /*
     * Scale the predefined curve to the requested row count.
     */
    const multiplierIndex =
        Math.min(
            curve.length - 1,
            Math.floor(
                (position /
                    Math.max(
                        slots - 1,
                        1
                    )) *
                    curve.length
            )
        );

    const multiplier =
        curve[
            multiplierIndex
        ] || 1;

    return {
        position,
        path,
        multiplier,
    };
}

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
                        /*
                         * Check for an existing request first.
                         */
                        const existing =
                            await client.query(
                                `
                                SELECT
                                    t.game_id
                                FROM transactions t
                                WHERE
                                    t.idempotency_key = $1
                                LIMIT 1
                                `,
                                [
                                    idempotencyKey,
                                ]
                            );

                        if (
                            existing
                                .rows
                                .length
                        ) {
                            const game =
                                await client.query(
                                    `
                                    SELECT
                                        *
                                    FROM games
                                    WHERE id = $1
                                    `,
                                    [
                                        existing
                                            .rows[0]
                                            .game_id,
                                    ]
                                );

                            return {
                                duplicate:
                                    true,

                                game:
                                    game.rows[0],
                            };
                        }

                        /*
                         * Lock the wallet so two simultaneous bets
                         * cannot spend the same balance.
                         */
                        const wallet =
                            await client.query(
                                `
                                SELECT
                                    id,
                                    available_balance,
                                    locked_balance
                                FROM wallets
                                WHERE player_id = $1
                                FOR UPDATE
                                `,
                                [
                                    playerId,
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

                        const currentBalance =
                            Number(
                                wallet
                                    .rows[0]
                                    .available_balance
                            );

                        if (
                            currentBalance <
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
                         * Generate the round before committing the
                         * financial transaction.
                         */
                        const gameResult =
                            generateResult(
                                rows,
                                risk
                            );

                        const payout =
                            Number(
                                (
                                    amount *
                                    gameResult.multiplier
                                ).toFixed(8)
                            );

                        const profit =
                            Number(
                                (
                                    payout -
                                    amount
                                ).toFixed(8)
                            );

                        const nonce =
                            Date.now();

                        const clientSeed =
                            crypto.randomBytes(
                                16
                            ).toString(
                                "hex"
                            );

                        /*
                         * Commitment hash.
                         *
                         * The actual unrevealed server seed should
                         * be generated and stored by the dedicated
                         * provably-fair service.
                         */
                        const serverSeed =
                            crypto.randomBytes(
                                32
                            ).toString(
                                "hex"
                            );

                        const serverSeedHash =
                            crypto
                                .createHash(
                                    "sha256"
                                )
                                .update(
                                    serverSeed
                                )
                                .digest(
                                    "hex"
                                );

                        const resultHash =
                            crypto
                                .createHash(
                                    "sha256"
                                )
                                .update(
                                    [
                                        serverSeed,
                                        clientSeed,
                                        nonce,
                                        gameResult.path.join(
                                            ""
                                        ),
                                    ].join(
                                        ":"
                                    )
                                )
                                .digest(
                                    "hex"
                                );

                        /*
                         * Create game.
                         */
                        const game =
                            await client.query(
                                `
                                INSERT INTO games (
                                    player_id,
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
                                    completed_at
                                )
                                VALUES (
                                    $1,
                                    'completed',
                                    $2,
                                    $3,
                                    $4,
                                    $5,
                                    $6,
                                    $7,
                                    $8,
                                    $9,
                                    $10,
                                    $11,
                                    $12,
                                    NOW()
                                )
                                RETURNING *
                                `,
                                [
                                    playerId,
                                    amount,
                                    payout,
                                    gameResult.multiplier,
                                    profit,
                                    rows,
                                    risk,
                                    gameResult.position,
                                    gameResult.path.join(
                                        ""
                                    ),
                                    nonce,
                                    serverSeedHash,
                                    clientSeed,
                                ]
                            );

                        const createdGame =
                            game.rows[0];

                        /*
                         * Debit wager and credit payout in one
                         * wallet update.
                         *
                         * Net balance change:
                         *
                         * payout - wager
                         */
                        const newBalance =
                            Number(
                                (
                                    currentBalance -
                                    amount +
                                    payout
                                ).toFixed(8)
                            );

                        await client.query(
                            `
                            UPDATE wallets
                            SET
                                available_balance = $1,
                                updated_at = NOW()
                            WHERE player_id = $2
                            `,
                            [
                                newBalance,
                                playerId,
                            ]
                        );

                        /*
                         * Wager transaction.
                         */
                        await client.query(
                            `
                            INSERT INTO transactions (
                                player_id,
                                game_id,
                                type,
                                status,
                                amount,
                                balance_before,
                                balance_after,
                                idempotency_key,
                                metadata,
                                completed_at
                            )
                            VALUES (
                                $1,
                                $2,
                                'wager',
                                'completed',
                                $3,
                                $4,
                                $5,
                                $6,
                                $7,
                                NOW()
                            )
                            `,
                            [
                                playerId,
                                createdGame.id,
                                amount,
                                currentBalance,
                                Number(
                                    (
                                        currentBalance -
                                        amount
                                    ).toFixed(8)
                                ),
                                idempotencyKey,
                                {
                                    rows,
                                    risk,
                                },
                            ]
                        );

                        /*
                         * Payout transaction.
                         *
                         * The same idempotency key cannot be reused
                         * here because transactions.idempotency_key
                         * is unique.
                         */
                        await client.query(
                            `
                            INSERT INTO transactions (
                                player_id,
                                game_id,
                                type,
                                status,
                                amount,
                                balance_before,
                                balance_after,
                                reference,
                                metadata,
                                completed_at
                            )
                            VALUES (
                                $1,
                                $2,
                                'payout',
                                'completed',
                                $3,
                                $4,
                                $5,
                                $6,
                                $7,
                                NOW()
                            )
                            `,
                            [
                                playerId,
                                createdGame.id,
                                payout,
                                Number(
                                    (
                                        currentBalance -
                                        amount
                                    ).toFixed(8)
                                ),
                                newBalance,
                                `payout:${createdGame.id}`,
                                {
                                    multiplier:
                                        gameResult.multiplier,
                                },
                            ]
                        );

                        /*
                         * Update player statistics.
                         */
                        await client.query(
                            `
                            UPDATE players
                            SET
                                balance = $1,
                                total_wagered =
                                    total_wagered + $2,
                                total_won =
                                    total_won + $3,
                                total_games =
                                    total_games + 1,
                                last_seen_at = NOW(),
                                updated_at = NOW()
                            WHERE id = $4
                            `,
                            [
                                newBalance,
                                amount,
                                payout,
                                playerId,
                            ]
                        );

                        /*
                         * Store the public commitment.
                         *
                         * NOTE:
                         * serverSeed itself is deliberately NOT
                         * returned to the client at this stage.
                         */
                        await client.query(
                            `
                            INSERT INTO provably_fair_rounds (
                                game_id,
                                server_seed_hash,
                                client_seed,
                                nonce,
                                algorithm,
                                hmac_algorithm,
                                result_hash,
                                revealed
                            )
                            VALUES (
                                $1,
                                $2,
                                $3,
                                $4,
                                'sha256',
                                'sha256',
                                $5,
                                FALSE
                            )
                            `,
                            [
                                createdGame.id,
                                serverSeedHash,
                                clientSeed,
                                nonce,
                                resultHash,
                            ]
                        );

                        return {
                            duplicate:
                                false,

                            game:
                                createdGame,

                            payout,

                            newBalance,

                            resultHash,
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

                        resultHash:
                            result.resultHash,

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
