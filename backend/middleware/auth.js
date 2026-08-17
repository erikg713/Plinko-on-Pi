/**
 * Plinko-on-Pi
 * backend/middleware/auth.js
 *
 * Server-side authentication middleware.
 *
 * Reads:
 *   Authorization: Bearer <session-token>
 *
 * Validates:
 *   - token format
 *   - session existence
 *   - session expiration
 *   - session revocation
 *   - player existence
 *   - player status
 *
 * Sets:
 *   req.player
 *   req.auth
 */

"use strict";

const crypto = require("crypto");

const db = require("../db");
const config = require("../config");

/* =========================================================
 * Helpers
 * ========================================================= */

function getRequestId(req) {
    return (
        req.requestId ||
        crypto.randomUUID()
    );
}

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token, "utf8")
        .digest("hex");
}

function getBearerToken(req) {
    const header =
        req.get("Authorization");

    if (
        !header ||
        typeof header !== "string"
    ) {
        return null;
    }

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    const token =
        header
            .slice(7)
            .trim();

    return token || null;
}

function unauthorized(
    res,
    code,
    message,
    req
) {
    return res.status(401).json({
        error: {
            code,
            message,
            requestId:
                getRequestId(req),
        },
    });
}

/* =========================================================
 * Main authentication middleware
 * ========================================================= */

async function authenticate(
    req,
    res,
    next
) {
    try {
        const token =
            getBearerToken(req);

        if (!token) {
            return unauthorized(
                res,
                "AUTH_REQUIRED",
                "Authentication is required.",
                req
            );
        }

        /*
         * Never store raw authentication tokens in the database.
         */
        const tokenHash =
            hashToken(token);

        const result =
            await db.query(
                `
                SELECT
                    s.id AS session_id,
                    s.player_id,
                    s.expires_at,
                    s.created_at,
                    s.last_used_at,

                    p.id,
                    p.external_id,
                    p.username,
                    p.display_name,
                    p.status,
                    p.balance,
                    p.total_wagered,
                    p.total_won,
                    p.total_games,
                    p.created_at AS player_created_at,
                    p.last_seen_at

                FROM auth_sessions s

                INNER JOIN players p
                    ON p.id =
                       s.player_id

                WHERE
                    s.token_hash = $1

                    AND s.revoked_at IS NULL

                    AND s.expires_at > NOW()

                LIMIT 1
                `,
                [
                    tokenHash,
                ]
            );

        if (
            !result.rows.length
        ) {
            return unauthorized(
                res,
                "INVALID_SESSION",
                "Session is invalid or expired.",
                req
            );
        }

        const row =
            result.rows[0];

        /*
         * Do not allow disabled/suspended/deleted accounts
         * to access authenticated endpoints.
         */
        if (
            row.status !==
            "active"
        ) {
            return res.status(403).json({
                error: {
                    code:
                        "ACCOUNT_INACTIVE",

                    message:
                        "This player account is not active.",

                    requestId:
                        getRequestId(req),
                },
            });
        }

        /*
         * Attach a normalized player object.
         *
         * Never expose the session token itself through req.player.
         */
        req.player = {
            id:
                row.player_id,

            externalId:
                row.external_id,

            username:
                row.username,

            displayName:
                row.display_name,

            status:
                row.status,

            balance:
                Number(
                    row.balance
                ),

            totalWagered:
                Number(
                    row.total_wagered
                ),

            totalWon:
                Number(
                    row.total_won
                ),

            totalGames:
                Number(
                    row.total_games
                ),

            createdAt:
                row.player_created_at,

            lastSeenAt:
                row.last_seen_at,
        };

        /*
         * Authentication metadata is kept separate.
         */
        req.auth = {
            authenticated:
                true,

            sessionId:
                row.session_id,

            playerId:
                row.player_id,

            expiresAt:
                row.expires_at,
        };

        /*
         * Update session activity.
         *
         * This is intentionally throttled so every API request
         * doesn't cause an unnecessary database write.
         */
        const lastUsed =
            row.last_used_at
                ? new Date(
                      row.last_used_at
                  ).getTime()
                : 0;

        const now =
            Date.now();

        const activityInterval =
            Number(
                config.auth
                    ?.activityUpdateSeconds ||
                    60
            ) * 1000;

        if (
            now - lastUsed >=
            activityInterval
        ) {
            /*
             * Fire-and-forget activity update.
             *
             * Failure here should NOT make an otherwise valid
             * authenticated request fail.
             */
            db.query(
                `
                UPDATE auth_sessions
                SET
                    last_used_at = NOW()
                WHERE
                    id = $1
                    AND revoked_at IS NULL
                `,
                [
                    row.session_id,
                ]
            ).catch(
                (error) => {
                    console.error(
                        "[AUTH] Failed to update session activity:",
                        error.message
                    );
                }
            );
        }

        return next();
    } catch (error) {
        console.error(
            "[AUTH] Authentication failure:",
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

        return res.status(500).json({
            error: {
                code:
                    "AUTH_SERVICE_ERROR",

                message:
                    "Authentication service unavailable.",

                requestId:
                    getRequestId(req),
            },
        });
    }
}

/* =========================================================
 * Optional authentication
 *
 * Useful for endpoints that work for both guests and
 * authenticated players.
 * ========================================================= */

async function optionalAuthenticate(
    req,
    res,
    next
) {
    const token =
        getBearerToken(req);

    if (!token) {
        req.player = null;

        req.auth = {
            authenticated:
                false,
        };

        return next();
    }

    /*
     * If a token exists, it MUST be valid.
     *
     * We don't silently downgrade an invalid token into a
     * guest request.
     */
    return authenticate(
        req,
        res,
        next
    );
}

/* =========================================================
 * Require a specific player status
 * ========================================================= */

function requireActivePlayer(
    req,
    res,
    next
) {
    if (
        !req.player?.id
    ) {
        return unauthorized(
            res,
            "AUTH_REQUIRED",
            "Authentication is required.",
            req
        );
    }

    if (
        req.player.status !==
        "active"
    ) {
        return res.status(403).json({
            error: {
                code:
                    "ACCOUNT_INACTIVE",

                message:
                    "This player account is not active.",

                requestId:
                    getRequestId(req),
            },
        });
    }

    return next();
}

/* =========================================================
 * Require admin
 *
 * This should be used in addition to authentication.
 * ========================================================= */

function requireAdmin(
    req,
    res,
    next
) {
    if (
        !req.player?.id
    ) {
        return unauthorized(
            res,
            "AUTH_REQUIRED",
            "Authentication is required.",
            req
        );
    }

    /*
     * Admin status should come from the database/session,
     * never from req.body or a client-supplied role.
     *
     * This expects req.player.role to be loaded by the query
     * when admin authorization is enabled.
     */
    if (
        req.player.role !==
        "admin"
    ) {
        return res.status(403).json({
            error: {
                code:
                    "ADMIN_REQUIRED",

                message:
                    "Administrator privileges are required.",

                requestId:
                    getRequestId(req),
            },
        });
    }

    return next();
}

/* =========================================================
 * Exports
 * ========================================================= */

module.exports = {
    authenticate,
    optionalAuthenticate,
    requireActivePlayer,
    requireAdmin,
};
