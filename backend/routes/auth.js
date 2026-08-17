/**
 * Plinko-on-Pi
 * backend/routes/auth.js
 *
 * Authentication routes.
 *
 * Routes:
 *
 *   POST /auth/login
 *   POST /auth/logout
 *   GET  /auth/me
 *   POST /auth/refresh
 *
 * IMPORTANT:
 * Pi authentication/token verification must happen server-side.
 * Never trust a player ID supplied directly by the browser.
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

function requestId(req) {
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
                requestId(req),
        },
    });
}

/* =========================================================
 * Token helpers
 * =========================================================
 *
 * These functions expect your production application to have
 * a real session/JWT implementation.
 *
 * Do NOT use player IDs as authentication tokens.
 * ========================================================= */

function generateSessionToken() {
    return crypto
        .randomBytes(48)
        .toString("base64url");
}

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function getBearerToken(req) {
    const header =
        req.get("Authorization");

    if (
        !header ||
        !header.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    return header
        .slice(7)
        .trim();
}

/* =========================================================
 * Pi authentication validation
 * =========================================================
 *
 * Replace this with the real Pi Platform API verification
 * service when connecting the Pi SDK.
 *
 * The browser must provide a Pi access token, not merely a
 * player ID.
 * ========================================================= */

async function verifyPiToken(
    accessToken
) {
    if (
        !accessToken ||
        typeof accessToken !==
            "string"
    ) {
        const error =
            new Error(
                "Pi access token is required."
            );

        error.code =
            "PI_TOKEN_REQUIRED";

        throw error;
    }

    /*
     * TODO:
     *
     * Call your server-side Pi authentication service here.
     *
     * Example return shape:
     *
     * {
     *     uid: "...",
     *     username: "...",
     *     displayName: "..."
     * }
     *
     * Never decode an unverified token and treat its contents
     * as trusted.
     */

    throw Object.assign(
        new Error(
            "Pi authentication provider is not configured."
        ),
        {
            code:
                "PI_AUTH_NOT_CONFIGURED",
        }
    );
}

/* =========================================================
 * POST /auth/login
 * ========================================================= */

router.post(
    "/login",
    asyncRoute(
        async (req, res) => {
            const body =
                req.body || {};

            /*
             * Accept either:
             *
             * {
             *     accessToken: "..."
             * }
             *
             * or:
             *
             * Authorization: Bearer ...
             */

            const accessToken =
                body.accessToken ||
                getBearerToken(req);

            if (
                !accessToken
            ) {
                return errorResponse(
                    res,
                    401,
                    "PI_TOKEN_REQUIRED",
                    "A Pi access token is required.",
                    req
                );
            }

            const piUser =
                await verifyPiToken(
                    accessToken
                );

            if (
                !piUser?.uid
            ) {
                return errorResponse(
                    res,
                    401,
                    "INVALID_PI_IDENTITY",
                    "Pi identity could not be verified.",
                    req
                );
            }

            /*
             * Find or create the local player account.
             */
            const player =
                await db.transaction(
                    async (client) => {
                        const existing =
                            await client.query(
                                `
                                SELECT
                                    id,
                                    username,
                                    display_name,
                                    status,
                                    balance,
                                    total_wagered,
                                    total_won,
                                    total_games,
                                    created_at
                                FROM players
                                WHERE external_id = $1
                                LIMIT 1
                                `,
                                [
                                    piUser.uid,
                                ]
                            );

                        if (
                            existing
                                .rows
                                .length
                        ) {
                            return existing
                                .rows[0];
                        }

                        const username =
                            piUser.username ||
                            `pi_${piUser.uid.slice(
                                0,
                                12
                            )}`;

                        const created =
                            await client.query(
                                `
                                INSERT INTO players (
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
                                )
                                VALUES (
                                    $1,
                                    $2,
                                    $3,
                                    'active',
                                    0,
                                    0,
                                    0,
                                    0,
                                    NOW(),
                                    NOW(),
                                    NOW()
                                )
                                RETURNING
                                    id,
                                    username,
                                    display_name,
                                    status,
                                    balance,
                                    total_wagered,
                                    total_won,
                                    total_games,
                                    created_at
                                `,
                                [
                                    piUser.uid,
                                    username,
                                    piUser.displayName ||
                                        null,
                                ]
                            );

                        return created
                            .rows[0];
                    }
                );

            if (
                player.status !==
                "active"
            ) {
                return errorResponse(
                    res,
                    403,
                    "ACCOUNT_INACTIVE",
                    "This player account is not active.",
                    req
                );
            }

            /*
             * Create a server-side session.
             *
             * This requires an auth_sessions table.
             */
            const sessionToken =
                generateSessionToken();

            const tokenHash =
                hashToken(
                    sessionToken
                );

            const sessionHours =
                Number(
                    config.auth.sessionHours ||
                        24
                );

            await db.query(
                `
                INSERT INTO auth_sessions (
                    player_id,
                    token_hash,
                    expires_at,
                    created_at,
                    last_used_at
                )
                VALUES (
                    $1,
                    $2,
                    NOW() +
                        ($3 * INTERVAL '1 hour'),
                    NOW(),
                    NOW()
                )
                `,
                [
                    player.id,
                    tokenHash,
                    sessionHours,
                ]
            );

            await db.query(
                `
                UPDATE players
                SET
                    last_seen_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                `,
                [
                    player.id,
                ]
            );

            return res.status(200).json({
                data: {
                    token:
                        sessionToken,

                    tokenType:
                        "Bearer",

                    expiresIn:
                        sessionHours *
                        60 *
                        60,

                    player: {
                        id:
                            player.id,

                        username:
                            player.username,

                        displayName:
                            player.display_name,

                        status:
                            player.status,

                        balance:
                            Number(
                                player.balance
                            ),

                        totalWagered:
                            Number(
                                player.total_wagered
                            ),

                        totalWon:
                            Number(
                                player.total_won
                            ),

                        totalGames:
                            Number(
                                player.total_games
                            ),

                        createdAt:
                            player.created_at,
                    },
                },

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * GET /auth/me
 *
 * Authentication middleware should populate req.player.
 * ========================================================= */

router.get(
    "/me",
    asyncRoute(
        async (req, res) => {
            if (
                !req.player?.id
            ) {
                return errorResponse(
                    res,
                    401,
                    "AUTH_REQUIRED",
                    "You are not authenticated.",
                    req
                );
            }

            const player =
                await db.one(
                    `
                    SELECT
                        id,
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
                    WHERE id = $1
                    `,
                    [
                        req.player.id,
                    ]
                );

            if (!player) {
                return errorResponse(
                    res,
                    404,
                    "USER_NOT_FOUND",
                    "Player account was not found.",
                    req
                );
            }

            return res.json({
                data: {
                    id:
                        player.id,

                    username:
                        player.username,

                    displayName:
                        player.display_name,

                    status:
                        player.status,

                    balance:
                        Number(
                            player.balance
                        ),

                    totalWagered:
                        Number(
                            player.total_wagered
                        ),

                    totalWon:
                        Number(
                            player.total_won
                        ),

                    totalGames:
                        Number(
                            player.total_games
                        ),

                    createdAt:
                        player.created_at,

                    lastSeenAt:
                        player.last_seen_at,
                },

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * POST /auth/logout
 * ========================================================= */

router.post(
    "/logout",
    asyncRoute(
        async (req, res) => {
            const token =
                getBearerToken(req);

            if (!token) {
                return res.json({
                    data: {
                        loggedOut:
                            true,
                    },

                    requestId:
                        requestId(req),
                });
            }

            const tokenHash =
                hashToken(token);

            await db.query(
                `
                UPDATE auth_sessions
                SET
                    revoked_at = NOW()
                WHERE
                    token_hash = $1
                    AND revoked_at IS NULL
                `,
                [
                    tokenHash,
                ]
            );

            return res.json({
                data: {
                    loggedOut:
                        true,
                },

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * POST /auth/refresh
 *
 * Session refresh.
 * ========================================================= */

router.post(
    "/refresh",
    asyncRoute(
        async (req, res) => {
            const token =
                getBearerToken(req);

            if (!token) {
                return errorResponse(
                    res,
                    401,
                    "AUTH_REQUIRED",
                    "A session token is required.",
                    req
                );
            }

            const tokenHash =
                hashToken(token);

            const session =
                await db.one(
                    `
                    SELECT
                        s.id,
                        s.player_id,
                        p.status
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

            if (!session) {
                return errorResponse(
                    res,
                    401,
                    "INVALID_SESSION",
                    "Session is invalid or expired.",
                    req
                );
            }

            if (
                session.status !==
                "active"
            ) {
                return errorResponse(
                    res,
                    403,
                    "ACCOUNT_INACTIVE",
                    "Player account is not active.",
                    req
                );
            }

            /*
             * Rotate the token instead of indefinitely extending
             * the same credential.
             */
            const newToken =
                generateSessionToken();

            const newHash =
                hashToken(
                    newToken
                );

            const sessionHours =
                Number(
                    config.auth.sessionHours ||
                        24
                );

            await db.transaction(
                async (client) => {
                    await client.query(
                        `
                        UPDATE auth_sessions
                        SET
                            revoked_at = NOW()
                        WHERE id = $1
                        `,
                        [
                            session.id,
                        ]
                    );

                    await client.query(
                        `
                        INSERT INTO auth_sessions (
                            player_id,
                            token_hash,
                            expires_at,
                            created_at,
                            last_used_at
                        )
                        VALUES (
                            $1,
                            $2,
                            NOW() +
                                ($3 * INTERVAL '1 hour'),
                            NOW(),
                            NOW()
                        )
                        `,
                        [
                            session.player_id,
                            newHash,
                            sessionHours,
                        ]
                    );
                }
            );

            return res.json({
                data: {
                    token:
                        newToken,

                    tokenType:
                        "Bearer",

                    expiresIn:
                        sessionHours *
                        60 *
                        60,
                },

                requestId:
                    requestId(req),
            });
        }
    )
);

/* =========================================================
 * Authentication error handler
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
            "[AUTH ERROR]",
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

        if (
            error.code ===
            "PI_AUTH_NOT_CONFIGURED"
        ) {
            return errorResponse(
                res,
                503,
                error.code,
                "Pi authentication is not configured on the server.",
                req
            );
        }

        if (
            error.code ===
            "PI_TOKEN_REQUIRED"
        ) {
            return errorResponse(
                res,
                401,
                error.code,
                "A valid Pi access token is required.",
                req
            );
        }

        return errorResponse(
            res,
            500,
            "AUTH_ERROR",
            "Authentication request failed.",
            req
        );
    }
);

module.exports = router;
