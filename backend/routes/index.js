"use strict";

const express = require("express");

const router = express.Router();

router.use(
    "/admin",
    require("./admin")
);

router.use(
    "/bets",
    require("./bets")
);

router.use(
    "/leaderboard",
    require("./leaderboard")
);

router.use(
    "/users",
    require("./users")
);

router.use(
    "/auth",
    require("./auth")
);

router.use(
    "/health",
    require("./health")
);

router.use(
    "/wallet",
    require("./wallet")
);

router.use(
    "/provably-fair",
    require("./provablyFair")
);

module.exports = router;
