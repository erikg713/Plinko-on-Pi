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

function getRollbackFile(
    migration
) {
    if (
        !migration ||
        typeof migration !==
            "string"
    ) {
        throw new Error(
            "Usage: npm run db:rollback -- <migration-file>"
        );
    }

    const filename =
        path.basename(
            migration
        );

    if (
        filename !== migration
    ) {
        throw new Error(
            "Invalid migration filename."
        );
    }

    if (
        !filename.endsWith(
            ".sql"
        )
    ) {
        throw new Error(
            "Migration must be a .sql file."
        );
    }

    return filename;
}

async function main() {
    const filename =
        getRollbackFile(
            process.argv[2]
        );

    const rollbackPath =
        path.join(
            MIGRATIONS_DIR,
            filename
        );

    try {
        await fs.access(
            rollbackPath
        );
    } catch {
        throw new Error(
            `Migration not found: ${filename}`
        );
    }

    /*
     * Migration SQL files use the following convention:
     *
     * -- UP
     * CREATE TABLE ...
     *
     * -- DOWN
     * DROP TABLE ...
     *
     * Only the DOWN section is executed here.
     */
    const sql =
        await fs.readFile(
            rollbackPath,
            "utf8"
        );

    const marker =
        "-- DOWN";

    const index =
        sql.indexOf(marker);

    if (index === -1) {
        throw new Error(
            `Migration ${filename} has no "-- DOWN" section.`
        );
    }

    const downSql =
        sql
            .slice(
                index +
                    marker.length
            )
            .trim();

    if (!downSql) {
        throw new Error(
            `Migration ${filename} has an empty DOWN section.`
        );
    }

    await db.init();

    const migration =
        await db.one(
            `
            SELECT
                id,
                filename
            FROM schema_migrations
            WHERE filename = $1
            `,
            [filename]
        );

    if (!migration) {
        throw new Error(
            `Migration is not currently applied: ${filename}`
        );
    }

    console.warn(
        `Rolling back migration: ${filename}`
    );

    await db.transaction(
        async (client) => {
            await client.query(
                downSql
            );

            await client.query(
                `
                DELETE FROM schema_migrations
                WHERE filename = $1
                `,
                [filename]
            );
        }
    );

    console.log(
        `Rolled back: ${filename}`
    );

    await db.close();
}

main().catch(
    async (error) => {
        console.error(
            "\nRollback failed:"
        );

        console.error(
            error.message
        );

        try {
            await db.close();
        } catch {
            // Ignore shutdown errors.
        }

        process.exitCode = 1;
    }
);
