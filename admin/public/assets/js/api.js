"use strict";

/**
 * Plinko-on-Pi Admin API Client
 *
 * Expected backend prefix:
 *   /api
 *
 * Example:
 *   GET /api/admin/stats
 *   GET /api/admin/players
 *   GET /api/admin/games
 *
 * Authentication:
 *   Authorization: Bearer <token>
 */

class AdminAPIError extends Error {
    constructor(message, options = {}) {
        super(message);

        this.name = "AdminAPIError";

        this.status = options.status ?? null;
        this.code = options.code ?? null;
        this.data = options.data ?? null;
        this.path = options.path ?? null;
        this.method = options.method ?? null;
    }
}

class AdminAPI {
    constructor(config = {}) {
        const globalConfig =
            window.PLINKO_ADMIN_CONFIG || {};

        this.baseURL = String(
            config.baseURL ??
            globalConfig.API_BASE_URL ??
            "/api"
        ).replace(/\/+$/, "");

        this.timeout = Number(
            config.timeout ??
            globalConfig.REQUEST_TIMEOUT_MS ??
            10000
        );

        this.maxRetries = Number(
            config.maxRetries ??
            globalConfig.MAX_RETRIES ??
            2
        );

        this.retryDelay = Number(
            config.retryDelay ??
            globalConfig.RETRY_DELAY_MS ??
            500
        );

        this.tokenKey =
            config.tokenKey ??
            globalConfig.TOKEN_KEY ??
            "plinko_admin_token";

        this.onUnauthorized =
            typeof config.onUnauthorized === "function"
                ? config.onUnauthorized
                : null;
    }

    /**
     * Return authentication token.
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    /**
     * Store authentication token.
     */
    setToken(token) {
        if (!token || typeof token !== "string") {
            throw new AdminAPIError(
                "Invalid authentication token"
            );
        }

        localStorage.setItem(
            this.tokenKey,
            token
        );
    }

    /**
     * Remove authentication token.
     */
    clearToken() {
        localStorage.removeItem(
            this.tokenKey
        );
    }

    /**
     * Build URL safely.
     */
    buildURL(path, query = null) {
        const cleanPath =
            String(path || "")
                .replace(/^\/+/, "");

        const url =
            `${this.baseURL}/${cleanPath}`;

        if (!query) {
            return url;
        }

        const params =
            new URLSearchParams();

        for (
            const [key, value]
            of Object.entries(query)
        ) {
            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                continue;
            }

            if (Array.isArray(value)) {
                value.forEach(item => {
                    params.append(
                        key,
                        String(item)
                    );
                });

                continue;
            }

            params.set(
                key,
                String(value)
            );
        }

        const encoded =
            params.toString();

        return encoded
            ? `${url}?${encoded}`
            : url;
    }

    /**
     * Create request headers.
     */
    buildHeaders(options = {}) {
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        const token = this.getToken();

        if (token) {
            headers.Authorization =
                `Bearer ${token}`;
        }

        return headers;
    }

    /**
     * Determine whether an HTTP request
     * is safe to retry.
     */
    isRetryable(method, status) {
        const safeMethods = [
            "GET",
            "HEAD",
            "OPTIONS"
        ];

        if (!safeMethods.includes(method)) {
            return false;
        }

        if (!status) {
            return true;
        }

        return (
            status === 408 ||
            status === 425 ||
            status === 429 ||
            status >= 500
        );
    }

    /**
     * Delay helper.
     */
    sleep(ms) {
        return new Promise(
            resolve => setTimeout(
                resolve,
                ms
            )
        );
    }

    /**
     * Parse an HTTP response.
     */
    async parseResponse(response) {
        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "application/json"
            )
        ) {
            try {
                return await response.json();
            } catch {
                return null;
            }
        }

        const text =
            await response.text();

        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    /**
     * Extract a useful API error message.
     */
    extractErrorMessage(
        data,
        fallback
    ) {
        if (!data) {
            return fallback;
        }

        if (typeof data === "string") {
            return data || fallback;
        }

        return (
            data.message ??
            data.error ??
            data.detail ??
            data.reason ??
            fallback
        );
    }

    /**
     * Normalize API response data.
     */
    unwrap(data) {
        if (
            data &&
            typeof data === "object" &&
            Object.prototype.hasOwnProperty.call(
                data,
                "data"
            )
        ) {
            return data.data;
        }

        return data;
    }

    /**
     * Execute an HTTP request.
     */
    async request(
        path,
        options = {}
    ) {
        const method =
            String(
                options.method || "GET"
            ).toUpperCase();

        const query =
            options.query ?? null;

        const url =
            this.buildURL(
                path,
                query
            );

        const headers =
            this.buildHeaders(
                options
            );

        const requestOptions = {
            method,
            headers,
            credentials:
                options.credentials ??
                "same-origin",
            cache:
                options.cache ??
                "no-store"
        };

        if (options.signal) {
            requestOptions.signal =
                options.signal;
        }

        if (
            options.body !== undefined &&
            options.body !== null
        ) {
            if (
                typeof options.body ===
                "string"
            ) {
                requestOptions.body =
                    options.body;
            } else {
                headers[
                    "Content-Type"
                ] =
                    "application/json";

                requestOptions.body =
                    JSON.stringify(
                        options.body
                    );
            }
        }

        let attempt = 0;

        while (true) {
            const controller =
                new AbortController();

            let timeoutTriggered = false;

            const timeoutId =
                setTimeout(() => {
                    timeoutTriggered = true;
                    controller.abort();
                }, this.timeout);

            if (options.signal) {
                if (options.signal.aborted) {
                    controller.abort();
                } else {
                    options.signal.addEventListener(
                        "abort",
                        () => controller.abort(),
                        { once: true }
                    );
                }
            }

            requestOptions.signal =
                controller.signal;

            try {
                const response =
                    await fetch(
                        url,
                        requestOptions
                    );

                const data =
                    await this.parseResponse(
                        response
                    );

                if (response.status === 401) {
                    this.clearToken();

                    if (this.onUnauthorized) {
                        this.onUnauthorized(
                            response,
                            data
                        );
                    }

                    window.dispatchEvent(
                        new CustomEvent(
                            "admin:unauthorized",
                            {
                                detail: {
                                    status:
                                        response.status,
                                    data
                                }
                            }
                        )
                    );

                    throw new AdminAPIError(
                        this.extractErrorMessage(
                            data,
                            "Authentication required"
                        ),
                        {
                            status: 401,
                            code:
                                "UNAUTHORIZED",
                            data,
                            path,
                            method
                        }
                    );
                }

                if (!response.ok) {
                    const retryable =
                        this.isRetryable(
                            method,
                            response.status
                        );

                    if (
                        retryable &&
                        attempt < this.maxRetries
                    ) {
                        attempt += 1;

                        const delay =
                            this.retryDelay *
                            Math.pow(
                                2,
                                attempt - 1
                            );

                        await this.sleep(
                            delay
                        );

                        continue;
                    }

                    throw new AdminAPIError(
                        this.extractErrorMessage(
                            data,
                            `Request failed with HTTP ${response.status}`
                        ),
                        {
                            status:
                                response.status,
                            code:
                                data?.code ??
                                data?.error_code ??
                                "HTTP_ERROR",
                            data,
                            path,
                            method
                        }
                    );
                }

                return data;

            } catch (error) {

                const aborted =
                    error?.name ===
                    "AbortError";

                if (
                    aborted &&
                    !timeoutTriggered
                ) {
                    throw new AdminAPIError(
                        "Request was cancelled",
                        {
                            code:
                                "REQUEST_CANCELLED",
                            path,
                            method
                        }
                    );
                }

                if (
                    aborted &&
                    timeoutTriggered
                ) {
                    if (
                        attempt <
                        this.maxRetries &&
                        this.isRetryable(
                            method,
                            null
                        )
                    ) {
                        attempt += 1;

                        const delay =
                            this.retryDelay *
                            Math.pow(
                                2,
                                attempt - 1
                            );

                        await this.sleep(
                            delay
                        );

                        continue;
                    }

                    throw new AdminAPIError(
                        `Request timed out after ${this.timeout}ms`,
                        {
                            code:
                                "TIMEOUT",
                            path,
                            method
                        }
                    );
                }

                if (
                    error instanceof
                    AdminAPIError
                ) {
                    throw error;
                }

                if (
                    attempt <
                    this.maxRetries &&
                    this.isRetryable(
                        method,
                        null
                    )
                ) {
                    attempt += 1;

                    const delay =
                        this.retryDelay *
                        Math.pow(
                            2,
                            attempt - 1
                        );

                    await this.sleep(
                        delay
                    );

                    continue;
                }

                throw new AdminAPIError(
                    error?.message ||
                    "Network request failed",
                    {
                        code:
                            "NETWORK_ERROR",
                        path,
                        method,
                        data: error
                    }
                );

            } finally {
                clearTimeout(
                    timeoutId
                );
            }
        }
    }

    /* ---------------------------------
       Generic HTTP methods
       --------------------------------- */

    get(path, query = null, options = {}) {
        return this.request(
            path,
            {
                ...options,
                method: "GET",
                query
            }
        );
    }

    post(path, body = null, options = {}) {
        return this.request(
            path,
            {
                ...options,
                method: "POST",
                body
            }
        );
    }

    put(path, body = null, options = {}) {
        return this.request(
            path,
            {
                ...options,
                method: "PUT",
                body
            }
        );
    }

    patch(path, body = null, options = {}) {
        return this.request(
            path,
            {
                ...options,
                method: "PATCH",
                body
            }
        );
    }

    delete(path, query = null, options = {}) {
        return this.request(
            path,
            {
                ...options,
                method: "DELETE",
                query
            }
        );
    }

    /* ---------------------------------
       Authentication
       --------------------------------- */

    async login(username, password) {
        const response =
            await this.post(
                "/admin/auth/login",
                {
                    username,
                    password
                }
            );

        const data =
            this.unwrap(response);

        const token =
            data?.token ??
            data?.access_token;

        if (token) {
            this.setToken(token);
        }

        return response;
    }

    async logout() {
        try {
            await this.post(
                "/admin/auth/logout"
            );
        } finally {
            this.clearToken();
        }
    }

    async me() {
        return this.get(
            "/admin/auth/me"
        );
    }

    /* ---------------------------------
       Dashboard
       --------------------------------- */

    stats() {
        return this.get(
            "/admin/stats"
        );
    }

    health() {
        return this.get(
            "/admin/health"
        );
    }

    /* ---------------------------------
       Players
       --------------------------------- */

    players(params = {}) {
        return this.get(
            "/admin/players",
            params
        );
    }

    player(id) {
        return this.get(
            `/admin/players/${encodeURIComponent(id)}`
        );
    }

    updatePlayer(id, payload) {
        return this.patch(
            `/admin/players/${encodeURIComponent(id)}`,
            payload
        );
    }

    /* ---------------------------------
       Games
       --------------------------------- */

    games(params = {}) {
        return this.get(
            "/admin/games",
            params
        );
    }

    game(id) {
        return this.get(
            `/admin/games/${encodeURIComponent(id)}`
        );
    }

    /* ---------------------------------
       Transactions
       --------------------------------- */

    transactions(params = {}) {
        return this.get(
            "/admin/transactions",
            params
        );
    }

    transaction(id) {
        return this.get(
            `/admin/transactions/${encodeURIComponent(id)}`
        );
    }

    /* ---------------------------------
       Logs
       --------------------------------- */

    logs(params = {}) {
        return this.get(
            "/admin/logs",
            params
        );
    }

    /* ---------------------------------
       Configuration
       --------------------------------- */

    config() {
        return this.get(
            "/admin/config"
        );
    }

    updateConfig(payload) {
        return this.patch(
            "/admin/config",
            payload
        );
    }

    /* ---------------------------------
       Game controls
       --------------------------------- */

    gameStatus() {
        return this.get(
            "/admin/game/status"
        );
    }

    pauseGame() {
        return this.post(
            "/admin/game/pause"
        );
    }

    resumeGame() {
        return this.post(
            "/admin/game/resume"
        );
    }

    /* ---------------------------------
       System
       --------------------------------- */

    systemStatus() {
        return this.get(
            "/admin/system/status"
        );
    }

    systemMetrics() {
        return this.get(
            "/admin/system/metrics"
        );
    }

    /* ---------------------------------
       Convenience helpers
       --------------------------------- */

    async isOnline() {
        try {
            await this.health();
            return true;
        } catch {
            return false;
        }
    }

    async safeRequest(
        requestFunction,
        fallback = null
    ) {
        try {
            return await requestFunction();
        } catch (error) {
            console.error(
                "Admin API request failed:",
                error
            );

            return fallback;
        }
    }
}

/**
 * Global API instance.
 */
window.AdminAPIError =
    AdminAPIError;

window.AdminAPI =
    AdminAPI;

window.adminAPI =
    new AdminAPI();
