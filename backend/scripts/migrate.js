"use strict";

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const db = require("../db");

const MIGRATIONS_DIR =
    path.resolve(
        __dirname,
        "../migrations"
    );

/* =========================================================
 * Migration table
 * ========================================================= */

const CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`;

/* =========================================================
 * SHA-256
 * ========================================================= */

const crypto = require("crypto");

function checksum(content) {
    return crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
}

/* =========================================================
 * Migration discovery
 * ========================================================= */

async function getMigrationFiles() {
    await fs.mkdir(
        MIGRATIONS_DIR,
        {
            recursive: true,
        }
    );

    const entries =
        await fs.readdir(
            MIGRATIONS_DIR,
            {
                withFileTypes: true,
            }
        );

    return entries
        .filter(
            (entry) =>
                entry.isFile() &&
                entry.name.endsWith(
                    ".sql"
                )
        )
        .map(
            (entry) =>
                entry.name
        )
        .sort();
}

/* =========================================================
 * Applied migrations
 * ========================================================= */

async function getAppliedMigrations() {
    const result =
        await db.query(
            `
            SELECT
                id,
                filename,
                checksum,
                applied_at
            FROM schema_migrations
            ORDER BY id ASC
            `
        );

    return result.rows;
}

/* =========================================================
 * Apply migration
 * ========================================================= */

async function applyMigration(
    filename
) {
    const migrationPath =
        path.join(
            MIGRATIONS_DIR,
            filename
        );

    const sql =
        await fs.readFile(
            migrationPath,
            "utf8"
        );

    const hash =
        checksum(sql);

    console.log(
        `Applying migration: ${filename}`
    );

    await db.transaction(
        async (client) => {
            await client.query(
                sql
            );

            await client.query(
                `
                INSERT INTO schema_migrations (
                    filename,
                    checksum
                )
                VALUES ($1, $2)
                `,
                [
                    filename,
                    hash,
                ]
            );
        }
    );

    console.log(
        `Applied: ${filename}`
    );
}

/* =========================================================
 * Main
 * ========================================================= */

async function main() {
    console.log(
        "Plinko-on-Pi database migration"
    );

    await db.init();

    await db.query(
        CREATE_TABLE
    );

    const files =
        await getMigrationFiles();

    const applied =
        await getAppliedMigrations();

    const appliedMap =
        new Map(
            applied.map(
                (migration) => [
                    migration.filename,
                    migration,
                ]
            )
        );

    let count = 0;

    for (const filename of files) {
        const migrationPath =
            path.join(
                MIGRATIONS_DIR,
                filename
            );

        const sql =
            await fs.readFile(
                migrationPath,
                "utf8"
            );

        const hash =
            checksum(sql);

        const existing =
            appliedMap.get(
                filename
            );

        if (existing) {
            if (
                existing.checksum !==
                hash
            ) {
                throw new Error(
                    `Migration checksum mismatch: ${filename}`
                );
            }

            continue;
        }

        await applyMigration(
            filename
        );

        count += 1;
    }

    console.log(
        `Migration complete. Applied ${count} migration(s).`
    );

    await db.close();
}

main().catch(
    async (error) => {
        console.error(
            "\nMigration failed:"
        );

        console.error(
            error.message
        );

        try {
            await db.close();
        } catch {
            // Ignore close errors.
        }

        process.exitCode = 1;
    }
);
