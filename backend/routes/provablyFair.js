/**
 * Plinko-on-Pi
 * backend/routes/provablyFair.js
 *
 * Honest provably-fair API.
 *
 * Scheme:
 *   1. POST /provably-fair/commit  -> server creates a round,
 *      stores the serverSeed, publishes ONLY sha256(serverSeed).
 *   2. POST /bets { roundId, clientSeed, ... } -> the outcome is
 *      derived server-side from
 *      HMAC-SHA256(serverSeed, clientSeed + "-" + nonce).
 *      The serverSeed is revealed immediately after settlement.
 *   3. Anyone can recompute the HMAC and verify the path via
 *      GET /provably-fair/:gameId or POST /provably-fair/verify.
 *
 * An unrevealed server seed is NEVER exposed.
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");

const {
    authenticate,
} = require("../middleware/auth");

const {
    createRound,
    verifyRound,
} = require("../lib/provablyFair");

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

/* =========================================================
 * POST /provably-fair/commit
 *
 * Commit phase: create a round BEFORE the bet. Only the
 * serverSeedHash is exposed; the seed stays server-side
 * until the bet settles.
 * ========================================================= */

router.post(
    "/commit",
    authenticate,
    asyncRoute(async (req, res) => {
        const playerId = req.player.id;

        const {
            serverSeed,
            serverSeedHash,
            nonce,
        } = createRound();

        const created = await db.query(
            `INSERT INTO provably_fair_rounds (
                player_id, server_seed_hash, server_seed,
                client_seed, nonce, algorithm, hmac_algorithm,
                revealed
             ) VALUES (
                $1, $2, $3, '', $4, 'sha256', 'sha256', FALSE
             ) RETURNING id, server_seed_hash, nonce, created_at`,
            [
                playerId,
                serverSeedHash,
                serverSeed,
                nonce,
            ]
        );

        const round = created.rows[0];

        return res.status(201).json({
            data: {
                roundId: round.id,
                serverSeedHash:
                    round.server_seed_hash,
                nonce: Number(round.nonce),
                createdAt: round.created_at,
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * GET /provably-fair/round/:roundId
 *
 * The player checks their own committed (not yet bet) round.
 * ========================================================= */

router.get(
    "/round/:roundId",
    authenticate,
    asyncRoute(async (req, res) => {
        const roundId = String(
            req.params.roundId || ""
        ).trim();

        const round = await db.one(
            `SELECT id, server_seed_hash, nonce,
                    revealed, revealed_at, game_id, created_at
             FROM provably_fair_rounds
             WHERE id = $1 AND player_id = $2`,
            [roundId, req.player.id]
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

        return res.json({
            data: {
                roundId: round.id,
                serverSeedHash:
                    round.server_seed_hash,
                nonce: Number(round.nonce),
                revealed: round.revealed,
                revealedAt: round.revealed_at,
                gameId: round.game_id,
                createdAt: round.created_at,
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * GET /provably-fair/:gameId
 *
 * Public verification record for a settled game.
 * The server seed is included ONLY because the round is
 * revealed at settlement time.
 * ========================================================= */

router.get(
    "/:gameId",
    asyncRoute(async (req, res) => {
        const gameId = String(
            req.params.gameId || ""
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

        const round = await db.one(
            `SELECT
                    pf.game_id,
                    pf.server_seed_hash,
                    pf.server_seed,
                    pf.client_seed,
                    pf.nonce,
                    pf.algorithm,
                    pf.hmac_algorithm,
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
                    g.payment_id,
                    g.created_at,
                    g.completed_at
             FROM provably_fair_rounds pf
             INNER JOIN games g ON g.id = pf.game_id
             WHERE pf.game_id = $1`,
            [gameId]
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

        return res.json({
            data: {
                gameId: round.game_id,
                status: round.status,
                algorithm: round.algorithm,
                hmacAlgorithm:
                    round.hmac_algorithm,
                serverSeedHash:
                    round.server_seed_hash,
                // Revealed at settlement; safe to publish.
                serverSeed: round.revealed
                    ? round.server_seed
                    : undefined,
                clientSeed: round.client_seed,
                nonce: Number(round.nonce),
                rows: round.rows,
                risk: round.risk,
                resultSlot: round.result_slot,
                path: round.path,
                multiplier: Number(
                    round.multiplier
                ),
                betAmount: Number(
                    round.bet_amount
                ),
                payoutAmount: Number(
                    round.payout_amount
                ),
                paymentId: round.payment_id,
                revealed: round.revealed,
                revealedAt: round.revealed_at,
                completedAt: round.completed_at,
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * POST /provably-fair/verify
 *
 * Recompute the commitment and the HMAC-derived path from
 * public inputs. Anyone can run this; no auth needed.
 * ========================================================= */

router.post(
    "/verify",
    asyncRoute(async (req, res) => {
        const body = req.body || {};

        const {
            serverSeed,
            serverSeedHash,
            clientSeed,
            nonce,
            rows,
            path,
        } = body;

        if (
            !serverSeed ||
            !serverSeedHash ||
            !clientSeed ||
            nonce === undefined ||
            nonce === null ||
            !rows ||
            path === undefined
        ) {
            return errorResponse(
                res,
                400,
                "INVALID_INPUT",
                "serverSeed, serverSeedHash, clientSeed, nonce, rows and path are required.",
                req
            );
        }

        const result = verifyRound({
            serverSeed: String(serverSeed),
            serverSeedHash:
                String(serverSeedHash),
            clientSeed: String(clientSeed),
            nonce: Number(nonce),
            rows: Number(rows),
            path: String(path),
        });

        return res.json({
            data: result,
            requestId: getRequestId(req),
        });
    })
);

module.exports = router;
