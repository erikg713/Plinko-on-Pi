/**
 * Plinko-on-Pi
 * backend/routes/provablyFair.js
 *
 * Provably-fair verification API.
 *
 * Routes:
 *
 *   GET /provably-fair/:gameId
 *   POST /provably-fair/verify
 *
 * Public information:
 *   - server seed hash
 *   - client seed
 *   - nonce
 *   - result hash
 *   - revealed server seed, when available
 *
 * NEVER expose an unrevealed server seed.
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

const HASH_ALGORITHM = "sha256";

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

function sha256(value) {
    return crypto
        .createHash(
            HASH_ALGORITHM
        )
        .update(
            String(value),
            "utf8"
        )
        .digest("hex");
}

function normalizeHex(value) {
    if (
        typeof value !==
        "string"
    ) {
        return null;
    }

    const normalized =
        value.trim().toLowerCase();

    if (
        !/^[a-f0-9]+$/.test(
            normalized
        )
    ) {
        return null;
    }

    return normalized;
}

/* =========================================================
 * Build the deterministic result hash
 *
 * This MUST exactly match the algorithm used by the game's
 * result-generation service.
 * ========================================================= */

function buildResultHash({
    serverSeed,
    clientSeed,
    nonce,
    path,
}) {
    return sha256(
        [
            serverSeed,
            clientSeed,
            nonce,
            path,
        ].join(":")
    );
}

/* =========================================================
 * Verify server seed commitment
 * ========================================================= */

function verifyServerSeedHash({
    serverSeed,
    serverSeedHash,
}) {
    const calculated =
        sha256(
            serverSeed
        );

    return (
        calculated.toLowerCase() ===
        String(
            serverSeedHash
        ).toLowerCase()
    );
}

/* =========================================================
 * Verify complete round
 * ========================================================= */

function verifyRound({
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    path,
    resultHash,
}) {
    const commitmentValid =
        verifyServerSeedHash({
            serverSeed,
            serverSeedHash,
        });

    if (
        !commitmentValid
    ) {
        return {
            valid: false,

            commitmentValid:
                false,

            resultHashValid:
                false,

            calculatedServerSeedHash:
                sha256(
                    serverSeed
                ),

            calculatedResultHash:
                null,
        };
    }

    const calculatedResultHash =
        buildResultHash({
            serverSeed,
            clientSeed,
            nonce,
            path,
        });

    const resultHashValid =
        calculatedResultHash ===
        String(
            resultHash
        ).toLowerCase();

    return {
        valid:
            commitmentValid &&
            resultHashValid,

        commitmentValid,

        resultHashValid,

        calculatedServerSeedHash:
            sha256(
                serverSeed
            ),

        calculatedResultHash,
    };
}

/* =========================================================
 * GET /provably-fair/:gameId
 *
 * Retrieve public verification information.
 *
 * An unrevealed server seed is NEVER returned.
 * ========================================================= */

router.get(
    "/:gameId",
    asyncRoute(
        async (req, res) => {
            const gameId =
                String(
                    req.params.gameId ||
                        ""
                ).trim();

            if (!gameId) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_GAME_ID",
                    "A game ID is required.",
                    req
                );
            }

            const round =
                await db.one(
                    `
                    SELECT
                        pf.game_id,
                        pf.server_seed_hash,
                        pf.client_seed,
                        pf.nonce,
                        pf.algorithm,
                        pf.hmac_algorithm,
                        pf.result_hash,
                        pf.revealed,
                        pf.revealed_at,

                        g.status,
                        g.rows,
                        g.risk,
                        g.result_slot,
                        g.path,
                        g.multiplier,
                        g.bet_amount,
                        g.payout_amount,
                        g.created_at,
                        g.completed_at

                    FROM provably_fair_rounds pf

                    INNER JOIN games g
                        ON g.id =
                           pf.game_id

                    WHERE
                        pf.game_id = $1
                    `,
                    [
                        gameId,
                    ]
                );

            if (!round) {
                return errorResponse(
                    res,
                    404,
                    "ROUND_NOT_FOUND",
                    "Provably-fair round was not found.",
                    req
                );
            }

            /*
             * Do not expose the server seed unless the round has
             * explicitly been revealed.
             */
            const response = {
                gameId:
                    round.game_id,

                status:
                    round.status,

                algorithm:
                    round.algorithm,

                hmacAlgorithm:
                    round.hmac_algorithm,

                serverSeedHash:
                    round.server_seed_hash,

                clientSeed:
                    round.client_seed,

                nonce:
                    Number(
                        round.nonce
                    ),

                resultHash:
                    round.result_hash,

                revealed:
                    Boolean(
                        round.revealed
                    ),

                revealedAt:
                    round.revealed_at,

                game: {
                    rows:
                        round.rows,

                    risk:
                        round.risk,

                    resultSlot:
                        round.result_slot,

                    path:
                        round.path,

                    multiplier:
                        Number(
                            round.multiplier
                        ),

                    betAmount:
                        Number(
                            round.bet_amount
                        ),

                    payoutAmount:
                        Number(
                            round.payout_amount
                        ),

                    createdAt:
                        round.created_at,

                    completedAt:
                        round.completed_at,
                },
            };

            /*
             * Only add serverSeed after reveal.
             */
            if (
                round.revealed
            ) {
                response.serverSeed =
                    round.server_seed ||
                    null;
            }

            return res.json({
                data:
                    response,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * POST /provably-fair/verify
 *
 * Client-side independent verification.
 *
 * Request:
 *
 * {
 *   "serverSeed": "...",
 *   "serverSeedHash": "...",
 *   "clientSeed": "...",
 *   "nonce": 123,
 *   "path": "LRRLLR...",
 *   "resultHash": "..."
 * }
 * ========================================================= */

router.post(
    "/verify",
    asyncRoute(
        async (req, res) => {
            const body =
                req.body || {};

            const serverSeed =
                typeof body.serverSeed ===
                    "string"
                    ? body.serverSeed.trim()
                    : "";

            const serverSeedHash =
                normalizeHex(
                    body.serverSeedHash
                );

            const clientSeed =
                typeof body.clientSeed ===
                    "string"
                    ? body.clientSeed
                    : "";

            const nonce =
                Number(
                    body.nonce
                );

            const path =
                typeof body.path ===
                    "string"
                    ? body.path
                    : "";

            const resultHash =
                normalizeHex(
                    body.resultHash
                );

            if (
                !serverSeed
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_SERVER_SEED",
                    "serverSeed is required.",
                    req
                );
            }

            if (
                !serverSeedHash
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_SERVER_SEED_HASH",
                    "A valid server seed hash is required.",
                    req
                );
            }

            if (
                !clientSeed
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_CLIENT_SEED",
                    "clientSeed is required.",
                    req
                );
            }

            if (
                !Number.isSafeInteger(
                    nonce
                ) ||
                nonce < 0
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_NONCE",
                    "Nonce must be a non-negative safe integer.",
                    req
                );
            }

            if (
                !path ||
                !/^[LR]+$/.test(
                    path
                )
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_PATH",
                    "Path must contain only L and R values.",
                    req
                );
            }

            if (
                !resultHash
            ) {
                return errorResponse(
                    res,
                    400,
                    "INVALID_RESULT_HASH",
                    "A valid result hash is required.",
                    req
                );
            }

            const verification =
                verifyRound({
                    serverSeed,
                    serverSeedHash,
                    clientSeed,
                    nonce,
                    path,
                    resultHash,
                });

            return res.json({
                data: {
                    valid:
                        verification.valid,

                    commitmentValid:
                        verification.commitmentValid,

                    resultHashValid:
                        verification.resultHashValid,

                    calculatedServerSeedHash:
                        verification.calculatedServerSeedHash,

                    calculatedResultHash:
                        verification.calculatedResultHash,

                    suppliedServerSeedHash:
                        serverSeedHash,

                    suppliedResultHash:
                        resultHash,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /provably-fair/:gameId/verify
 *
 * Server-side verification for a revealed round.
 * ========================================================= */

router.get(
    "/:gameId/verify",
    asyncRoute(
        async (req, res) => {
            const gameId =
                String(
                    req.params.gameId ||
                        ""
                ).trim();

            const round =
                await db.one(
                    `
                    SELECT
                        pf.game_id,
                        pf.server_seed,
                        pf.server_seed_hash,
                        pf.client_seed,
                        pf.nonce,
                        pf.result_hash,
                        pf.revealed,

                        g.path,
                        g.result_slot,
                        g.multiplier

                    FROM provably_fair_rounds pf

                    INNER JOIN games g
                        ON g.id =
                           pf.game_id

                    WHERE
                        pf.game_id = $1
                    `,
                    [
                        gameId,
                    ]
                );

            if (!round) {
                return errorResponse(
                    res,
                    404,
                    "ROUND_NOT_FOUND",
                    "Provably-fair round was not found.",
                    req
                );
            }

            if (
                !round.revealed
            ) {
                return res.json({
                    data: {
                        verified:
                            false,

                        revealed:
                            false,

                        reason:
                            "SERVER_SEED_NOT_REVEALED",
                    },

                    requestId:
                        getRequestId(req),
                });
            }

            if (
                !round.server_seed
            ) {
                return errorResponse(
                    res,
                    500,
                    "SERVER_SEED_MISSING",
                    "Round is marked revealed but the server seed is missing.",
                    req
                );
            }

            const verification =
                verifyRound({
                    serverSeed:
                        round.server_seed,

                    serverSeedHash:
                        round.server_seed_hash,

                    clientSeed:
                        round.client_seed,

                    nonce:
                        Number(
                            round.nonce
                        ),

                    path:
                        round.path,

                    resultHash:
                        round.result_hash,
                });

            return res.json({
                data: {
                    verified:
                        verification.valid,

                    revealed:
                        true,

                    gameId:
                        round.game_id,

                    serverSeed:
                        round.server_seed,

                    serverSeedHash:
                        round.server_seed_hash,

                    clientSeed:
                        round.client_seed,

                    nonce:
                        Number(
                            round.nonce
                        ),

                    path:
                        round.path,

                    resultSlot:
                        round.result_slot,

                    multiplier:
                        Number(
                            round.multiplier
                        ),

                    resultHash:
                        round.result_hash,

                    calculatedServerSeedHash:
                        verification.calculatedServerSeedHash,

                    calculatedResultHash:
                        verification.calculatedResultHash,
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
            "[PROVABLY FAIR ERROR]",
            {
                requestId:
                    getRequestId(req),

                message:
                    error.message,

                stack:
                    config.env.production
                        ? undefined
                        : error.stack,
            }
        );

        return errorResponse(
            res,
            500,
            "PROVABLY_FAIR_ERROR",
            "Unable to process provably-fair verification.",
            req
        );
    }
);

module.exports = router;
