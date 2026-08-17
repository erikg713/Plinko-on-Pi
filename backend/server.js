/**
 * Plinko-on-Pi Backend
 * backend/server.js
 *
 * Main HTTP server bootstrap.
 *
 * Responsibilities:
 * - Load environment
 * - Validate configuration
 * - Initialize database
 * - Configure Express
 * - Configure security middleware
 * - Register API routes
 * - Expose health endpoints
 * - Handle errors
 * - Gracefully shut down
 */

"use strict";

require("dotenv").config();

const crypto = require("crypto");
const http = require("http");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const config = require("./config");
const db = require("./db");

/* =========================================================
 * Application state
 * ========================================================= */

let server = null;
let shuttingDown = false;

const startedAt = new Date();

/* =========================================================
 * Request ID
 * ========================================================= */

function requestIdMiddleware(
    req,
    res,
    next
) {
    const supplied =
        req.get("X-Request-ID");

    const requestId =
        supplied &&
        /^[A-Za-z0-9._:-]{1,128}$/.test(
            supplied
        )
            ? supplied
            : crypto.randomUUID();

    req.requestId = requestId;

    res.setHeader(
        "X-Request-ID",
        requestId
    );

    next();
}

/* =========================================================
 * Request logging
 * ========================================================= */

function requestLogger(
    req,
    res,
    next
) {
    const started =
        process.hrtime.bigint();

    res.on(
        "finish",
        () => {
            const duration =
                Number(
                    process.hrtime.bigint() -
                        started
                ) / 1_000_000;

            const entry = {
                requestId:
                    req.requestId,

                method:
                    req.method,

                path:
                    req.originalUrl,

                status:
                    res.statusCode,

                durationMs:
                    Number(
                        duration.toFixed(
                            2
                        )
                    ),
            };

            if (
                res.statusCode >=
                500
            ) {
                console.error(
                    "[HTTP]",
                    entry
                );
            } else if (
                config.logging.level ===
                    "debug" ||
                res.statusCode >=
                    400
            ) {
                console.log(
                    "[HTTP]",
                    entry
                );
            }
        }
    );

    next();
}

/* =========================================================
 * CORS
 * ========================================================= */

function createCorsOptions() {
    const origins =
        config.cors.origins;

    return {
        credentials:
            config.cors.credentials,

        origin(origin, callback) {
            /*
             * Allow non-browser requests.
             *
             * This is useful for health checks,
             * CLI clients, server-to-server calls,
             * and automated tests.
             */
            if (!origin) {
                return callback(
                    null,
                    true
                );
            }

            if (
                !config.cors.enabled
            ) {
                return callback(
                    null,
                    false
                );
            }

            if (
                origins.includes(origin)
            ) {
                return callback(
                    null,
                    true
                );
            }

            /*
             * Development convenience only.
             * Production must use explicit origins.
             */
            if (
                !config.env.production &&
                origins.length === 0
            ) {
                return callback(
                    null,
                    true
                );
            }

            return callback(
                new Error(
                    "CORS origin not allowed."
                )
            );
        },

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Request-ID",
            "Idempotency-Key",
        ],

        exposedHeaders: [
            "X-Request-ID",
        ],
    };
}

/* =========================================================
 * Rate limiting
 * ========================================================= */

function createRateLimiter({
    windowMs,
    maxRequests,
}) {
    const clients =
        new Map();

    return function rateLimiter(
        req,
        res,
        next
    ) {
        const now =
            Date.now();

        const key =
            req.ip ||
            req.socket.remoteAddress ||
            "unknown";

        let record =
            clients.get(key);

        if (
            !record ||
            now >=
                record.resetAt
        ) {
            record = {
                count: 0,
                resetAt:
                    now +
                    windowMs,
            };

            clients.set(
                key,
                record
            );
        }

        record.count += 1;

        const remaining =
            Math.max(
                maxRequests -
                    record.count,
                0
            );

        res.setHeader(
            "X-RateLimit-Limit",
            String(maxRequests)
        );

        res.setHeader(
            "X-RateLimit-Remaining",
            String(remaining)
        );

        res.setHeader(
            "X-RateLimit-Reset",
            String(
                Math.ceil(
                    record.resetAt /
                        1000
                )
            )
        );

        if (
            record.count >
            maxRequests
        ) {
            res.status(429);

            return res.json({
                error: {
                    code:
                        "RATE_LIMITED",

                    message:
                        "Too many requests.",

                    requestId:
                        req.requestId,
                },
            });
        }

        next();
    };
}

/* =========================================================
 * Health response
 * ========================================================= */

function buildHealthResponse(
    database
) {
    return {
        status: "ok",

        service:
            config.app.name,

        version:
            config.app.version,

        environment:
            config.env.name,

        uptimeSeconds:
            Math.floor(
                process.uptime()
            ),

        startedAt:
            startedAt.toISOString(),

        timestamp:
            new Date().toISOString(),

        database,
    };
}

/* =========================================================
 * Health routes
 * ========================================================= */

function registerHealthRoutes(
    app
) {
    app.get(
        "/health",
        async (req, res) => {
            const database =
                await db.healthCheck();

            const healthy =
                database.healthy;

            res.status(
                healthy
                    ? 200
                    : 503
            ).json(
                buildHealthResponse(
                    database
                )
            );
        }
    );

    app.get(
        "/ready",
        async (req, res) => {
            const database =
                await db.healthCheck();

            if (!database.healthy) {
                return res.status(
                    503
                ).json({
                    status:
                        "not_ready",

                    requestId:
                        req.requestId,
                });
            }

            return res.json({
                status:
                    "ready",

                requestId:
                    req.requestId,
            });
        }
    );

    app.get(
        "/live",
        (req, res) => {
            res.json({
                status:
                    "alive",

                uptimeSeconds:
                    Math.floor(
                        process.uptime()
                    ),

                requestId:
                    req.requestId,
            });
        }
    );
}

/* =========================================================
 * API root
 * ========================================================= */

function registerApiRoot(
    app
) {
    app.get(
        config.app.apiPrefix,
        (req, res) => {
            res.json({
                name:
                    config.app.name,

                version:
                    config.app.version,

                api:
                    config.app.apiPrefix,

                status:
                    "online",

                timestamp:
                    new Date().toISOString(),

                requestId:
                    req.requestId,
            });
        }
    );
}

/* =========================================================
 * Route registration
 * ========================================================= */

function registerApiRoutes(
    app
) {
    /*
     * The individual route modules can be added here
     * as the backend grows.
     *
     * Example:
     *
     * const playerRoutes =
     *     require("./src/api/routes/player");
     *
     * app.use(
     *     `${config.app.apiPrefix}/player`,
     *     playerRoutes
     * );
     */

    registerPlaceholderRoutes(
        app
    );
}

/* =========================================================
 * Temporary route layer
 *
 * This keeps the server bootable while the real route
 * modules are being built.
 * ========================================================= */

function registerPlaceholderRoutes(
    app
) {
    const prefix =
        config.app.apiPrefix;

    app.get(
        `${prefix}/status`,
        (req, res) => {
            res.json({
                status:
                    "online",

                service:
                    config.app.name,

                version:
                    config.app.version,

                requestId:
                    req.requestId,
            });
        }
    );
}

/* =========================================================
 * 404 handler
 * ========================================================= */

function notFoundHandler(
    req,
    res
) {
    res.status(404).json({
        error: {
            code:
                "NOT_FOUND",

            message:
                "The requested resource was not found.",

            path:
                req.originalUrl,

            requestId:
                req.requestId,
        },
    });
}

/* =========================================================
 * Error handler
 * ========================================================= */

function errorHandler(
    error,
    req,
    res,
    next
) {
    if (res.headersSent) {
        return next(error);
    }

    console.error(
        "[SERVER ERROR]",
        {
            requestId:
                req.requestId,

            name:
                error?.name,

            code:
                error?.code,

            message:
                config.env.production
                    ? "Internal server error."
                    : error?.message,

            stack:
                config.env.production
                    ? undefined
                    : error?.stack,
        }
    );

    /*
     * CORS errors.
     */
    if (
        error?.message ===
        "CORS origin not allowed."
    ) {
        return res.status(403).json({
            error: {
                code:
                    "CORS_FORBIDDEN",

                message:
                    "Origin is not allowed.",

                requestId:
                    req.requestId,
            },
        });
    }

    /*
     * Express/body-parser payload errors.
     */
    if (
        error?.type ===
        "entity.too.large"
    ) {
        return res.status(413).json({
            error: {
                code:
                    "PAYLOAD_TOO_LARGE",

                message:
                    "Request payload is too large.",

                requestId:
                    req.requestId,
            },
        });
    }

    const status =
        Number.isInteger(
            error?.statusCode
        )
            ? error.statusCode
            : Number.isInteger(
                  error?.status
              )
            ? error.status
            : 500;

    return res.status(
        status >= 400 &&
            status < 600
            ? status
            : 500
    ).json({
        error: {
            code:
                error?.code ||
                "INTERNAL_ERROR",

            message:
                config.env.production
                    ? "Internal server error."
                    : error?.message ||
                      "Internal server error.",

            requestId:
                req.requestId,
        },
    });
}

/* =========================================================
 * Express application
 * ========================================================= */

function createApp() {
    const app =
        express();

    /*
     * Reverse proxy support.
     */
    if (
        config.app.trustProxy
    ) {
        app.set(
            "trust proxy",
            true
        );
    }

    /*
     * Hide Express signature.
     */
    app.disable(
        "x-powered-by"
    );

    /*
     * Security headers.
     */
    if (
        config.security.helmet
    ) {
        app.use(
            helmet()
        );
    }

    /*
     * Request IDs.
     */
    if (
        config.security.requestId
    ) {
        app.use(
            requestIdMiddleware
        );
    } else {
        app.use(
            (req, res, next) => {
                req.requestId =
                    crypto.randomUUID();

                res.setHeader(
                    "X-Request-ID",
                    req.requestId
                );

                next();
            }
        );
    }

    /*
     * CORS.
     */
    if (
        config.cors.enabled
    ) {
        app.use(
            cors(
                createCorsOptions()
            )
        );
    }

    /*
     * Request body parsing.
     */
    app.use(
        express.json({
            limit:
                config.security
                    .maxBodySize,
        })
    );

    app.use(
        express.urlencoded({
            extended: true,

            limit:
                config.security
                    .maxBodySize,
        })
    );

    /*
     * Request logging.
     */
    app.use(
        requestLogger
    );

    /*
     * Global rate limiting.
     */
    if (
        config.rateLimit.enabled
    ) {
        app.use(
            createRateLimiter({
                windowMs:
                    config.rateLimit
                        .windowMs,

                maxRequests:
                    config.rateLimit
                        .maxRequests,
            })
        );
    }

    /*
     * Health endpoints.
     *
     * Register before authenticated API
     * middleware so monitoring systems can
     * reach them.
     */
    registerHealthRoutes(
        app
    );

    registerApiRoot(
        app
    );

    /*
     * API routes.
     */
    registerApiRoutes(
        app
    );

    /*
     * 404.
     */
    app.use(
        notFoundHandler
    );

    /*
     * Global error handler.
     */
    app.use(
        errorHandler
    );

    return app;
}

/* =========================================================
 * Startup
 * ========================================================= */

async function start() {
    if (server) {
        return server;
    }

    console.log(
        `[Server] Starting ${config.app.name}...`
    );

    console.log(
        `[Server] Environment: ${config.env.name}`
    );

    /*
     * Initialize database.
     */
    await db.init();

    /*
     * Register database shutdown handlers.
     */
    db.registerShutdownHandlers();

    /*
     * Create Express app.
     */
    const app =
        createApp();

    /*
     * Create HTTP server.
     */
    server = http.createServer(
        app
    );

    await new Promise(
        (resolve, reject) => {
            const onError =
                (error) => {
                    server.removeListener(
                        "listening",
                        onListening
                    );

                    reject(error);
                };

            const onListening =
                () => {
                    server.removeListener(
                        "error",
                        onError
                    );

                    resolve();
                };

            server.once(
                "error",
                onError
            );

            server.once(
                "listening",
                onListening
            );

            server.listen(
                config.app.port,
                config.app.host
            );
        }
    );

    const address =
        server.address();

    const host =
        typeof address ===
        "object"
            ? address.address
            : config.app.host;

    const port =
        typeof address ===
        "object"
            ? address.port
            : config.app.port;

    console.log(
        `[Server] Listening on ${host}:${port}`
    );

    console.log(
        `[Server] API: ${config.app.apiPrefix}`
    );

    return server;
}

/* =========================================================
 * Graceful shutdown
 * ========================================================= */

async function shutdown(
    signal
) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(
        `[Server] Received ${signal}. Shutting down...`
    );

    /*
     * Stop accepting new HTTP connections.
     */
    if (server) {
        await new Promise(
            (resolve) => {
                server.close(
                    () => {
                        resolve();
                    }
                );
            }
        );

        server = null;
    }

    /*
     * Close PostgreSQL pool.
     */
    try {
        await db.close();
    } catch (error) {
        console.error(
            "[Server] Database shutdown error:",
            error
        );

        process.exitCode = 1;
    }

    console.log(
        "[Server] Shutdown complete."
    );
}

/* =========================================================
 * Process signals
 * ========================================================= */

process.once(
    "SIGINT",
    () =>
        shutdown("SIGINT")
            .then(() => {
                process.exit(
                    process.exitCode ||
                        0
                );
            })
            .catch(() => {
                process.exit(1);
            })
);

process.once(
    "SIGTERM",
    () =>
        shutdown("SIGTERM")
            .then(() => {
                process.exit(
                    process.exitCode ||
                        0
                );
            })
            .catch(() => {
                process.exit(1);
            })
);

/* =========================================================
 * Unhandled errors
 * ========================================================= */

process.on(
    "unhandledRejection",
    (reason) => {
        console.error(
            "[Process] Unhandled promise rejection:",
            reason
        );

        /*
         * Do not silently continue in production.
         * The process manager should restart the service.
         */
        if (
            config.env.production
        ) {
            shutdown(
                "UNHANDLED_REJECTION"
            )
                .then(() =>
                    process.exit(1)
                )
                .catch(() =>
                    process.exit(1)
                );
        }
    }
);

process.on(
    "uncaughtException",
    (error) => {
        console.error(
            "[Process] Uncaught exception:",
            error
        );

        shutdown(
            "UNCAUGHT_EXCEPTION"
        )
            .then(() =>
                process.exit(1)
            )
            .catch(() =>
                process.exit(1)
            );
    }
);

/* =========================================================
 * Start when executed directly
 * ========================================================= */

if (
    require.main === module
) {
    start().catch(
        (error) => {
            console.error(
                "[Server] Startup failed:",
                error
            );

            process.exit(1);
        }
    );
}

/* =========================================================
 * Exports
 * ========================================================= */

module.exports = {
    createApp,
    start,
    shutdown,
};

function registerApiRoutes(app) {
    const adminRoutes =
        require("./routes/admin");

    app.use(
        `${config.app.apiPrefix}/admin`,
        adminRoutes
    );
}
