"use strict";

const express = require("express");

const router = express.Router();

router.use(
    "/admin",
    require("./admin")
);

router.use(
    "/runs",
    require("./runs")
);

router.use(
    "/store",
    require("./store")
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
    "/payments",
    require("./payments")
);

module.exports = router;
