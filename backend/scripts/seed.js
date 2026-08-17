"use strict";

require("dotenv").config();

const crypto = require("crypto");

const db = require("../db");

function hashValue(value) {
    return crypto
        .createHash("sha256")
        .update(value)
        .digest("hex");
}

async function tableExists(
    tableName
) {
    const result =
        await db.scalar(
            `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = $1
            )
            `,
            [tableName]
        );

    return Boolean(result);
}

async function seedPlayers() {
    if (
        !(await tableExists(
            "players"
        ))
    ) {
        console.log(
            "[Seed] players table does not exist. Skipping."
        );

        return;
    }

    /*
     * Development-only seed player.
     *
     * Never use real credentials here.
     */
    const username =
        process.env.SEED_USERNAME ||
        "demo_player";

    const externalId =
        process.env.SEED_EXTERNAL_ID ||
        hashValue(
            `plinko-demo:${username}`
        );

    const existing =
        await db.one(
            `
            SELECT id
            FROM players
            WHERE external_id = $1
            LIMIT 1
            `,
            [externalId]
        );

    if (existing) {
        console.log(
            `[Seed] Player already exists: ${username}`
        );

        return;
    }

    await db.query(
        `
        INSERT INTO players (
            external_id,
            username,
            balance
        )
        VALUES ($1, $2, $3)
        `,
        [
            externalId,
            username,
            100,
        ]
    );

    console.log(
        `[Seed] Created player: ${username}`
    );
}

async function main() {
    if (
        process.env.NODE_ENV ===
        "production"
    ) {
        throw new Error(
            "Refusing to run seed.js in production."
        );
    }

    console.log(
        "Plinko-on-Pi database seeding"
    );

    await db.init();

    await seedPlayers();

    await db.close();

    console.log(
        "Seeding complete."
    );
}

main().catch(
    async (error) => {
        console.error(
            "[Seed] Failed:",
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
