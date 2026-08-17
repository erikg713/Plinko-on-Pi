"use strict";

function requireAdmin(
    req,
    res,
    next
) {
    if (!req.player?.id) {
        return res.status(401).json({
            error: {
                code: "AUTH_REQUIRED",
                message:
                    "Authentication is required.",
                requestId:
                    req.requestId,
            },
        });
    }

    if (
        req.player.role !==
        "admin"
    ) {
        return res.status(403).json({
            error: {
                code: "ADMIN_REQUIRED",
                message:
                    "Administrator privileges are required.",
                requestId:
                    req.requestId,
            },
        });
    }

    next();
}

module.exports = {
    requireAdmin,
};
