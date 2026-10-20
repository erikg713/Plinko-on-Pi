/**
 * Plinko-on-Pi
 * backend/routes/runs.js
 *
 * SKILL GAME — no wagering, no payouts, no Pi staked on chance.
 *
 * A "run" is one aimed Plinko drop:
 *   1. POST /runs/start { dropX, rows, spread }
 *      - consumes 1 drop from the player's inventory (free drops
 *        regenerate over time; extra drops come from fixed-price
 *        store purchases — never from winning)
 *      - the server assigns a random target bin for this run
 *      - returns { runId, targetBin, sweepMs }
 *   2. The player aims (drop position) and times the release in
 *      the client. The ball path is produced by the client's own
 *      physics simulation — the server never decides the outcome.
 *   3. POST /runs/submit { runId, path, bin, releaseMs }
 *      - the server verifies the submission is self-consistent
 *        (path length, bin matches the path, drop matches the
 *        registered run, run is fresh, rate limits hold)
 *      - scores the run in POINTS ONLY and updates streaks
 *
 * Scoring (points, never Pi):
 *   base        = bin point value (edge bins pay more points)
 *   targetBonus = +50% of base when the ball lands in the target bin
 *   streakBonus = +5% of base per consecutive target hit (cap +50%)
 *   aimBonus    = up to +25% of base for release timing accuracy
 *
 * Anti-cheat notes (documented honestly):
 *   - bin is recomputed server-side from the submitted path, so a
 *     claimed bin must match the claimed path
 *   - runs expire after 5 minutes and can be submitted only once
 *   - hourly run cap + statistical anomaly flagging for admins
 *   - there is no money on the line, so fabrication only affects
 *     leaderboard bragging rights
 *
 * Routes:
 *   POST /runs/start
 *   POST /runs/submit
 *   GET  /runs
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const config = require("../config");
const db = require("../db");

const router = express.Router();

const {
    authenticate: requirePlayer,
} = require("../middleware/auth");

/* =========================================================
 * Bin point tables.
 *
 * MUST match the CURVES in
 * frontend/src/components/PlinkoBoard.jsx. Points are the
 * curve multiplier x 10, rounded. These are score points —
 * they are never convertible to Pi or anything of value.
 * ========================================================= */

const CURVES = {
    low: [1.5, 1.25, 1.1, 1.0, 0.8, 1.0, 1.1, 1.25, 1.5],
    medium: [3.0, 1.8, 1.3, 0.9, 0.5, 0.9, 1.3, 1.8, 3.0],
    high: [10.0, 3.0, 1.5, 0.5, 0.2, 0.5, 1.5, 3.0, 10.0],
};

function binPoints(rows, spread, bin) {
    const curve = CURVES[spread] || CURVES.low;
    const slots = rows + 1;
    if (bin < 0 || bin >= slots) return 0;
    const idx = Math.min(
        curve.length - 1,
        Math.floor((bin / Math.max(slots - 1, 1)) * curve.length)
    );
    return Math.round((curve[idx] || 1) * 10);
}

/* =========================================================
 * Helpers
 * ========================================================= */

function requestId(req) {
    return req.requestId || crypto.randomUUID();
}

function errorResponse(res, status, code, message, req) {
    return res.status(status).json({
        error: { code, message, requestId: requestId(req) },
    });
}

function codedError(code, message, status) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = status || 400;
    return error;
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

const ALLOWED_SPREADS = new Set(["low", "medium", "high"]);

function isValidPath(path, rows) {
    return (
        typeof path === "string" &&
        path.length === rows &&
        /^[LR]+$/.test(path)
    );
}

/** Final bin index = number of right moves. Verifiable server-side. */
function binFromPath(path) {
    let k = 0;
    for (const ch of path) {
        if (ch === "R") k += 1;
    }
    return k;
}

/* =========================================================
 * Drop inventory (free regen + purchased drops)
 * ========================================================= */

async function getInventory(client, playerId) {
    const res = await client.query(
        `INSERT INTO drop_inventory (player_id)
         VALUES ($1)
         ON CONFLICT (player_id) DO NOTHING
         RETURNING *`,
        [playerId]
    );
    let inv = res.rows[0];
    if (!inv) {
        const cur = await client.query(
            `SELECT * FROM drop_inventory WHERE player_id = $1 FOR UPDATE`,
            [playerId]
        );
        inv = cur.rows[0];
    }

    // Apply time-based regen of free drops.
    const cap = config.skill.freeDropsCap;
    const regenMs = config.skill.freeDropRegenMinutes * 60 * 1000;
    const now = Date.now();
    const nextRegen = new Date(inv.next_regen_at).getTime();
    let freeDrops = Number(inv.free_drops);

    if (freeDrops < cap && now >= nextRegen) {
        const ticks = Math.floor((now - nextRegen) / regenMs) + 1;
        freeDrops = Math.min(cap, freeDrops + ticks);
        const newNext = new Date(nextRegen + ticks * regenMs);
        await client.query(
            `UPDATE drop_inventory
             SET free_drops = $1, next_regen_at = $2, updated_at = NOW()
             WHERE player_id = $3`,
            [freeDrops, newNext.toISOString(), playerId]
        );
        inv.free_drops = freeDrops;
        inv.next_regen_at = newNext.toISOString();
    }

    return inv;
}

/** Consumes one drop; throws NO_DROPS when the player is out. */
async function consumeDrop(client, playerId) {
    const inv = await getInventory(client, playerId);
    let freeDrops = Number(inv.free_drops);
    let purchasedDrops = Number(inv.purchased_drops);

    if (freeDrops > 0) {
        freeDrops -= 1;
    } else if (purchasedDrops > 0) {
        purchasedDrops -= 1;
    } else {
        throw codedError(
            "NO_DROPS",
            "You're out of drops. Wait for free drops to regenerate or pick up a drop pack in the store.",
            409
        );
    }

    await client.query(
        `UPDATE drop_inventory
         SET free_drops = $1, purchased_drops = $2, updated_at = NOW()
         WHERE player_id = $3`,
        [freeDrops, purchasedDrops, playerId]
    );

    return {
        freeDrops,
        purchasedDrops,
        dropsCap: config.skill.freeDropsCap,
        nextRegenAt: inv.next_regen_at,
    };
}

/* =========================================================
 * POST /runs/start
 * ========================================================= */

router.post(
    "/start",
    requirePlayer,
    asyncRoute(async (req, res) => {
        const playerId = req.player.id;
        const body = req.body || {};

        const dropX = Number(body.dropX);
        const rows = Number(body.rows);
        const spread = String(body.spread || config.skill.defaultSpread).toLowerCase();

        if (!Number.isFinite(dropX) || dropX < 0 || dropX > 1) {
            return errorResponse(res, 400, "INVALID_DROP_X", "dropX must be between 0 and 1.", req);
        }
        if (!Number.isInteger(rows) || rows < config.skill.minRows || rows > config.skill.maxRows) {
            return errorResponse(
                res, 400, "INVALID_ROWS",
                `Rows must be between ${config.skill.minRows} and ${config.skill.maxRows}.`, req
            );
        }
        if (!ALLOWED_SPREADS.has(spread)) {
            return errorResponse(res, 400, "INVALID_SPREAD", "Spread must be low, medium, or high.", req);
        }

        const result = await db.transaction(async (client) => {
            // Hourly run cap (spam / fabrication throttle).
            const recent = await client.query(
                `SELECT COUNT(*)::int AS n FROM skill_runs
                 WHERE player_id = $1 AND started_at > NOW() - INTERVAL '1 hour'`,
                [playerId]
            );
            if (recent.rows[0].n >= config.skill.maxRunsPerHour) {
                throw codedError("RATE_LIMITED", "Too many runs this hour. Take a breather.", 429);
            }

            const drops = await consumeDrop(client, playerId);

            const runId = crypto.randomUUID();
            const targetBin = crypto.randomInt(0, rows + 1);
            const sweepMs = config.skill.sweepMs;

            await client.query(
                `INSERT INTO skill_runs (
                    id, player_id, status, drop_x, rows, spread,
                    target_bin, sweep_ms
                 ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)`,
                [runId, playerId, dropX, rows, spread, targetBin, sweepMs]
            );

            return { runId, targetBin, sweepMs, drops };
        });

        return res.status(201).json({
            data: {
                runId: result.runId,
                targetBin: result.targetBin,
                sweepMs: result.sweepMs,
                rows,
                spread,
                drops: result.drops,
            },
            requestId: requestId(req),
        });
    })
);

/* =========================================================
 * POST /runs/submit
 * ========================================================= */

router.post(
    "/submit",
    requirePlayer,
    asyncRoute(async (req, res) => {
        const playerId = req.player.id;
        const body = req.body || {};

        const runId = String(body.runId || "").trim();
        const path = String(body.path || "");
        const claimedBin = Number(body.bin);
        const releaseMs = Number(body.releaseMs);

        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
            return errorResponse(res, 400, "INVALID_RUN", "A valid runId from /runs/start is required.", req);
        }
        if (!Number.isFinite(releaseMs) || releaseMs < 0 || releaseMs > 60000) {
            return errorResponse(res, 400, "INVALID_TIMING", "releaseMs is out of range.", req);
        }

        const result = await db.transaction(async (client) => {
            const runRes = await client.query(
                `SELECT * FROM skill_runs
                 WHERE id = $1 AND player_id = $2 FOR UPDATE`,
                [runId, playerId]
            );
            if (!runRes.rows.length) {
                throw codedError("RUN_NOT_FOUND", "No such run for this player.", 404);
            }
            const run = runRes.rows[0];

            if (run.status !== "pending") {
                throw codedError("RUN_ALREADY_SUBMITTED", "This run was already submitted.", 409);
            }

            const ageMs = Date.now() - new Date(run.started_at).getTime();
            if (ageMs > config.skill.runExpirySeconds * 1000) {
                await client.query(
                    `UPDATE skill_runs SET status = 'expired' WHERE id = $1`,
                    [runId]
                );
                throw codedError("RUN_EXPIRED", "This run expired. Start a fresh one.", 410);
            }

            // The submission must be self-consistent. The server
            // recomputes the bin from the path — a claimed bin that
            // doesn't match the path is rejected.
            if (!isValidPath(path, run.rows)) {
                throw codedError("INVALID_PATH", "Path must be L/R characters matching the row count.", 400);
            }
            const actualBin = binFromPath(path);
            if (actualBin !== claimedBin) {
                throw codedError("BIN_MISMATCH", "Claimed bin does not match the submitted path.", 400);
            }

            /* ---- scoring (points only — never Pi, never value) ---- */
            const base = binPoints(run.rows, run.spread, actualBin);
            const hitTarget = actualBin === run.target_bin;
            const targetBonus = hitTarget ? Math.round(base * (config.skill.targetBonusPct / 100)) : 0;

            const statsRes = await client.query(
                `INSERT INTO skill_stats (player_id)
                 VALUES ($1)
                 ON CONFLICT (player_id) DO NOTHING
                 RETURNING *`,
                [playerId]
            );
            let stats = statsRes.rows[0];
            if (!stats) {
                const cur = await client.query(
                    `SELECT * FROM skill_stats WHERE player_id = $1 FOR UPDATE`,
                    [playerId]
                );
                stats = cur.rows[0];
            }

            const prevStreak = Number(stats.current_streak);
            const newStreak = hitTarget ? prevStreak + 1 : 0;
            const streakBonus = hitTarget
                ? Math.round(base * Math.min(newStreak, 10) * (config.skill.streakBonusPctPerLevel / 100))
                : 0;

            const sweepMs = Number(run.sweep_ms);
            const aimError = Math.min(1, Math.abs(releaseMs - sweepMs / 2) / (sweepMs / 2));
            const aimBonus = Math.round(base * (config.skill.aimBonusMaxPct / 100) * (1 - aimError));

            const points = base + targetBonus + streakBonus + aimBonus;

            const aimAccuracy = 1 - Math.abs(actualBin - run.target_bin) / run.rows;

            await client.query(
                `UPDATE skill_runs
                 SET status = 'scored', path = $1, result_bin = $2,
                     release_ms = $3, base_points = $4, target_bonus = $5,
                     streak_bonus = $6, aim_bonus = $7, points = $8,
                     hit_target = $9, submitted_at = NOW()
                 WHERE id = $10`,
                [path, actualBin, releaseMs, base, targetBonus, streakBonus, aimBonus, points, hitTarget, runId]
            );

            await client.query(
                `UPDATE skill_stats
                 SET total_runs = total_runs + 1,
                     total_points = total_points + $1,
                     best_run_points = GREATEST(best_run_points, $1),
                     current_streak = $2,
                     best_streak = GREATEST(best_streak, $2),
                     aim_total = aim_total + $3,
                     target_hits = target_hits + $4,
                     last_run_at = NOW(),
                     updated_at = NOW()
                 WHERE player_id = $5`,
                [points, newStreak, aimAccuracy, hitTarget ? 1 : 0, playerId]
            );

            // Statistical anomaly flag for admin review (no money at
            // stake, but keeps the leaderboard honest).
            if (newStreak >= 8) {
                await client.query(
                    `INSERT INTO audit_logs (player_uid, event_type, severity, event_data)
                     VALUES ($1, 'skill.streak_flag', 'WARNING', $2)`,
                    [playerId, JSON.stringify({ runId, streak: newStreak })]
                );
            }

            return {
                points, base, targetBonus, streakBonus, aimBonus,
                bin: actualBin, targetBin: run.target_bin, hitTarget,
                streak: newStreak, aimAccuracy: Number(aimAccuracy.toFixed(3)),
            };
        });

        return res.status(200).json({ data: result, requestId: requestId(req) });
    })
);

/* =========================================================
 * GET /runs — recent run history
 * ========================================================= */

router.get(
    "/",
    requirePlayer,
    asyncRoute(async (req, res) => {
        const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
        const offset = Math.max(Number(req.query.offset || 0), 0);

        const result = await db.query(
            `SELECT id, status, drop_x, rows, spread, target_bin,
                    result_bin, base_points, target_bonus, streak_bonus,
                    aim_bonus, points, hit_target, started_at, submitted_at
             FROM skill_runs
             WHERE player_id = $1
             ORDER BY started_at DESC
             LIMIT $2 OFFSET $3`,
            [req.player.id, limit, offset]
        );

        return res.json({
            data: result.rows,
            pagination: { limit, offset, returned: result.rows.length },
            requestId: requestId(req),
        });
    })
);

/* =========================================================
 * Route error handler
 * ========================================================= */

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("[RUNS ROUTE ERROR]", {
        requestId: requestId(req),
        code: error.code,
        message: error.message,
    });
    const status = error.statusCode || 500;
    const code = error.code || "RUN_INTERNAL_ERROR";
    const message = status < 500 ? error.message : "Unable to record run.";
    return errorResponse(res, status, code, message, req);
});

module.exports = router;
