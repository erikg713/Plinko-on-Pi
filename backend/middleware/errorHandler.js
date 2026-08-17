"use strict";

const config =
    require("../config");

function errorHandler(
    error,
    req,
    res,
    next
) {
    if (res.headersSent) {
        return next(error);
    }

    const status =
        Number.isInteger(
            error.statusCode
        )
            ? error.statusCode
            : 500;

    const code =
        error.code ||
        "INTERNAL_SERVER_ERROR";

    const message =
        status >= 500 &&
        config.env.production
            ? "Internal server error."
            : error.message ||
              "Request failed.";

    console.error(
        "[SERVER ERROR]",
        {
            requestId:
                req.requestId,

            status,

            code,

            message,

            stack:
                config.env.production
                    ? undefined
                    : error.stack,
        }
    );

    res.status(status).json({
        error: {
            code,
            message,
            requestId:
                req.requestId,
        },
    });
}

module.exports =
    errorHandler;
