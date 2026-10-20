/**
 * Plinko-on-Pi
 * backend/routes/users.js
 *
 * SKILL GAME — public player profiles (skill stats only).
 *
 * No winnings, no wager history, no profit rankings. Points are
 * scores only and are never convertible to Pi or anything of value.
 *
 * Routes:
 *   GET /users/:username
 *   GET /users/:username/runs
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("../db");

const router = express.Router();

/* =========================================================
 * Helpers
 * ========================================================= */

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

/* =========================================================
 * GET /users/:username — public skill profile
 * ========================================================= */

router.get(
    "/:username",
    asyncRoute(async (req, res) => {
        const username = String(req.params.username || "").trim();
        if (!username) {
            return errorResponse(res, 400, "INVALID_USERNAME", "Username is required.", req);
        }

        const result = await db.query(
            `SELECT p.username, p.display_name, p.created_at,
                    COALESCE(s.total_runs, 0) AS total_runs,
                    COALESCE(s.total_points, 0) AS total_points,
                    COALESCE(s.best_run_points, 0) AS best_run,
                    COALESCE(s.best_streak, 0) AS best_streak,
                    COALESCE(s.target_hits, 0) AS target_hits,
                    CASE WHEN COALESCE(s.total_runs, 0) > 0
                         THEN ROUND((s.aim_total / s.total_runs)::numeric, 3)
                         ELSE 0 END AS aim_accuracy
             FROM players p
             LEFT JOIN skill_stats s ON s.player_id = p.id
             WHERE p.username = $1 AND p.status = 'active'`,
            [username]
        );

        if (!result.rows.length) {
            return errorResponse(res, 404, "USER_NOT_FOUND", "No such player.", req);
        }

        const row = result.rows[0];
        return res.json({
            data: {
                username: row.username,
                displayName: row.display_name,
                memberSince: row.created_at,
                skill: {
                    totalRuns: Number(row.total_runs),
                    totalPoints: Number(row.total_points),
                    bestRun: Number(row.best_run),
                    bestStreak: Number(row.best_streak),
                    targetHits: Number(row.target_hits),
                    aimAccuracy: Number(row.aim_accuracy),
                },
            },
            requestId: getRequestId(req),
        });
    })
);

/* =========================================================
 * GET /users/:username/runs — recent public runs
 * ========================================================= */

router.get(
    "/:username/runs",
    asyncRoute(async (req, res) => {
        const username = String(req.params.username || "").trim();
        const limit = parseLimit(req.query.limit);

        const result = await db.query(
            `SELECT r.result_bin, r.target_bin, r.points, r.hit_target,
                    r.rows, r.spread, r.submitted_at
             FROM skill_runs r
             JOIN players p ON p.id = r.player_id
             WHERE p.username = $1
               AND p.status = 'active'
               AND r.status = 'scored'
             ORDER BY r.submitted_at DESC
             LIMIT $1`,
            [username, limit]
        );

        return res.json({
            data: result.rows.map((r) => ({
                bin: r.result_bin,
                targetBin: r.target_bin,
                points: r.points,
                hitTarget: r.hit_target,
                rows: r.rows,
                spread: r.spread,
                submittedAt: r.submitted_at,
            })),
            pagination: { limit, returned: result.rows.length },
            requestId: getRequestId(req),
        });
    })
);

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("[USERS ROUTE ERROR]", {
        requestId: getRequestId(req),
        message: error.message,
    });
    return errorResponse(res, 500, "USERS_INTERNAL_ERROR", "Unable to load player.", req);
});

module.exports = router;
