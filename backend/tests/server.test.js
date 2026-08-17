"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const http = require("node:http");

const {
    createApp,
} = require("../server");

function request(
    app,
    options = {}
) {
    return new Promise(
        (resolve, reject) => {
            const server =
                http.createServer(
                    app
                );

            server.listen(
                0,
                "127.0.0.1",
                () => {
                    const address =
                        server.address();

                    const req =
                        http.request(
                            {
                                hostname:
                                    "127.0.0.1",

                                port:
                                    address.port,

                                path:
                                    options.path ||
                                    "/",

                                method:
                                    options.method ||
                                    "GET",

                                headers:
                                    options.headers ||
                                    {},
                            },
                            (res) => {
                                let body =
                                    "";

                                res.on(
                                    "data",
                                    (chunk) => {
                                        body +=
                                            chunk.toString();
                                    }
                                );

                                res.on(
                                    "end",
                                    () => {
                                        server.close();

                                        resolve(
                                            {
                                                status:
                                                    res.statusCode,

                                                headers:
                                                    res.headers,

                                                body,
                                            }
                                        );
                                    }
                                );
                            }
                        );

                    req.on(
                        "error",
                        (error) => {
                            server.close();

                            reject(
                                error
                            );
                        }
                    );

                    req.end();
                }
            );
        }
    );
}

test("application can be created", () => {
    const app =
        createApp();

    assert.equal(
        typeof app,
        "function"
    );
});

test("live endpoint returns alive", async () => {
    const app =
        createApp();

    const response =
        await request(
            app,
            {
                path: "/live",
            }
        );

    assert.equal(
        response.status,
        200
    );

    const body =
        JSON.parse(
            response.body
        );

    assert.equal(
        body.status,
        "alive"
    );

    assert.ok(
        body.requestId
    );
});

test("API root returns service information", async () => {
    const app =
        createApp();

    const response =
        await request(
            app,
            {
                path: "/api/v1",
            }
        );

    assert.equal(
        response.status,
        200
    );

    const body =
        JSON.parse(
            response.body
        );

    assert.equal(
        body.status,
        "online"
    );

    assert.ok(
        body.name
    );

    assert.ok(
        body.version
    );
});

test("status endpoint returns online", async () => {
    const app =
        createApp();

    const response =
        await request(
            app,
            {
                path: "/api/v1/status",
            }
        );

    assert.equal(
        response.status,
        200
    );

    const body =
        JSON.parse(
            response.body
        );

    assert.equal(
        body.status,
        "online"
    );
});

test("unknown route returns 404 JSON", async () => {
    const app =
        createApp();

    const response =
        await request(
            app,
            {
                path: "/does-not-exist",
            }
        );

    assert.equal(
        response.status,
        404
    );

    const body =
        JSON.parse(
            response.body
        );

    assert.equal(
        body.error.code,
        "NOT_FOUND"
    );

    assert.ok(
        body.error.requestId
    );
});

test("responses contain request ID", async () => {
    const app =
        createApp();

    const response =
        await request(
            app,
            {
                path: "/live",
            }
        );

    assert.ok(
        response.headers[
            "x-request-id"
        ]
    );

    const body =
        JSON.parse(
            response.body
        );

    assert.equal(
        response.headers[
            "x-request-id"
        ],
        body.requestId
    );
});

test("client request ID is preserved", async () => {
    const app =
        createApp();

    const requestId =
        "test-request-123";

    const response =
        await request(
            app,
            {
                path: "/live",

                headers: {
                    "X-Request-ID":
                        requestId,
                },
            }
        );

    assert.equal(
        response.status,
        200
    );

    assert.equal(
        response.headers[
            "x-request-id"
        ],
        requestId
    );
});

test("CORS preflight can be processed", async () => {
    const app =
        createApp();

    const response =
        await request(
            app,
            {
                path: "/live",

                method:
                    "OPTIONS",

                headers: {
                    Origin:
                        "http://localhost:3000",

                    "Access-Control-Request-Method":
                        "GET",
                },
            }
        );

    assert.ok(
        response.status === 204 ||
        response.status === 200
    );
});
