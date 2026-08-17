/**
 * Plinko-on-Pi Backend
 * backend/config.js
 *
 * Central application configuration.
 *
 * IMPORTANT:
 * - Never commit production secrets.
 * - Never expose SERVER_SEED through an API response.
 * - Production should fail closed when required secrets are missing.
 */

"use strict";

const path = require("path");

/* =========================================================
 * Environment helpers
 * ========================================================= */

function getEnv(name, fallback = undefined) {
    const value = process.env[name];

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    return value.trim();
}

function getRequiredEnv(name) {
    const value = getEnv(name);

    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}`
        );
    }

    return value;
}

function getBoolean(
    name,
    fallback = false
) {
    const value = getEnv(name);

    if (value === undefined) {
        return fallback;
    }

    return [
        "1",
        "true",
        "yes",
        "on",
    ].includes(
        value.toLowerCase()
    );
}

function getNumber(
    name,
    fallback
) {
    const value = getEnv(name);

    if (value === undefined) {
        return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        throw new Error(
            `${name} must be a valid number`
        );
    }

    return parsed;
}

function getInteger(
    name,
    fallback
) {
    const value = getNumber(
        name,
        fallback
    );

    if (!Number.isInteger(value)) {
        throw new Error(
            `${name} must be an integer`
        );
    }

    return value;
}

function getList(
    name,
    fallback = []
) {
    const value = getEnv(name);

    if (!value) {
        return fallback;
    }

    return value
        .split(",")
        .map((item) =>
            item.trim()
        )
        .filter(Boolean);
}

/* =========================================================
 * Runtime
 * ========================================================= */

const NODE_ENV =
    getEnv(
        "NODE_ENV",
        "development"
    ).toLowerCase();

const isProduction =
    NODE_ENV === "production";

const isDevelopment =
    NODE_ENV === "development";

const isTest =
    NODE_ENV === "test";

/* =========================================================
 * Application
 * ========================================================= */

const config = {
    env: {
        name: NODE_ENV,

        production:
            isProduction,

        development:
            isDevelopment,

        test: isTest,
    },

    app: {
        name: getEnv(
            "APP_NAME",
            "plinko-on-pi-backend"
        ),

        version: getEnv(
            "APP_VERSION",
            "1.0.0"
        ),

        host: getEnv(
            "HOST",
            "0.0.0.0"
        ),

        port: getInteger(
            "PORT",
            3000
        ),

        apiPrefix: getEnv(
            "API_PREFIX",
            "/api/v1"
        ),

        trustProxy:
            getBoolean(
                "TRUST_PROXY",
                isProduction
            ),
    },

    /* =====================================================
     * Database
     * ===================================================== */

    database: {
        url: getEnv(
            "DATABASE_URL",
            ""
        ),

        poolMin: getInteger(
            "DB_POOL_MIN",
            2
        ),

        poolMax: getInteger(
            "DB_POOL_MAX",
            10
        ),

        connectionTimeoutMs:
            getInteger(
                "DB_CONNECTION_TIMEOUT_MS",
                10000
            ),

        idleTimeoutMs:
            getInteger(
                "DB_IDLE_TIMEOUT_MS",
                30000
            ),

        ssl:
            getBoolean(
                "DB_SSL",
                isProduction
            ),
    },

    /* =====================================================
     * Authentication
     * ===================================================== */

    auth: {
        jwtSecret: getEnv(
            "JWT_SECRET",
            ""
        ),

        jwtIssuer: getEnv(
            "JWT_ISSUER",
            "plinko-on-pi"
        ),

        jwtAudience: getEnv(
            "JWT_AUDIENCE",
            "plinko-api"
        ),

        accessTokenTTL:
            getEnv(
                "JWT_ACCESS_TTL",
                "15m"
            ),

        refreshTokenTTL:
            getEnv(
                "JWT_REFRESH_TTL",
                "30d"
            ),

        cookieName:
            getEnv(
                "AUTH_COOKIE_NAME",
                "plinko_session"
            ),

        secureCookies:
            getBoolean(
                "SECURE_COOKIES",
                isProduction
            ),
    },

    /* =====================================================
     * Admin
     * ===================================================== */

    admin: {
        enabled:
            getBoolean(
                "ADMIN_ENABLED",
                true
            ),

        sessionTTL:
            getEnv(
                "ADMIN_SESSION_TTL",
                "8h"
            ),

        requireMfa:
            getBoolean(
                "ADMIN_REQUIRE_MFA",
                isProduction
            ),
    },

    /* =====================================================
     * Pi Network
     * ===================================================== */

    pi: {
        enabled:
            getBoolean(
                "PI_ENABLED",
                true
            ),

        apiUrl: getEnv(
            "PI_API_URL",
            ""
        ),

        appId: getEnv(
            "PI_APP_ID",
            ""
        ),

        apiKey: getEnv(
            "PI_API_KEY",
            ""
        ),

        timeoutMs:
            getInteger(
                "PI_API_TIMEOUT_MS",
                10000
            ),
    },

    /* =====================================================
     * Game
     * ===================================================== */

    game: {
        minWager:
            getNumber(
                "MIN_WAGER",
                0.01
            ),

        maxWager:
            getNumber(
                "MAX_WAGER",
                100
            ),

        defaultRows:
            getInteger(
                "DEFAULT_ROWS",
                12
            ),

        minRows:
            getInteger(
                "MIN_ROWS",
                8
            ),

        maxRows:
            getInteger(
                "MAX_ROWS",
                16
            ),

        defaultRisk:
            getEnv(
                "DEFAULT_RISK",
                "medium"
            ),

        allowedRisks:
            getList(
                "ALLOWED_RISKS",
                [
                    "low",
                    "medium",
                    "high",
                ]
            ),
    },

    /* =====================================================
     * Provably Fair
     * ===================================================== */

    provablyFair: {
        algorithm:
            getEnv(
                "PROVABLY_FAIR_ALGORITHM",
                "sha256"
            ),

        hmacAlgorithm:
            getEnv(
                "PROVABLY_FAIR_HMAC",
                "sha256"
            ),

        serverSeed:
            getEnv(
                "SERVER_SEED",
                ""
            ),

        seedRotationHours:
            getInteger(
                "SERVER_SEED_ROTATION_HOURS",
                24
            ),

        nonceStart:
            getInteger(
                "NONCE_START",
                0
            ),
    },

    /* =====================================================
     * Rate limiting
     * ===================================================== */

    rateLimit: {
        enabled:
            getBoolean(
                "RATE_LIMIT_ENABLED",
                true
            ),

        windowMs:
            getInteger(
                "RATE_LIMIT_WINDOW_MS",
                60_000
            ),

        maxRequests:
            getInteger(
                "RATE_LIMIT_MAX_REQUESTS",
                100
            ),

        gameMaxRequests:
            getInteger(
                "GAME_RATE_LIMIT_MAX",
                30
            ),

        authMaxRequests:
            getInteger(
                "AUTH_RATE_LIMIT_MAX",
                20
            ),

        adminMaxRequests:
            getInteger(
                "ADMIN_RATE_LIMIT_MAX",
                60
            ),
    },

    /* =====================================================
     * CORS
     * ===================================================== */

    cors: {
        enabled:
            getBoolean(
                "CORS_ENABLED",
                true
            ),

        origins:
            getList(
                "CORS_ORIGINS",
                isProduction
                    ? []
                    : [
                          "http://localhost:3000",
                          "http://localhost:5173",
                      ]
            ),

        credentials:
            getBoolean(
                "CORS_CREDENTIALS",
                true
            ),
    },

    /* =====================================================
     * Logging
     * ===================================================== */

    logging: {
        level:
            getEnv(
                "LOG_LEVEL",
                isProduction
                    ? "info"
                    : "debug"
            ),

        format:
            getEnv(
                "LOG_FORMAT",
                isProduction
                    ? "json"
                    : "pretty"
            ),

        auditEnabled:
            getBoolean(
                "AUDIT_LOG_ENABLED",
                true
            ),
    },

    /* =====================================================
     * Security
     * ===================================================== */

    security: {
        helmet:
            getBoolean(
                "SECURITY_HEADERS_ENABLED",
                true
            ),

        hsts:
            getBoolean(
                "HSTS_ENABLED",
                isProduction
            ),

        csrf:
            getBoolean(
                "CSRF_ENABLED",
                isProduction
            ),

        requestId:
            getBoolean(
                "REQUEST_ID_ENABLED",
                true
            ),

        maxBodySize:
            getEnv(
                "MAX_BODY_SIZE",
                "1mb"
            ),
    },

    /* =====================================================
     * Transactions
     * ===================================================== */

    transactions: {
        enabled:
            getBoolean(
                "TRANSACTIONS_ENABLED",
                true
            ),

        timeoutMs:
            getInteger(
                "TRANSACTION_TIMEOUT_MS",
                15000
            ),

        retryAttempts:
            getInteger(
                "TRANSACTION_RETRY_ATTEMPTS",
                3
            ),

        idempotencyTTL:
            getInteger(
                "IDEMPOTENCY_TTL_SECONDS",
                86_400
            ),
    },

    /* =====================================================
     * Cache
     * ===================================================== */

    cache: {
        enabled:
            getBoolean(
                "CACHE_ENABLED",
                false
            ),

        url: getEnv(
            "REDIS_URL",
            ""
        ),

        ttl:
            getInteger(
                "CACHE_TTL_SECONDS",
                60
            ),
    },

    /* =====================================================
     * Paths
     * ===================================================== */

    paths: {
        root:
            path.resolve(
                __dirname
            ),

        migrations:
            path.resolve(
                __dirname,
                "migrations"
            ),

        scripts:
            path.resolve(
                __dirname,
                "scripts"
            ),
    },
};

/* =========================================================
 * Validation
 * ========================================================= */

function validateConfig() {
    const errors = [];

    if (
        config.app.port < 1 ||
        config.app.port > 65535
    ) {
        errors.push(
            "PORT must be between 1 and 65535"
        );
    }

    if (
        config.game.minWager <= 0
    ) {
        errors.push(
            "MIN_WAGER must be greater than 0"
        );
    }

    if (
        config.game.maxWager <
        config.game.minWager
    ) {
        errors.push(
            "MAX_WAGER must be greater than or equal to MIN_WAGER"
        );
    }

    if (
        config.game.minRows >
        config.game.maxRows
    ) {
        errors.push(
            "MIN_ROWS cannot exceed MAX_ROWS"
        );
    }

    if (
        !config.game.allowedRisks.includes(
            config.game.defaultRisk
        )
    ) {
        errors.push(
            "DEFAULT_RISK must exist in ALLOWED_RISKS"
        );
    }

    if (isProduction) {
        if (
            !config.auth.jwtSecret
        ) {
            errors.push(
                "JWT_SECRET is required in production"
            );
        }

        if (
            config.auth.jwtSecret.length <
            32
        ) {
            errors.push(
                "JWT_SECRET must be at least 32 characters in production"
            );
        }

        if (
            !config.provablyFair.serverSeed
        ) {
            errors.push(
                "SERVER_SEED is required in production"
            );
        }

        if (
            !config.database.url
        ) {
            errors.push(
                "DATABASE_URL is required in production"
            );
        }

        if (
            config.cors.origins.length ===
            0
        ) {
            errors.push(
                "CORS_ORIGINS must be configured in production"
            );
        }

        if (
            config.pi.enabled &&
            !config.pi.apiUrl
        ) {
            errors.push(
                "PI_API_URL is required when PI_ENABLED=true"
            );
        }
    }

    if (errors.length) {
        throw new Error(
            [
                "Invalid backend configuration:",
                ...errors.map(
                    (error) =>
                        `- ${error}`
                ),
            ].join("\n")
        );
    }

    return true;
}

/* =========================================================
 * Safe configuration
 *
 * Use this when logging configuration.
 * Secrets are deliberately excluded.
 * ========================================================= */

function getSafeConfig() {
    return {
        env: config.env,

        app: config.app,

        database: {
            ...config.database,
            url:
                config.database.url
                    ? "[configured]"
                    : "[not configured]",
        },

        auth: {
            ...config.auth,
            jwtSecret:
                config.auth.jwtSecret
                    ? "[configured]"
                    : "[not configured]",
        },

        admin: config.admin,

        pi: {
            ...config.pi,
            apiKey:
                config.pi.apiKey
                    ? "[configured]"
                    : "[not configured]",
        },

        game: config.game,

        provablyFair: {
            ...config.provablyFair,
            serverSeed:
                config.provablyFair
                    .serverSeed
                    ? "[configured]"
                    : "[not configured]",
        },

        rateLimit:
            config.rateLimit,

        cors: config.cors,

        logging:
            config.logging,

        security:
            config.security,

        transactions:
            config.transactions,

        cache: {
            ...config.cache,
            url:
                config.cache.url
                    ? "[configured]"
                    : "[not configured]",
        },
    };
}

/* =========================================================
 * Public exports
 * ========================================================= */

validateConfig();

module.exports = Object.freeze({
    ...config,

    validate:
        validateConfig,

    safe:
        getSafeConfig,
});
