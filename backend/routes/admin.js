/**
 * Plinko-on-Pi
 * backend/routes/admin.js
 *
 * Administrative API routes.
 *
 * IMPORTANT:
 * - Admin routes must never be publicly writable.
 * - Authentication and authorization are enforced here.
 * - Database operations belong in services/controllers.
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

const config = require("../config");
const db = require("../db");

const router = express.Router();

/* =========================================================
 * Helpers
 * ========================================================= */

function asyncRoute(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            next(error);
        }
    };
}

function adminError(
    res,
    status,
    code,
    message,
    requestId
) {
    return res.status(status).json({
        error: {
            code,
            message,
            requestId,
        },
    });
}

function getRequestId(req) {
    return (
        req.requestId ||
        crypto.randomUUID()
    );
}

/* =========================================================
 * Authentication placeholder
 * =========================================================
 *
 * Replace this with the real admin authentication
 * middleware once the auth system is implemented.
 *
 * Expected middleware behavior:
 *
 * req.admin = {
 *     id: "...",
 *     role: "admin",
 *     permissions: [...]
 * };
 */

function requireAdmin(req, res, next) {
    /*
     * Do NOT enable anonymous admin access.
     *
     * During development this route intentionally returns
     * 501 until proper authentication middleware is wired.
     */

    if (!req.admin) {
        return adminError(
            res,
            401,
            "ADMIN_AUTH_REQUIRED",
            "Administrator authentication is required.",
            getRequestId(req)
        );
    }

    if (
        !["admin", "super_admin"].includes(
            req.admin.role
        )
    ) {
        return adminError(
            res,
            403,
            "ADMIN_FORBIDDEN",
            "Administrator privileges are required.",
            getRequestId(req)
        );
    }

    next();
}

/* =========================================================
 * Permission middleware
 * ========================================================= */

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.admin) {
            return adminError(
                res,
                401,
                "ADMIN_AUTH_REQUIRED",
                "Administrator authentication is required.",
                getRequestId(req)
            );
        }

        /*
         * Super administrators bypass individual
         * permission checks.
         */
        if (
            req.admin.role ===
            "super_admin"
        ) {
            return next();
        }

        const permissions =
            Array.isArray(
                req.admin.permissions
            )
                ? req.admin.permissions
                : [];

        if (
            !permissions.includes(
                permission
            )
        ) {
            return adminError(
                res,
                403,
                "PERMISSION_DENIED",
                "You do not have permission to perform this action.",
                getRequestId(req)
            );
        }

        next();
    };
}

/* =========================================================
 * Audit logging
 * ========================================================= */

async function audit(
    req,
    action,
    resourceType = null,
    resourceId = null,
    details = {}
) {
    try {
        await db.query(
            `
            INSERT INTO admin_audit_log (
                admin_id,
                action,
                resource_type,
                resource_id,
                request_id,
                ip_address,
                user_agent,
                details
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
            )
            `,
            [
                req.admin?.id || null,
                action,
                resourceType,
                resourceId,
                req.requestId || null,
                req.ip || null,
                req.get("user-agent") ||
                    null,
                details,
            ]
        );
    } catch (error) {
        /*
         * Audit failures should be logged but should not
         * silently corrupt the primary admin operation.
         */
        console.error(
            "[ADMIN AUDIT] Failed:",
            error.message
        );
    }
}

/* =========================================================
 * Router status
 * ========================================================= */

router.get(
    "/",
    requireAdmin,
    (req, res) => {
        res.json({
            status: "online",

            service:
                "plinko-on-pi-admin-api",

            version:
                config.app.version,

            requestId:
                getRequestId(req),
        });
    }
);

/* =========================================================
 * Dashboard overview
 * ========================================================= */

router.get(
    "/dashboard",
    requireAdmin,
    requirePermission(
        "dashboard:read"
    ),
    asyncRoute(
        async (req, res) => {
            const [
                players,
                games,
                wagers,
                payouts,
            ] = await Promise.all([
                db.scalar(
                    `
                    SELECT COUNT(*)
                    FROM players
                    `
                ),

                db.scalar(
                    `
                    SELECT COUNT(*)
                    FROM games
                    `
                ),

                db.scalar(
                    `
                    SELECT COALESCE(
                        SUM(bet_amount),
                        0
                    )
                    FROM games
                    WHERE status = 'completed'
                    `
                ),

                db.scalar(
                    `
                    SELECT COALESCE(
                        SUM(payout_amount),
                        0
                    )
                    FROM games
                    WHERE status = 'completed'
                    `
                ),
            ]);

            const totalWagered =
                Number(
                    wagers || 0
                );

            const totalPayouts =
                Number(
                    payouts || 0
                );

            res.json({
                data: {
                    players:
                        Number(
                            players || 0
                        ),

                    games:
                        Number(
                            games || 0
                        ),

                    totalWagered,

                    totalPayouts,

                    grossGamingRevenue:
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
 * Player statistics
 * ========================================================= */

router.get(
    "/players/stats",
    requireAdmin,
    requirePermission(
        "players:read"
    ),
    asyncRoute(
        async (req, res) => {
            const stats =
                await db.one(
                    `
                    SELECT
                        COUNT(*)::BIGINT
                            AS total,

                        COUNT(*) FILTER (
                            WHERE status = 'active'
                        )::BIGINT
                            AS active,

                        COUNT(*) FILTER (
                            WHERE status = 'suspended'
                        )::BIGINT
                            AS suspended,

                        COUNT(*) FILTER (
                            WHERE status = 'banned'
                        )::BIGINT
                            AS banned
                    FROM players
                    `
                );

            res.json({
                data: {
                    total:
                        Number(
                            stats.total
                        ),

                    active:
                        Number(
                            stats.active
                        ),

                    suspended:
                        Number(
                            stats.suspended
                        ),

                    banned:
                        Number(
                            stats.banned
                        ),
                },

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * Players
 * ========================================================= */

router.get(
    "/players",
    requireAdmin,
    requirePermission(
        "players:read"
    ),
    asyncRoute(
        async (req, res) => {
            const limit = Math.min(
                Math.max(
                    Number(
                        req.query.limit ||
                            50
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

            const status =
                typeof req.query.status ===
                "string"
                    ? req.query.status
                    : null;

            const search =
                typeof req.query.search ===
                "string"
                    ? req.query.search.trim()
                    : null;

            const result =
                await db.query(
                    `
                    SELECT
                        id,
                        external_id,
                        username,
                        display_name,
                        status,
                        balance,
                        total_wagered,
                        total_won,
                        total_games,
                        created_at,
                        last_seen_at
                    FROM players
                    WHERE
                        (
                            $1::TEXT IS NULL
                            OR status = $1
                        )
                    AND (
                            $2::TEXT IS NULL
                            OR username ILIKE
                                '%' || $2 || '%'
                            OR display_name ILIKE
                                '%' || $2 || '%'
                        )
                    ORDER BY created_at DESC
                    LIMIT $3
                    OFFSET $4
                    `,
                    [
                        status,
                        search,
                        limit,
                        offset,
                    ]
                );

            res.json({
                data:
                    result.rows,

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
 * Single player
 * ========================================================= */

router.get(
    "/players/:playerId",
    requireAdmin,
    requirePermission(
        "players:read"
    ),
    asyncRoute(
        async (req, res) => {
            const player =
                await db.one(
                    `
                    SELECT
                        id,
                        external_id,
                        username,
                        display_name,
                        status,
                        balance,
                        total_wagered,
                        total_won,
                        total_games,
                        created_at,
                        updated_at,
                        last_seen_at
                    FROM players
                    WHERE id = $1
                    `,
                    [
                        req.params.playerId,
                    ]
                );

            if (!player) {
                return adminError(
                    res,
                    404,
                    "PLAYER_NOT_FOUND",
                    "Player was not found.",
                    getRequestId(req)
                );
            }

            res.json({
                data: player,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * Suspend player
 * ========================================================= */

router.post(
    "/players/:playerId/suspend",
    requireAdmin,
    requirePermission(
        "players:manage"
    ),
    asyncRoute(
        async (req, res) => {
            const player =
                await db.one(
                    `
                    UPDATE players
                    SET
                        status = 'suspended',
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING
                        id,
                        username,
                        status
                    `,
                    [
                        req.params.playerId,
                    ]
                );

            if (!player) {
                return adminError(
                    res,
                    404,
                    "PLAYER_NOT_FOUND",
                    "Player was not found.",
                    getRequestId(req)
                );
            }

            await audit(
                req,
                "player.suspended",
                "player",
                player.id,
                {
                    username:
                        player.username,
                }
            );

            res.json({
                data: player,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * Unsuspend player
 * ========================================================= */

router.post(
    "/players/:playerId/activate",
    requireAdmin,
    requirePermission(
        "players:manage"
    ),
    asyncRoute(
        async (req, res) => {
            const player =
                await db.one(
                    `
                    UPDATE players
                    SET
                        status = 'active',
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING
                        id,
                        username,
                        status
                    `,
                    [
                        req.params.playerId,
                    ]
                );

            if (!player) {
                return adminError(
                    res,
                    404,
                    "PLAYER_NOT_FOUND",
                    "Player was not found.",
                    getRequestId(req)
                );
            }

            await audit(
                req,
                "player.activated",
                "player",
                player.id,
                {
                    username:
                        player.username,
                }
            );

            res.json({
                data: player,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * Games
 * ========================================================= */

router.get(
    "/games",
    requireAdmin,
    requirePermission(
        "games:read"
    ),
    asyncRoute(
        async (req, res) => {
            const limit = Math.min(
                Math.max(
                    Number(
                        req.query.limit ||
                            50
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
                        g.id,
                        g.player_id,
                        p.username,
                        g.status,
                        g.bet_amount,
                        g.payout_amount,
                        g.multiplier,
                        g.profit,
                        g.rows,
                        g.risk,
                        g.result_slot,
                        g.nonce,
                        g.server_seed_hash,
                        g.created_at,
                        g.completed_at
                    FROM games g
                    INNER JOIN players p
                        ON p.id = g.player_id
                    ORDER BY
                        g.created_at DESC
                    LIMIT $1
                    OFFSET $2
                    `,
                    [
                        limit,
                        offset,
                    ]
                );

            res.json({
                data:
                    result.rows,

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
 * Transactions
 * ========================================================= */

router.get(
    "/transactions",
    requireAdmin,
    requirePermission(
        "transactions:read"
    ),
    asyncRoute(
        async (req, res) => {
            const limit = Math.min(
                Math.max(
                    Number(
                        req.query.limit ||
                            50
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
                        t.id,
                        t.player_id,
                        p.username,
                        t.game_id,
                        t.type,
                        t.status,
                        t.amount,
                        t.balance_before,
                        t.balance_after,
                        t.reference,
                        t.created_at,
                        t.completed_at
                    FROM transactions t
                    INNER JOIN players p
                        ON p.id = t.player_id
                    ORDER BY
                        t.created_at DESC
                    LIMIT $1
                    OFFSET $2
                    `,
                    [
                        limit,
                        offset,
                    ]
                );

            res.json({
                data:
                    result.rows,

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
 * Audit log
 * ========================================================= */

router.get(
    "/audit",
    requireAdmin,
    requirePermission(
        "audit:read"
    ),
    asyncRoute(
        async (req, res) => {
            const limit = Math.min(
                Math.max(
                    Number(
                        req.query.limit ||
                            100
                    ),
                    1
                ),
                200
            );

            const result =
                await db.query(
                    `
                    SELECT
                        id,
                        admin_id,
                        action,
                        resource_type,
                        resource_id,
                        request_id,
                        ip_address,
                        user_agent,
                        details,
                        created_at
                    FROM admin_audit_log
                    ORDER BY
                        created_at DESC
                    LIMIT $1
                    `,
                    [limit]
                );

            res.json({
                data:
                    result.rows,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * Database health
 * ========================================================= */

router.get(
    "/system/health",
    requireAdmin,
    requirePermission(
        "system:read"
    ),
    asyncRoute(
        async (req, res) => {
            const health =
                await db.healthCheck();

            const status =
                health.healthy
                    ? 200
                    : 503;

            res.status(status).json({
                data: health,

                requestId:
                    getRequestId(req),
            });
        }
    )
);

/* =========================================================
 * System statistics
 * ========================================================= */

router.get(
    "/system/stats",
    requireAdmin,
    requirePermission(
        "system:read"
    ),
    asyncRoute(
        async (req, res) => {
            const pool =
                db.getPoolStats();

            const memory =
                process.memoryUsage();

            res.json({
                data: {
                    uptimeSeconds:
                        Math.floor(
                            process.uptime()
                        ),

                    nodeVersion:
                        process.version,

                    platform:
                        process.platform,

                    pid:
                        process.pid,

                    memory: {
                        rss:
                            memory.rss,

                        heapTotal:
                            memory.heapTotal,

                        heapUsed:
                            memory.heapUsed,

                        external:
                            memory.external,
                    },

                    database:
                        pool,
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
            "[ADMIN ROUTE ERROR]",
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

        return adminError(
            res,
            500,
            "ADMIN_INTERNAL_ERROR",
            config.env.production
                ? "Internal admin API error."
                : error.message,
            getRequestId(req)
        );
    }
);

module.exports = router;
