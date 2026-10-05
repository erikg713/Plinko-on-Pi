/**
 * Plinko-on-Pi
 * backend/lib/provablyFair.js
 *
 * Honest provably-fair primitives, shared by the betting engine
 * and the verification API.
 *
 * Scheme (committed BEFORE the bet):
 *
 *   1. Server generates a random serverSeed, stores it, and
 *      publishes only sha256(serverSeed)  -> serverSeedHash.
 *   2. Player supplies a clientSeed (or one is generated).
 *   3. Outcome path is derived deterministically from
 *      HMAC-SHA256(serverSeed, clientSeed + "-" + nonce).
 *      Each bit of the HMAC output decides one row:
 *      0 = bounce left, 1 = bounce right.
 *   4. After settlement the serverSeed is revealed, so anyone
 *      can recompute the HMAC and verify the path.
 *
 * The server seed is NEVER exposed before reveal. The client
 * NEVER influences the outcome except through its public
 * clientSeed, which is committed before the seed is revealed.
 */

"use strict";

const crypto = require("crypto");

const HASH_ALGORITHM = "sha256";

/* =========================================================
 * Curves
 * ========================================================= */

const CURVES = {
    low: [1.5, 1.25, 1.1, 1.0, 0.8, 1.0, 1.1, 1.25, 1.5],
    medium: [3.0, 1.8, 1.3, 0.9, 0.5, 0.9, 1.3, 1.8, 3.0],
    high: [10.0, 3.0, 1.5, 0.5, 0.2, 0.5, 1.5, 3.0, 10.0],
};

function sha256Hex(value) {
    return crypto
        .createHash(HASH_ALGORITHM)
        .update(String(value), "utf8")
        .digest("hex");
}

/* =========================================================
 * Round creation (commit phase)
 * ========================================================= */

function createRound() {
    const serverSeed = crypto
        .randomBytes(32)
        .toString("hex");

    const serverSeedHash =
        sha256Hex(serverSeed);

    const nonce = crypto.randomInt(
        0,
        2 ** 31
    );

    return {
        serverSeed,
        serverSeedHash,
        nonce,
    };
}

/* =========================================================
 * Deterministic outcome derivation
 * ========================================================= */

function derivePath(
    serverSeed,
    clientSeed,
    nonce,
    rows
) {
    if (
        !serverSeed ||
        !clientSeed ||
        nonce === undefined ||
        nonce === null ||
        !Number.isInteger(rows) ||
        rows < 1 ||
        rows > 64
    ) {
        throw new Error(
            "Invalid provably-fair derivation parameters."
        );
    }

    /*
     * 32 bytes = 256 decision bits. Enough for any sane
     * Plinko board (rows <= 64).
     */
    const hmac = crypto
        .createHmac(
            HASH_ALGORITHM,
            String(serverSeed)
        )
        .update(
            `${clientSeed}-${nonce}`,
            "utf8"
        )
        .digest();

    const path = [];
    let position = 0;

    for (
        let i = 0;
        i < rows;
        i += 1
    ) {
        const byte =
            hmac[
                Math.floor(i / 8)
            ];

        const bit =
            (byte >> (i % 8)) & 1;

        const direction =
            bit === 1 ? "R" : "L";

        path.push(direction);

        if (direction === "R") {
            position += 1;
        }
    }

    return { path, position };
}

function multiplierFor(
    position,
    rows,
    risk
) {
    const curve = CURVES[risk];

    if (!curve) {
        throw new Error(
            `Unknown risk tier: ${risk}`
        );
    }

    const slots = rows + 1;

    const multiplierIndex = Math.min(
        curve.length - 1,
        Math.floor(
            (position /
                Math.max(slots - 1, 1)) *
                curve.length
        )
    );

    return curve[multiplierIndex] || 1;
}

/* =========================================================
 * Verification
 * ========================================================= */

function verifyRound({
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    rows,
    path,
}) {
    const calculatedHash =
        sha256Hex(serverSeed);

    const commitmentValid =
        calculatedHash.toLowerCase() ===
        String(
            serverSeedHash
        ).toLowerCase();

    if (!commitmentValid) {
        return {
            valid: false,
            commitmentValid: false,
            outcomeValid: false,
            calculatedServerSeedHash:
                calculatedHash,
        };
    }

    let derived;

    try {
        derived = derivePath(
            serverSeed,
            clientSeed,
            nonce,
            rows
        );
    } catch {
        return {
            valid: false,
            commitmentValid: true,
            outcomeValid: false,
            calculatedServerSeedHash:
                calculatedHash,
        };
    }

    const expectedPath =
        derived.path.join("");

    const outcomeValid =
        expectedPath ===
        String(path || "");

    return {
        valid:
            commitmentValid &&
            outcomeValid,
        commitmentValid,
        outcomeValid,
        calculatedServerSeedHash:
            calculatedHash,
        derivedPath: expectedPath,
        derivedPosition:
            derived.position,
    };
}

module.exports = {
    CURVES,
    HASH_ALGORITHM,
    sha256Hex,
    createRound,
    derivePath,
    multiplierFor,
    verifyRound,
};
