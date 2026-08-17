"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");

test("database module exports expected functions", () => {
    assert.equal(
        typeof db.createPool,
        "function"
    );

    assert.equal(
        typeof db.query,
        "function"
    );

    assert.equal(
        typeof db.one,
        "function"
    );

    assert.equal(
        typeof db.many,
        "function"
    );

    assert.equal(
        typeof db.scalar,
        "function"
    );

    assert.equal(
        typeof db.transaction,
        "function"
    );

    assert.equal(
        typeof db.serializableTransaction,
        "function"
    );

    assert.equal(
        typeof db.healthCheck,
        "function"
    );

    assert.equal(
        typeof db.init,
        "function"
    );

    assert.equal(
        typeof db.close,
        "function"
    );
});

test("pool statistics are available", () => {
    const stats =
        db.getPoolStats();

    assert.ok(stats);

    assert.equal(
        typeof stats.initialized,
        "boolean"
    );

    assert.equal(
        typeof stats.total,
        "number"
    );

    assert.equal(
        typeof stats.idle,
        "number"
    );

    assert.equal(
        typeof stats.waiting,
        "number"
    );
});

test("sanitizeError does not expose production details", () => {
    const error =
        new Error(
            "database password leaked"
        );

    error.code = "TEST_ERROR";

    const sanitized =
        db.sanitizeError(error);

    assert.ok(sanitized);

    assert.equal(
        sanitized.name,
        "Error"
    );

    assert.equal(
        sanitized.code,
        "TEST_ERROR"
    );
});

test("query rejects invalid SQL input", async () => {
    await assert.rejects(
        () =>
            db.query(
                "",
                []
            ),
        {
            name: "TypeError",
        }
    );
});

test("query rejects non-array parameters", async () => {
    await assert.rejects(
        () =>
            db.query(
                "SELECT 1",
                "not-an-array"
            ),
        {
            name: "TypeError",
        }
    );
});

test("transaction requires a callback", async () => {
    await assert.rejects(
        () =>
            db.transaction(),
        {
            name: "TypeError",
        }
    );
});

test("serializable transaction requires a callback", async () => {
    await assert.rejects(
        () =>
            db.serializableTransaction(),
        {
            name: "TypeError",
        }
    );
});
