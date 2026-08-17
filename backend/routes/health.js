/**
 * Plinko-on-Pi
 * backend/routes/health.js
 *
 * Health and readiness endpoints.
 *
 * Routes:
 *   GET /health
 *   GET /health/live
 *   GET /health/ready
 *   GET /health/db
 */

"use strict";

const express = require("express");
const os = require("os");
const process = require("process");
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

function getUptimeSeconds() {
    return Math.floor(
        process.uptime()
    );
}

function getMemoryUsage() {
    const memory =
        process.memoryUsage();

    return {
        rss: memory.rss,
        heapTotal:
            memory.heapTotal,
        heapUsed:
            memory.heapUsed,
        external:
            memory.external,
        arrayBuffers:
            memory.arrayBuffers,
    };
}

function successResponse(
    req,
    data
) {
    return {
        status: "ok",
        data,
        requestId:
            getRequestId(req),
        timestamp:
            new Date().toISOString(),
    };
}

/* =========================================================
 * GET /health
 *
 * Full application health check.
 * ========================================================= */

router.get(
    "/",
    async (req, res) => {
        const startedAt =
            Date.now();

        let database = {
            status: "unknown",
            latencyMs: null,
        };

        let databaseHealthy =
            false;

        try {
            const dbStarted =
                Date.now();

            const health =
                await db.healthCheck();

            const latency =
                Date.now() -
                dbStarted;

            database = {
                status:
                    health.healthy
                        ? "ok"
                        : "error",

                latencyMs:
                    latency,

                ...(health.details ||
                    {}),
            };

            databaseHealthy =
                health.healthy;
        } catch (error) {
            database = {
                status: "error",

                latencyMs:
                    Date.now() -
                    startedAt,

                error:
                    config.env.production
                        ? undefined
                        : error.message,
            };
        }

        const healthy =
            databaseHealthy;

        const payload =
            successResponse(
                req,
                {
                    application:
                        "plinko-on-pi",

                    version:
                        config.app.version,

                    environment:
                        config.env.name,

                    uptimeSeconds:
                        getUptimeSeconds(),

                    nodeVersion:
                        process.version,

                    platform:
                        process.platform,

                    architecture:
                        process.arch,

                    hostname:
                        os.hostname(),

                    database,

                    memory:
                        getMemoryUsage(),

                    responseTimeMs:
                        Date.now() -
                        startedAt,
                }
            );

        payload.status =
            healthy
                ? "ok"
                : "degraded";

        return res
            .status(
                healthy
                    ? 200
                    : 503
            )
            .json(payload);
    }
);

/* =========================================================
 * GET /health/live
 *
 * Kubernetes/container liveness probe.
 *
 * This intentionally does NOT query the database.
 * If Node is running, the process is alive.
 * ========================================================= */

router.get(
    "/live",
    (req, res) => {
        return res.status(200).json(
            successResponse(
                req,
                {
                    live: true,

                    uptimeSeconds:
                        getUptimeSeconds(),

                    pid:
                        process.pid,
                }
            )
        );
    }
);

/* =========================================================
 * GET /health/ready
 *
 * Readiness probe.
 *
 * The application is ready only when required dependencies
 * are available.
 * ========================================================= */

router.get(
    "/ready",
    async (req, res) => {
        try {
            const health =
                await db.healthCheck();

            if (
                !health.healthy
            ) {
                return res
                    .status(503)
                    .json({
                        status:
                            "not_ready",

                        data: {
                            database:
                                "unavailable",
                        },

                        requestId:
                            getRequestId(
                                req
                            ),

                        timestamp:
                            new Date().toISOString(),
                    });
            }

            return res.status(200).json({
                status: "ready",

                data: {
                    database:
                        "available",
                },

                requestId:
                    getRequestId(
                        req
                    ),

                timestamp:
                    new Date().toISOString(),
            });
        } catch (error) {
            return res
                .status(503)
                .json({
                    status:
                        "not_ready",

                    data: {
                        database:
                            "error",
                    },

                    requestId:
                        getRequestId(
                            req
                        ),

                    timestamp:
                        new Date().toISOString(),
                });
        }
    }
);

/* =========================================================
 * GET /health/db
 *
 * Detailed database connectivity check.
 * ========================================================= */

router.get(
    "/db",
    async (req, res) => {
        const startedAt =
            Date.now();

        try {
            const health =
                await db.healthCheck();

            const latencyMs =
                Date.now() -
                startedAt;

            if (
                !health.healthy
            ) {
                return res
                    .status(503)
                    .json({
                        status:
                            "error",

                        data: {
                            database:
                                health,
                            latencyMs,
                        },

                        requestId:
                            getRequestId(
                                req
                            ),

                        timestamp:
                            new Date().toISOString(),
                    });
            }

            return res.status(200).json({
                status: "ok",

                data: {
                    database:
                        health,

                    latencyMs,
                },

                requestId:
                    getRequestId(
                        req
                    ),

                timestamp:
                    new Date().toISOString(),
            });
        } catch (error) {
            return res
                .status(503)
                .json({
                    status:
                        "error",

                    data: {
                        database: {
                            healthy: false,
                            error:
                                config.env
                                    .production
                                    ? undefined
                                    : error.message,
                        },

                        latencyMs:
                            Date.now() -
                            startedAt,
                    },

                    requestId:
                        getRequestId(
                            req
                        ),

                    timestamp:
                        new Date().toISOString(),
                });
        }
    }
);

/* =========================================================
 * GET /health/version
 *
 * Lightweight version/build information.
 * ========================================================= */

router.get(
    "/version",
    (req, res) => {
        return res.status(200).json({
            status: "ok",

            data: {
                application:
                    "plinko-on-pi",

                version:
                    config.app.version,

                environment:
                    config.env.name,

                node:
                    process.version,
            },

            requestId:
                getRequestId(req),
        });
    }
);

module.exports = router;
