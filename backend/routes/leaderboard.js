/**
 * Plinko-on-Pi
 * backend/routes/leaderboard.js
 *
 * SKILL GAME leaderboards — points only.
 *
 * These boards rank SKILL (points scored, streaks, aim accuracy).
 * There is no Pi, no money, and no payout anywhere on this page.
 *
 * Routes:
 *   GET /leaderboard/top-scorers
 *   GET /leaderboard/best-streaks
 *   GET /leaderboard/sharpest-aim
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");

const router = express.Router();

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

function parseLimit(value) {
    const parsed = Number(value || 25);
    if (!Number.isInteger(parsed) || parsed < 1) return 25;
    return Math.min(parsed, 100);
}

async function board(query, limit, req, res) {
    const result = await db.query(query, [limit]);
    return res.json({
        data: result.rows,
        pagination: { limit, returned: result.rows.length },
        requestId: getRequestId(req),
    });
}

/* Most total skill points. */
router.get(
    "/top-scorers",
    asyncRoute(async (req, res) => {
        const limit = parseLimit(req.query.limit);
        return board(
            `SELECT p.username,
                    s.total_points AS points,
                    s.total_runs AS runs,
                    s.best_run_points AS best_run
             FROM skill_stats s
             JOIN players p ON p.id = s.player_id
             WHERE s.total_runs > 0
             ORDER BY s.total_points DESC
             LIMIT $1`,
            limit, req, res
        );
    })
);

/* Longest target-hit streaks. */
router.get(
    "/best-streaks",
    asyncRoute(async (req, res) => {
        const limit = parseLimit(req.query.limit);
        return board(
            `SELECT p.username,
                    s.best_streak AS streak,
                    s.target_hits AS target_hits,
                    s.total_runs AS runs
             FROM skill_stats s
             JOIN players p ON p.id = s.player_id
             WHERE s.total_runs > 0
             ORDER BY s.best_streak DESC, s.target_hits DESC
             LIMIT $1`,
            limit, req, res
        );
    })
);

/* Best average aim accuracy (min 10 runs to qualify). */
router.get(
    "/sharpest-aim",
    asyncRoute(async (req, res) => {
        const limit = parseLimit(req.query.limit);
        return board(
            `SELECT p.username,
                    ROUND((s.aim_total / NULLIF(s.total_runs, 0))::numeric, 3) AS accuracy,
                    s.total_runs AS runs
             FROM skill_stats s
             JOIN players p ON p.id = s.player_id
             WHERE s.total_runs >= 10
             ORDER BY (s.aim_total / NULLIF(s.total_runs, 0)) DESC
             LIMIT $1`,
            limit, req, res
        );
    })
);

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("[LEADERBOARD ROUTE ERROR]", {
        requestId: getRequestId(req),
        message: error.message,
    });
    return errorResponse(res, 500, "LEADERBOARD_INTERNAL_ERROR", "Unable to load leaderboard.", req);
});

module.exports = router;
