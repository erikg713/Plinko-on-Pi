"use strict";

require("dotenv").config();

const db = require("../db");

async function main() {
    console.log("Checking PostgreSQL health...\n");

    const health =
        await db.healthCheck();

    console.log(
        JSON.stringify(
            health,
            null,
            2
        )
    );

    const stats =
        db.getPoolStats();

    console.log(
        "\nPool:"
    );

    console.log(
        JSON.stringify(
            stats,
            null,
            2
        )
    );

    await db.close();

    if (!health.healthy) {
        process.exitCode = 1;
    }
}

main().catch(
    async (error) => {
        console.error(
            "[DB Health] Failed:",
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
