"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("configuration module loads", () => {
    const config = require("../config");

    assert.ok(config);
    assert.ok(config.app);
    assert.ok(config.env);
    assert.ok(config.game);
    assert.ok(config.database);
    assert.ok(config.security);
});

test("game configuration has valid wager limits", () => {
    const config = require("../config");

    assert.ok(
        config.game.minWager > 0,
        "minimum wager must be greater than zero"
    );

    assert.ok(
        config.game.maxWager >=
            config.game.minWager,
        "maximum wager must not be below minimum wager"
    );
});

test("game row configuration is valid", () => {
    const config = require("../config");

    assert.ok(
        config.game.minRows > 0
    );

    assert.ok(
        config.game.maxRows >=
            config.game.minRows
    );

    assert.ok(
        config.game.defaultRows >=
            config.game.minRows
    );

    assert.ok(
        config.game.defaultRows <=
            config.game.maxRows
    );
});

test("default risk is allowed", () => {
    const config = require("../config");

    assert.ok(
        config.game.allowedRisks.includes(
            config.game.defaultRisk
        )
    );
});

test("safe configuration does not expose secrets", () => {
    const config = require("../config");

    const safe =
        config.safe;

    assert.ok(safe);

    assert.notEqual(
        safe.auth?.jwtSecret,
        config.auth?.jwtSecret
    );

    assert.notEqual(
        safe.pi?.apiKey,
        config.pi?.apiKey
    );

    assert.notEqual(
        safe.provablyFair?.serverSeed,
        config.provablyFair?.serverSeed
    );
});
