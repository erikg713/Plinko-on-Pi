/**
 * Plinko-on-Pi
 * backend/routes/leaderboard.js
 *
 * Public leaderboard API.
 *
 * Routes:
 *   GET /leaderboard
 *   GET /leaderboard/top-winners
 *   GET /leaderboard/top-profit
 *   GET /leaderboard/highest-multipliers
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");
const config = require("../config");

const router = express.Router();

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

function parseLimit(value) {
    const parsed =
        Number(value || 25);

    if (
        !Number.isInteger(parsed) ||
        parsed < 1
    ) {
        return 25;
    }

    return Math.min(
        parsed,
        100
    );
}

function parseOffset(value) {
    const parsed =
        Number(value || 0);

    if (
        !Number.isInteger(parsed) ||
        parsed < 0
    ) {
        return 0;
    }

    return parsed;
}

/* =========================================================
 * GET /leaderboard
 *
 * Default leaderboard ranked by total profit.
 * ========================================================= */

router.get(
    "/",
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
                        p.id,
                        p.username,
                        p.display_name,

                        p.total_games,

                        p.total_wagered,

                        p.total_won,

                        (
                            p.total_won -
                            p.total_wagered
                        ) AS profit

                    FROM players p

                    WHERE
                        p.status = 'active'

                    AND
                        p.total_games > 0

                    ORDER BY
                        (
                            p.total_won -
                            p.total_wagered
                        ) DESC,

                        p.total_games DESC,

                        p.created_at ASC

                    LIMIT $1
                    OFFSET $2
                    `,
                    [
                        limit,
                        offset,
                    ]
                );

            const rows =
                result.rows.map(
                    (
                        player,
                        index
                    ) => ({
                        rank:
                            offset +
                            index +
                            1,

                        id:
                            player.id,

                        username:
                            player.username,

                        displayName:
                            player.display_name,

                        totalGames:
                            Number(
                                player.total_games
                            ),

                        totalWagered:
                            Number(
                                player.total_wagered
                            ),

                        totalWon:
                            Number(
                                player.total_won
                            ),

                        profit:
                            Number(
                                player.profit
                            ),
                    })
                );

            return res.json({
                data: rows,

                pagination: {
                    limit,
                    offset,
                    returned:
                        rows.length,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /leaderboard/top-winners
 *
 * Ranked by total amount won.
 * ========================================================= */

router.get(
    "/top-winners",
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
                        p.id,
                        p.username,
                        p.display_name,
                        p.total_games,
                        p.total_won,
                        p.total_wagered

                    FROM players p

                    WHERE
                        p.status = 'active'

                    AND
                        p.total_games > 0

                    ORDER BY
                        p.total_won DESC,

                        p.total_games DESC

                    LIMIT $1
                    OFFSET $2
                    `,
                    [
                        limit,
                        offset,
                    ]
                );

            const rows =
                result.rows.map(
                    (
                        player,
                        index
                    ) => ({
                        rank:
                            offset +
                            index +
                            1,

                        id:
                            player.id,

                        username:
                            player.username,

                        displayName:
                            player.display_name,

                        totalGames:
                            Number(
                                player.total_games
                            ),

                        totalWagered:
                            Number(
                                player.total_wagered
                            ),

                        totalWon:
                            Number(
                                player.total_won
                            ),
                    })
                );

            return res.json({
                data: rows,

                pagination: {
                    limit,
                    offset,
                    returned:
                        rows.length,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /leaderboard/top-profit
 *
 * Ranked by net profit.
 * ========================================================= */

router.get(
    "/top-profit",
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
                        p.id,
                        p.username,
                        p.display_name,
                        p.total_games,
                        p.total_wagered,
                        p.total_won,

                        (
                            p.total_won -
                            p.total_wagered
                        ) AS profit

                    FROM players p

                    WHERE
                        p.status = 'active'

                    AND
                        p.total_games > 0

                    ORDER BY
                        (
                            p.total_won -
                            p.total_wagered
                        ) DESC

                    LIMIT $1
                    OFFSET $2
                    `,
                    [
                        limit,
                        offset,
                    ]
                );

            const rows =
                result.rows.map(
                    (
                        player,
                        index
                    ) => ({
                        rank:
                            offset +
                            index +
                            1,

                        id:
                            player.id,

                        username:
                            player.username,

                        displayName:
                            player.display_name,

                        totalGames:
                            Number(
                                player.total_games
                            ),

                        totalWagered:
                            Number(
                                player.total_wagered
                            ),

                        totalWon:
                            Number(
                                player.total_won
                            ),

                        profit:
                            Number(
                                player.profit
                            ),
                    })
                );

            return res.json({
                data: rows,

                pagination: {
                    limit,
                    offset,
                    returned:
                        rows.length,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /leaderboard/highest-multipliers
 *
 * Biggest completed wins by multiplier.
 *
 * No wallet balances are exposed.
 * ========================================================= */

router.get(
    "/highest-multipliers",
    asyncRoute(
        async (req, res) => {
            const limit =
                parseLimit(
                    req.query.limit
                );

            const result =
                await db.query(
                    `
                    SELECT
                        g.id,
                        g.player_id,
                        p.username,
                        p.display_name,

                        g.bet_amount,
                        g.payout_amount,
                        g.multiplier,
                        g.rows,
                        g.risk,
                        g.result_slot,
                        g.created_at

                    FROM games g

                    INNER JOIN players p
                        ON p.id =
                           g.player_id

                    WHERE
                        g.status =
                            'completed'

                    AND
                        p.status =
                            'active'

                    AND
                        g.multiplier > 0

                    ORDER BY
                        g.multiplier DESC,

                        g.payout_amount DESC,

                        g.created_at ASC

                    LIMIT $1
                    `,
                    [
                        limit,
                    ]
                );

            const rows =
                result.rows.map(
                    (
                        game,
                        index
                    ) => ({
                        rank:
                            index + 1,

                        gameId:
                            game.id,

                        playerId:
                            game.player_id,

                        username:
                            game.username,

                        displayName:
                            game.display_name,

                        betAmount:
                            Number(
                                game.bet_amount
                            ),

                        payoutAmount:
                            Number(
                                game.payout_amount
                            ),

                        multiplier:
                            Number(
                                game.multiplier
                            ),

                        rows:
                            game.rows,

                        risk:
                            game.risk,

                        resultSlot:
                            game.result_slot,

                        createdAt:
                            game.created_at,
                    })
                );

            return res.json({
                data: rows,

                pagination: {
                    limit,
                    returned:
                        rows.length,
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /leaderboard/recent-winners
 *
 * Recent completed positive-profit games.
 * ========================================================= */

router.get(
    "/recent-winners",
    asyncRoute(
        async (req, res) => {
            const limit =
                parseLimit(
                    req.query.limit
                );

            const result =
                await db.query(
                    `
                    SELECT
                        g.id,
                        g.player_id,

                        p.username,
                        p.display_name,

                        g.bet_amount,
                        g.payout_amount,
                        g.multiplier,
                        g.rows,
                        g.risk,
                        g.created_at

                    FROM games g

                    INNER JOIN players p
                        ON p.id =
                           g.player_id

                    WHERE
                        g.status =
                            'completed'

                    AND
                        g.profit > 0

                    AND
                        p.status =
                            'active'

                    ORDER BY
                        g.created_at DESC

                    LIMIT $1
                    `,
                    [
                        limit,
                    ]
                );

            const rows =
                result.rows.map(
                    (game) => ({
                        gameId:
                            game.id,

                        username:
                            game.username,

                        displayName:
                            game.display_name,

                        betAmount:
                            Number(
                                game.bet_amount
                            ),

                        payoutAmount:
                            Number(
                                game.payout_amount
                            ),

                        multiplier:
                            Number(
                                game.multiplier
                            ),

                        rows:
                            game.rows,

                        risk:
                            game.risk,

                        createdAt:
                            game.created_at,
                    })
                );

            return res.json({
                data: rows,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /leaderboard/summary
 *
 * Public aggregate statistics.
 * ========================================================= */

router.get(
    "/summary",
    asyncRoute(
        async (req, res) => {
            const stats =
                await db.one(
                    `
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM players
                            WHERE status = 'active'
                        ) AS players,

                        (
                            SELECT COUNT(*)
                            FROM games
                            WHERE status = 'completed'
                        ) AS games,

                        (
                            SELECT COALESCE(
                                SUM(bet_amount),
                                0
                            )
                            FROM games
                            WHERE status = 'completed'
                        ) AS total_wagered,

                        (
                            SELECT COALESCE(
                                SUM(payout_amount),
                                0
                            )
                            FROM games
                            WHERE status = 'completed'
                        ) AS total_payouts
                    `
                );

            const totalWagered =
                Number(
                    stats.total_wagered
                );

            const totalPayouts =
                Number(
                    stats.total_payouts
                );

            return res.json({
                data: {
                    players:
                        Number(
                            stats.players
                        ),

                    games:
                        Number(
                            stats.games
                        ),

                    totalWagered,

                    totalPayouts,

                    houseProfit:
                        totalWagered -
                        totalPayouts,
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
            "[LEADERBOARD ERROR]",
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
            "LEADERBOARD_ERROR",
            "Unable to load leaderboard data.",
            req
        );
    }
);

module.exports = router;
