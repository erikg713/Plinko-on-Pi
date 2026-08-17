"use strict";

/**
 * Plinko-on-Pi Admin Configuration
 *
 * IMPORTANT:
 * Never put private API keys, database credentials,
 * Pi wallet secrets, JWT signing secrets, or other
 * server-side secrets in this file.
 *
 * Everything in /public is visible to the browser.
 */
(function (window) {
    "use strict";

    const root =
        document.documentElement;

    const env =
        window.__PLINKO_ADMIN_CONFIG__ ||
        {};

    const apiBase =
        env.apiBase ||
        root.dataset.apiBase ||
        "/api";

    const appName =
        env.appName ||
        "Plinko-on-Pi Admin";

    const appVersion =
        env.version ||
        "1.0.0";

    window.PLINKO_ADMIN_CONFIG = {
        apiBase: String(apiBase).replace(
            /\/+$/,
            ""
        ),

        appName,

        version: appVersion,

        requestTimeout:
            Number(
                env.requestTimeout
            ) || 15000,

        pagination: {
            defaultLimit: 50,
            maxLimit: 250,
        },

        polling: {
            health: 10000,
            dashboard: 15000,
            logs: 5000,
        },

        features: {
            seeds: true,
            games: true,
            players: true,
            transactions: true,
            health: true,
            logs: true,
            settings: true,
        },
    };
})(window);

(() => {
    "use strict";

    const STORAGE = {
        API_URL:
            "plinko_admin_api_url",

        TOKEN:
            "plinko_admin_token",

        PAGE:
            "plinko_admin_page",

        THEME:
            "plinko_admin_theme"
    };

    /*
     * Resolve an environment-style value.
     *
     * Allows the backend/server to inject:
     *
     * window.__PLINKO_ADMIN_CONFIG__
     *
     * without requiring a rebuild.
     */
    const runtime =
        window.__PLINKO_ADMIN_CONFIG__ || {};

    /*
     * API URL.
     *
     * Priority:
     *
     * 1. Runtime configuration
     * 2. Existing localStorage override
     * 3. Default /api
     */
    const API_BASE_URL = String(
        runtime.API_BASE_URL ??
        localStorage.getItem(
            STORAGE.API_URL
        ) ??
        "/api"
    ).replace(/\/+$/, "");

    /*
     * Request timeout.
     */
    const REQUEST_TIMEOUT_MS =
        toPositiveInteger(
            runtime.REQUEST_TIMEOUT_MS,
            10000
        );

    /*
     * Number of retries for safe API requests.
     */
    const MAX_RETRIES =
        toNonNegativeInteger(
            runtime.MAX_RETRIES,
            2
        );

    /*
     * Initial retry delay.
     *
     * api.js applies exponential backoff.
     */
    const RETRY_DELAY_MS =
        toPositiveInteger(
            runtime.RETRY_DELAY_MS,
            500
        );

    /*
     * Dashboard automatic refresh.
     */
    const AUTO_REFRESH_MS =
        toPositiveInteger(
            runtime.AUTO_REFRESH_MS,
            30000
        );

    /*
     * Pagination.
     */
    const DEFAULT_PAGE_SIZE =
        toPositiveInteger(
            runtime.DEFAULT_PAGE_SIZE,
            25
        );

    const MAX_PAGE_SIZE =
        toPositiveInteger(
            runtime.MAX_PAGE_SIZE,
            100
        );

    /*
     * Application information.
     */
    const APP = Object.freeze({
        NAME:
            "Plinko-on-Pi Admin",

        SHORT_NAME:
            "Plinko Admin",

        VERSION:
            String(
                runtime.VERSION ??
                "1.0.0"
            ),

        ENVIRONMENT:
            String(
                runtime.ENVIRONMENT ??
                "production"
            )
    });

    /*
     * API endpoint map.
     *
     * Keep endpoint definitions centralized so
     * frontend modules don't hard-code paths.
     */
    const ENDPOINTS = Object.freeze({

        AUTH: Object.freeze({
            LOGIN:
                "/admin/auth/login",

            LOGOUT:
                "/admin/auth/logout",

            ME:
                "/admin/auth/me"
        }),

        DASHBOARD: Object.freeze({
            STATS:
                "/admin/stats",

            HEALTH:
                "/admin/health"
        }),

        PLAYERS: Object.freeze({
            LIST:
                "/admin/players",

            DETAIL:
                id =>
                    `/admin/players/${encodeURIComponent(id)}`
        }),

        GAMES: Object.freeze({
            LIST:
                "/admin/games",

            DETAIL:
                id =>
                    `/admin/games/${encodeURIComponent(id)}`
        }),

        TRANSACTIONS: Object.freeze({
            LIST:
                "/admin/transactions",

            DETAIL:
                id =>
                    `/admin/transactions/${encodeURIComponent(id)}`
        }),

        LOGS: Object.freeze({
            LIST:
                "/admin/logs"
        }),

        CONFIG: Object.freeze({
            GET:
                "/admin/config",

            UPDATE:
                "/admin/config"
        }),

        GAME: Object.freeze({
            STATUS:
                "/admin/game/status",

            PAUSE:
                "/admin/game/pause",

            RESUME:
                "/admin/game/resume"
        }),

        SYSTEM: Object.freeze({
            STATUS:
                "/admin/system/status",

            METRICS:
                "/admin/system/metrics"
        })
    });

    /*
     * Admin UI behavior.
     */
    const UI = Object.freeze({

        DEFAULT_PAGE:
            "dashboard",

        TOAST_DURATION_MS:
            4000,

        MOBILE_BREAKPOINT:
            760,

        SIDEBAR_WIDTH:
            250,

        SEARCH_DEBOUNCE_MS:
            200
    });

    /*
     * Feature flags.
     *
     * These are frontend visibility/control flags,
     * NOT security controls.
     *
     * Server-side authorization must always be
     * enforced by the backend.
     */
    const FEATURES = Object.freeze({

        PLAYERS:
            runtime.FEATURE_PLAYERS !== false,

        GAMES:
            runtime.FEATURE_GAMES !== false,

        TRANSACTIONS:
            runtime.FEATURE_TRANSACTIONS !== false,

        HEALTH:
            runtime.FEATURE_HEALTH !== false,

        LOGS:
            runtime.FEATURE_LOGS !== false,

        GAME_CONTROLS:
            runtime.FEATURE_GAME_CONTROLS === true,

        CONFIGURATION:
            runtime.FEATURE_CONFIGURATION === true
    });

    /*
     * Storage configuration.
     */
    const STORAGE_CONFIG = Object.freeze({

        API_URL:
            STORAGE.API_URL,

        TOKEN_KEY:
            STORAGE.TOKEN,

        PAGE_KEY:
            STORAGE.PAGE,

        THEME_KEY:
            STORAGE.THEME
    });

    /*
     * HTTP configuration.
     */
    const HTTP = Object.freeze({

        TIMEOUT_MS:
            REQUEST_TIMEOUT_MS,

        MAX_RETRIES:
            MAX_RETRIES,

        RETRY_DELAY_MS:
            RETRY_DELAY_MS,

        CREDENTIALS:
            "same-origin",

        CACHE:
            "no-store",

        ACCEPT:
            "application/json"
    });

    /*
     * Security-related frontend defaults.
     *
     * These do not replace backend security.
     */
    const SECURITY = Object.freeze({

        REQUIRE_HTTPS_IN_PRODUCTION:
            runtime.REQUIRE_HTTPS !== false,

        TOKEN_STORAGE:
            "localStorage",

        SEND_CREDENTIALS:
            true,

        REDACT_AUTH_ERRORS:
            true
    });

    /*
     * Validate production configuration.
     */
    function validate() {

        const warnings = [];

        if (
            APP.ENVIRONMENT ===
                "production" &&
            SECURITY.REQUIRE_HTTPS_IN_PRODUCTION &&
            window.location.protocol !==
                "https:" &&
            window.location.hostname !==
                "localhost" &&
            window.location.hostname !==
                "127.0.0.1"
        ) {

            warnings.push(
                "Admin dashboard is running without HTTPS."
            );
        }

        if (
            !API_BASE_URL
        ) {

            warnings.push(
                "API_BASE_URL is empty."
            );
        }

        if (
            warnings.length
        ) {

            console.warn(
                "[Plinko Admin Configuration]",
                warnings
            );
        }

        return warnings;
    }

    /*
     * Runtime configuration helper.
     */
    function get(key, fallback = null) {

        if (
            Object.prototype.hasOwnProperty.call(
                runtime,
                key
            )
        ) {
            return runtime[key];
        }

        return fallback;
    }

    /*
     * Set a local API URL override.
     *
     * Useful for development:
     *
     * setAPIBaseURL("http://localhost:8000/api")
     */
    function setAPIBaseURL(url) {

        if (
            typeof url !==
            "string"
        ) {
            throw new TypeError(
                "API URL must be a string."
            );
        }

        const normalized =
            url.trim().replace(
                /\/+$/,
                ""
            );

        if (!normalized) {
            throw new Error(
                "API URL cannot be empty."
            );
        }

        localStorage.setItem(
            STORAGE.API_URL,
            normalized
        );

        return normalized;
    }

    /*
     * Remove local API URL override.
     */
    function clearAPIBaseURL() {

        localStorage.removeItem(
            STORAGE.API_URL
        );
    }

    /*
     * Numeric helpers.
     */
    function toPositiveInteger(
        value,
        fallback
    ) {

        const number =
            Number(value);

        if (
            Number.isInteger(number) &&
            number > 0
        ) {
            return number;
        }

        return fallback;
    }

    function toNonNegativeInteger(
        value,
        fallback
    ) {

        const number =
            Number(value);

        if (
            Number.isInteger(number) &&
            number >= 0
        ) {
            return number;
        }

        return fallback;
    }

    /*
     * Public immutable configuration.
     */
    const CONFIG = Object.freeze({

        APP,

        API_BASE_URL,

        REQUEST_TIMEOUT_MS,

        MAX_RETRIES,

        RETRY_DELAY_MS,

        AUTO_REFRESH_MS,

        DEFAULT_PAGE_SIZE,

        MAX_PAGE_SIZE,

        ENDPOINTS,

        UI,

        FEATURES,

        STORAGE: STORAGE_CONFIG,

        HTTP,

        SECURITY,

        get,

        setAPIBaseURL,

        clearAPIBaseURL,

        validate
    });

    /*
     * Expose primary configuration.
     */
    window.PLINKO_ADMIN_CONFIG =
        CONFIG;

    /*
     * Backwards-compatible aliases.
     */
    window.PlinkoAdminConfig =
        CONFIG;

    /*
     * Run validation once.
     */
    CONFIG.validate();

})();
