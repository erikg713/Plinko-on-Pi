"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");

test("database health check returns structured data", async () => {
    const result =
        await db.healthCheck();

    assert.ok(result);

    assert.equal(
        typeof result.status,
        "string"
    );

    assert.equal(
        typeof result.healthy,
        "boolean"
    );

    /*
     * latencyMs can be null when the
     * database is not configured.
     */
    assert.ok(
        result.latencyMs === null ||
        typeof result.latencyMs ===
            "number"
    );
});

test("database health check does not expose credentials", async () => {
    const result =
        await db.healthCheck();

    const serialized =
        JSON.stringify(result);

    assert.equal(
        serialized.includes(
            "DATABASE_URL"
        ),
        false
    );

    assert.equal(
        serialized.includes(
            "password"
        ),
        false
    );
});
