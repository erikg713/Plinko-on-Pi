/**
 * Plinko-on-Pi Backend
 * backend/db.js
 *
 * PostgreSQL database layer.
 *
 * Responsibilities:
 * - Connection pooling
 * - Parameterized queries
 * - Transactions
 * - Health checks
 * - Graceful shutdown
 * - Safe database errors
 *
 * Requires:
 *   npm install pg
 */

"use strict";

const { Pool } = require("pg");
const config = require("./config");

/* =========================================================
 * Configuration
 * ========================================================= */

const databaseConfig = config.database;

let pool = null;
let initialized = false;
let shuttingDown = false;

/* =========================================================
 * Pool creation
 * ========================================================= */

function createPool() {
    if (pool) {
        return pool;
    }

    if (!databaseConfig.url) {
        if (config.env.production) {
            throw new Error(
                "DATABASE_URL is required in production."
            );
        }

        console.warn(
            "[DB] DATABASE_URL is not configured."
        );

        return null;
    }

    const options = {
        connectionString:
            databaseConfig.url,

        min:
            databaseConfig.poolMin,

        max:
            databaseConfig.poolMax,

        connectionTimeoutMillis:
            databaseConfig.connectionTimeoutMs,

        idleTimeoutMillis:
            databaseConfig.idleTimeoutMs,

        allowExitOnIdle:
            !config.env.production,
    };

    if (databaseConfig.ssl) {
        options.ssl = {
            rejectUnauthorized: false,
        };
    }

    pool = new Pool(options);

    pool.on(
        "connect",
        () => {
            initialized = true;

            console.info(
                "[DB] PostgreSQL connection established."
            );
        }
    );

    pool.on(
        "error",
        (error) => {
            console.error(
                "[DB] Unexpected PostgreSQL pool error:",
                sanitizeError(error)
            );
        }
    );

    return pool;
}

/* =========================================================
 * Error sanitization
 * ========================================================= */

function sanitizeError(error) {
    if (!error) {
        return {
            message: "Unknown database error",
        };
    }

    return {
        name:
            error.name ||
            "DatabaseError",

        code:
            error.code ||
            undefined,

        message:
            config.env.production
                ? "Database operation failed."
                : error.message,

        detail:
            config.env.production
                ? undefined
                : error.detail,

        constraint:
            error.constraint,

        table:
            error.table,

        column:
            error.column,
    };
}

/* =========================================================
 * Query
 * ========================================================= */

/**
 * Execute a parameterized SQL query.
 *
 * Example:
 *
 * const result = await db.query(
 *     "SELECT * FROM players WHERE id = $1",
 *     [playerId]
 * );
 */
async function query(
    text,
    values = []
) {
    if (shuttingDown) {
        throw new Error(
            "Database is shutting down."
        );
    }

    const database = createPool();

    if (!database) {
        throw new Error(
            "Database is not configured."
        );
    }

    if (
        typeof text !== "string" ||
        !text.trim()
    ) {
        throw new TypeError(
            "SQL query must be a non-empty string."
        );
    }

    if (!Array.isArray(values)) {
        throw new TypeError(
            "SQL query values must be an array."
        );
    }

    const start =
        process.hrtime.bigint();

    try {
        const result =
            await database.query(
                text,
                values
            );

        const duration =
            Number(
                process.hrtime.bigint() -
                    start
            ) / 1_000_000;

        if (
            config.logging.level ===
            "debug"
        ) {
            console.debug(
                "[DB] Query completed",
                {
                    durationMs:
                        Number(
                            duration.toFixed(
                                2
                            )
                        ),
                    rows:
                        result.rowCount,
                }
            );
        }

        return result;
    } catch (error) {
        console.error(
            "[DB] Query failed:",
            sanitizeError(error)
        );

        throw error;
    }
}

/* =========================================================
 * Query helpers
 * ========================================================= */

async function one(
    text,
    values = []
) {
    const result =
        await query(
            text,
            values
        );

    return (
        result.rows[0] ||
        null
    );
}

async function many(
    text,
    values = []
) {
    const result =
        await query(
            text,
            values
        );

    return result.rows;
}

async function scalar(
    text,
    values = []
) {
    const row =
        await one(
            text,
            values
        );

    if (!row) {
        return null;
    }

    const keys =
        Object.keys(row);

    if (!keys.length) {
        return null;
    }

    return row[keys[0]];
}

/* =========================================================
 * Transaction
 * ========================================================= */

/**
 * Execute multiple operations inside one
 * PostgreSQL transaction.
 *
 * Example:
 *
 * await db.transaction(async (client) => {
 *
 *     await client.query(
 *         "UPDATE players SET balance = balance - $1 WHERE id = $2",
 *         [bet, playerId]
 *     );
 *
 *     await client.query(
 *         "INSERT INTO games (...) VALUES (...)",
 *         [...]
 *     );
 *
 * });
 */
async function transaction(
    callback
) {
    if (
        typeof callback !==
        "function"
    ) {
        throw new TypeError(
            "Transaction callback must be a function."
        );
    }

    if (shuttingDown) {
        throw new Error(
            "Database is shutting down."
        );
    }

    const database = createPool();

    if (!database) {
        throw new Error(
            "Database is not configured."
        );
    }

    const client =
        await database.connect();

    try {
        await client.query(
            "BEGIN"
        );

        await client.query(
            "SET TRANSACTION ISOLATION LEVEL READ COMMITTED"
        );

        const result =
            await callback(client);

        await client.query(
            "COMMIT"
        );

        return result;
    } catch (error) {
        try {
            await client.query(
                "ROLLBACK"
            );
        } catch (rollbackError) {
            console.error(
                "[DB] Transaction rollback failed:",
                sanitizeError(
                    rollbackError
                )
            );
        }

        console.error(
            "[DB] Transaction failed:",
            sanitizeError(error)
        );

        throw error;
    } finally {
        client.release();
    }
}

/* =========================================================
 * Serializable transaction
 *
 * Useful for sensitive financial operations.
 * ========================================================= */

async function serializableTransaction(
    callback,
    options = {}
) {
    if (
        typeof callback !==
        "function"
    ) {
        throw new TypeError(
            "Transaction callback must be a function."
        );
    }

    const database = createPool();

    if (!database) {
        throw new Error(
            "Database is not configured."
        );
    }

    const client =
        await database.connect();

    const maxRetries =
        Number.isInteger(
            options.maxRetries
        )
            ? options.maxRetries
            : 3;

    let attempt = 0;

    try {
        while (
            attempt <=
            maxRetries
        ) {
            try {
                await client.query(
                    "BEGIN"
                );

                await client.query(
                    "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"
                );

                const result =
                    await callback(
                        client
                    );

                await client.query(
                    "COMMIT"
                );

                return result;
            } catch (error) {
                try {
                    await client.query(
                        "ROLLBACK"
                    );
                } catch {
                    // Preserve original error.
                }

                /*
                 * PostgreSQL serialization failure:
                 *
                 * 40001 = serialization_failure
                 * 40P01 = deadlock_detected
                 */
                const retryable =
                    error?.code ===
                        "40001" ||
                    error?.code ===
                        "40P01";

                if (
                    !retryable ||
                    attempt >=
                        maxRetries
                ) {
                    throw error;
                }

                attempt += 1;

                const delay =
                    Math.min(
                        1000 *
                            2 **
                                (attempt -
                                    1),
                        5000
                    );

                await sleep(delay);
            }
        }
    } finally {
        client.release();
    }

    throw new Error(
        "Serializable transaction failed."
    );
}

/* =========================================================
 * Health check
 * ========================================================= */

async function healthCheck() {
    const started =
        process.hrtime.bigint();

    try {
        const database =
            createPool();

        if (!database) {
            return {
                status:
                    "unconfigured",

                healthy: false,

                latencyMs: null,
            };
        }

        await database.query(
            "SELECT 1"
        );

        const latency =
            Number(
                process.hrtime.bigint() -
                    started
            ) / 1_000_000;

        return {
            status: "healthy",

            healthy: true,

            latencyMs:
                Number(
                    latency.toFixed(
                        2
                    )
                ),
        };
    } catch (error) {
        return {
            status: "unhealthy",

            healthy: false,

            latencyMs: null,

            error:
                config.env.production
                    ? undefined
                    : error.message,
        };
    }
}

/* =========================================================
 * Pool statistics
 * ========================================================= */

function getPoolStats() {
    if (!pool) {
        return {
            initialized: false,

            total:
                0,

            idle:
                0,

            waiting:
                0,
        };
    }

    return {
        initialized,

        total:
            pool.totalCount,

        idle:
            pool.idleCount,

        waiting:
            pool.waitingCount,
    };
}

/* =========================================================
 * Initialization
 * ========================================================= */

async function init() {
    const database =
        createPool();

    if (!database) {
        if (
            config.env.development ||
            config.env.test
        ) {
            console.warn(
                "[DB] Running without a configured database."
            );

            return false;
        }

        throw new Error(
            "Database initialization failed."
        );
    }

    await database.query(
        "SELECT 1"
    );

    initialized = true;

    console.info(
        "[DB] Database initialized."
    );

    return true;
}

/* =========================================================
 * Graceful shutdown
 * ========================================================= */

async function close() {
    if (
        !pool ||
        shuttingDown
    ) {
        return;
    }

    shuttingDown = true;

    try {
        await pool.end();

        pool = null;
        initialized = false;

        console.info(
            "[DB] Database pool closed."
        );
    } catch (error) {
        console.error(
            "[DB] Failed to close database pool:",
            sanitizeError(error)
        );

        throw error;
    } finally {
        shuttingDown = false;
    }
}

/* =========================================================
 * Utility
 * ========================================================= */

function sleep(ms) {
    return new Promise(
        (resolve) =>
            setTimeout(
                resolve,
                ms
            )
    );
}

/* =========================================================
 * Process shutdown
 *
 * Only register handlers when this file is being used
 * as part of the backend process.
 * ========================================================= */

function registerShutdownHandlers() {
    const shutdown =
        async (signal) => {
            console.info(
                `[DB] Received ${signal}. Closing database...`
            );

            try {
                await close();
            } catch {
                process.exitCode = 1;
            }
        };

    process.once(
        "SIGINT",
        shutdown
    );

    process.once(
        "SIGTERM",
        shutdown
    );
}

/* =========================================================
 * Export
 * ========================================================= */

module.exports = {
    createPool,

    query,

    one,

    many,

    scalar,

    transaction,

    serializableTransaction,

    healthCheck,

    getPoolStats,

    init,

    close,

    registerShutdownHandlers,

    sanitizeError,
};
