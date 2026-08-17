"use strict";

const crypto = require("crypto");

function requestId(req, res, next) {
    const incoming =
        req.get("X-Request-ID");

    const id =
        incoming &&
        /^[a-zA-Z0-9._:-]{1,128}$/.test(
            incoming
        )
            ? incoming
            : crypto.randomUUID();

    req.requestId = id;

    res.setHeader(
        "X-Request-ID",
        id
    );

    next();
}

module.exports = requestId;
