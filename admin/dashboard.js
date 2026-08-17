/* =========================================================
 * Plinko-on-Pi Admin Dashboard
 * admin/dashboard.js
 * ========================================================= */

(function (window, document) {
    "use strict";

    const API = window.PlinkoAdminAPI;

    if (!API) {
        console.error(
            "[Plinko Admin] PlinkoAdminAPI is not loaded."
        );
        return;
    }

    const state = {
        loading: false,
        refreshing: false,
        error: null,
        data: null,
        lastUpdated: null,
        timer: null,
    };

    const SELECTORS = {
        root: "[data-dashboard]",
        loading: "[data-dashboard-loading]",
        error: "[data-dashboard-error]",
        errorMessage:
            "[data-dashboard-error-message]",
        refresh: "[data-dashboard-refresh]",
        lastUpdated:
            "[data-dashboard-last-updated]",

        totalPlayers:
            "[data-stat='total-players']",
        activePlayers:
            "[data-stat='active-players']",
        totalGames:
            "[data-stat='total-games']",
        totalWagered:
            "[data-stat='total-wagered']",
        totalPaid:
            "[data-stat='total-paid']",
        platformProfit:
            "[data-stat='platform-profit']",
        pendingTransactions:
            "[data-stat='pending-transactions']",
        failedTransactions:
            "[data-stat='failed-transactions']",

        health:
            "[data-dashboard-health]",

        recentGames:
            "[data-recent-games]",
        recentTransactions:
            "[data-recent-transactions]",
    };

    const root = document.querySelector(
        SELECTORS.root
    );

    if (!root) {
        return;
    }

    /* -----------------------------------------------------
     * Helpers
     * --------------------------------------------------- */

    function query(selector) {
        return root.querySelector(selector);
    }

    function escapeHtml(value) {
        return String(
            value === undefined ||
                value === null
                ? ""
                : value
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function number(value) {
        const result = Number(value);

        return Number.isFinite(result)
            ? result
            : 0;
    }

    function formatNumber(
        value,
        decimals = 0
    ) {
        return number(value).toLocaleString(
            undefined,
            {
                minimumFractionDigits:
                    decimals,
                maximumFractionDigits:
                    decimals,
            }
        );
    }

    function formatPi(value) {
        return `${formatNumber(
            value,
            4
        )} π`;
    }

    function formatPercent(value) {
        return `${formatNumber(
            value,
            2
        )}%`;
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return escapeHtml(value);
        }

        return date.toLocaleString();
    }

    function setText(
        selector,
        value
    ) {
        const element =
            query(selector);

        if (element) {
            element.textContent =
                value;
        }
    }

    function setLoading(value) {
        state.loading = value;

        const loading =
            query(
                SELECTORS.loading
            );

        if (loading) {
            loading.hidden = !value;
        }

        const refresh =
            query(
                SELECTORS.refresh
            );

        if (refresh) {
            refresh.disabled =
                value ||
                state.refreshing;
        }
    }

    function showError(error) {
        state.error = error;

        const container =
            query(
                SELECTORS.error
            );

        const message =
            query(
                SELECTORS.errorMessage
            );

        if (message) {
            message.textContent =
                error?.message ||
                "Unable to load dashboard data.";
        }

        if (container) {
            container.hidden = false;
        }
    }

    function hideError() {
        state.error = null;

        const container =
            query(
                SELECTORS.error
            );

        if (container) {
            container.hidden = true;
        }
    }

    /* -----------------------------------------------------
     * API normalization
     * --------------------------------------------------- */

    function normalizeDashboard(
        payload
    ) {
        const source =
            payload || {};

        /*
         * Accept either:
         *
         * {
         *   stats: {},
         *   health: {},
         *   recentGames: [],
         *   recentTransactions: []
         * }
         *
         * or:
         *
         * {
         *   data: {
         *      ...
         *   }
         * }
         */

        const data =
            source.data &&
            typeof source.data ===
                "object"
                ? source.data
                : source;

        const stats =
            data.stats ||
            data.statistics ||
            data.metrics ||
            {};

        return {
            stats: {
                totalPlayers:
                    stats.totalPlayers ??
                    stats.players ??
                    0,

                activePlayers:
                    stats.activePlayers ??
                    stats.onlinePlayers ??
                    0,

                totalGames:
                    stats.totalGames ??
                    stats.games ??
                    0,

                totalWagered:
                    stats.totalWagered ??
                    stats.wagered ??
                    0,

                totalPaid:
                    stats.totalPaid ??
                    stats.paid ??
                    stats.payouts ??
                    0,

                platformProfit:
                    stats.platformProfit ??
                    stats.profit ??
                    stats.ggr ??
                    0,

                pendingTransactions:
                    stats.pendingTransactions ??
                    stats.pending ??
                    0,

                failedTransactions:
                    stats.failedTransactions ??
                    stats.failed ??
                    0,

                houseEdge:
                    stats.houseEdge ??
                    0,

                gameWinRate:
                    stats.gameWinRate ??
                    0,
            },

            health:
                data.health ||
                data.services ||
                {},

            recentGames:
                data.recentGames ||
                data.games ||
                [],

            recentTransactions:
                data.recentTransactions ||
                data.transactions ||
                [],
        };
    }

    /* -----------------------------------------------------
     * Dashboard stats
     * --------------------------------------------------- */

    function renderStats(data) {
        const stats =
            data.stats || {};

        setText(
            SELECTORS.totalPlayers,
            formatNumber(
                stats.totalPlayers
            )
        );

        setText(
            SELECTORS.activePlayers,
            formatNumber(
                stats.activePlayers
            )
        );

        setText(
            SELECTORS.totalGames,
            formatNumber(
                stats.totalGames
            )
        );

        setText(
            SELECTORS.totalWagered,
            formatPi(
                stats.totalWagered
            )
        );

        setText(
            SELECTORS.totalPaid,
            formatPi(
                stats.totalPaid
            )
        );

        setText(
            SELECTORS.platformProfit,
            formatPi(
                stats.platformProfit
            )
        );

        setText(
            SELECTORS.pendingTransactions,
            formatNumber(
                stats.pendingTransactions
            )
        );

        setText(
            SELECTORS.failedTransactions,
            formatNumber(
                stats.failedTransactions
            )
        );
    }

    /* -----------------------------------------------------
     * Health
     * --------------------------------------------------- */

    function normalizeHealth(
        health
    ) {
        if (
            Array.isArray(health)
        ) {
            return health;
        }

        return Object.entries(
            health || {}
        ).map(
            ([name, value]) => {
                if (
                    typeof value ===
                    "string"
                ) {
                    return {
                        name,
                        status: value,
                    };
                }

                return {
                    name,
                    ...(value || {}),
                };
            }
        );
    }

    function healthClass(status) {
        const normalized =
            String(
                status || ""
            ).toLowerCase();

        if (
            [
                "ok",
                "healthy",
                "up",
                "online",
                "ready",
            ].includes(normalized)
        ) {
            return "badge badge-success";
        }

        if (
            [
                "warning",
                "degraded",
                "slow",
            ].includes(normalized)
        ) {
            return "badge badge-warning";
        }

        if (
            [
                "error",
                "failed",
                "down",
                "offline",
                "unhealthy",
            ].includes(normalized)
        ) {
            return "badge badge-danger";
        }

        return "badge badge-neutral";
    }

    function renderHealth(
        health
    ) {
        const container =
            query(
                SELECTORS.health
            );

        if (!container) {
            return;
        }

        const services =
            normalizeHealth(
                health
            );

        if (!services.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">
                        Health data unavailable
                    </div>
                    <div class="empty-state-description">
                        No service health information was returned by the API.
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML =
            services
                .map(
                    (service) => {
                        const name =
                            service.name ||
                            service.service ||
                            "Service";

                        const status =
                            service.status ||
                            "unknown";

                        const latency =
                            service.latencyMs ??
                            service.latency;

                        return `
                            <div class="health-card">
                                <div class="flex items-center justify-between gap-2">
                                    <h3 class="health-card-title">
                                        ${escapeHtml(name)}
                                    </h3>

                                    <span class="${healthClass(
                                        status
                                    )}">
                                        ${escapeHtml(
                                            status
                                        )}
                                    </span>
                                </div>

                                <div class="health-card-value">
                                    ${
                                        latency !==
                                        undefined
                                            ? `${formatNumber(
                                                  latency,
                                                  0
                                              )} ms`
                                            : escapeHtml(
                                                  service.message ||
                                                      "No additional information"
                                              )
                                    }
                                </div>
                            </div>
                        `;
                    }
                )
                .join("");
    }

    /* -----------------------------------------------------
     * Recent games
     * --------------------------------------------------- */

    function gameStatusClass(
        status
    ) {
        const value =
            String(
                status || ""
            ).toLowerCase();

        if (
            [
                "completed",
                "complete",
                "won",
                "success",
            ].includes(value)
        ) {
            return "badge badge-success";
        }

        if (
            [
                "pending",
                "running",
                "playing",
            ].includes(value)
        ) {
            return "badge badge-warning";
        }

        if (
            [
                "failed",
                "cancelled",
                "canceled",
                "error",
            ].includes(value)
        ) {
            return "badge badge-danger";
        }

        return "badge badge-neutral";
    }

    function renderGames(
        games
    ) {
        const container =
            query(
                SELECTORS.recentGames
            );

        if (!container) {
            return;
        }

        if (
            !Array.isArray(games) ||
            games.length === 0
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        ◇
                    </div>

                    <div class="empty-state-title">
                        No recent games
                    </div>

                    <div class="empty-state-description">
                        No game records are currently available.
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Game</th>
                            <th>Player</th>
                            <th>Bet</th>
                            <th>Result</th>
                            <th>Status</th>
                            <th>Time</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${games
                            .slice(0, 20)
                            .map(
                                (game) => {
                                    const id =
                                        game.id ??
                                        game.gameId ??
                                        "—";

                                    const player =
                                        game.playerUsername ??
                                        game.username ??
                                        game.playerId ??
                                        "—";

                                    const bet =
                                        game.bet ??
                                        game.betAmount ??
                                        0;

                                    const result =
                                        game.payout ??
                                        game.result ??
                                        game.winAmount ??
                                        0;

                                    const status =
                                        game.status ??
                                        "unknown";

                                    const time =
                                        game.createdAt ??
                                        game.created_at ??
                                        game.timestamp;

                                    return `
                                        <tr>
                                            <td>
                                                <span class="table-primary mono">
                                                    ${escapeHtml(
                                                        id
                                                    )}
                                                </span>
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    player
                                                )}
                                            </td>

                                            <td>
                                                ${formatPi(
                                                    bet
                                                )}
                                            </td>

                                            <td>
                                                ${formatPi(
                                                    result
                                                )}
                                            </td>

                                            <td>
                                                <span class="${gameStatusClass(
                                                    status
                                                )}">
                                                    ${escapeHtml(
                                                        status
                                                    )}
                                                </span>
                                            </td>

                                            <td class="table-muted">
                                                ${escapeHtml(
                                                    formatDate(
                                                        time
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    `;
                                }
                            )
                            .join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    /* -----------------------------------------------------
     * Recent transactions
     * --------------------------------------------------- */

    function transactionStatusClass(
        status
    ) {
        const value =
            String(
                status || ""
            ).toLowerCase();

        if (
            [
                "completed",
                "complete",
                "confirmed",
                "success",
                "successful",
            ].includes(value)
        ) {
            return "badge badge-success";
        }

        if (
            [
                "pending",
                "processing",
                "queued",
            ].includes(value)
        ) {
            return "badge badge-warning";
        }

        if (
            [
                "failed",
                "cancelled",
                "canceled",
                "rejected",
                "error",
            ].includes(value)
        ) {
            return "badge badge-danger";
        }

        return "badge badge-neutral";
    }

    function transactionTypeClass(
        type
    ) {
        const value =
            String(
                type || ""
            ).toLowerCase();

        if (
            [
                "deposit",
                "credit",
                "win",
            ].includes(value)
        ) {
            return "text-success";
        }

        if (
            [
                "withdrawal",
                "debit",
                "bet",
            ].includes(value)
        ) {
            return "text-warning";
        }

        return "text-secondary";
    }

    function renderTransactions(
        transactions
    ) {
        const container =
            query(
                SELECTORS.recentTransactions
            );

        if (!container) {
            return;
        }

        if (
            !Array.isArray(
                transactions
            ) ||
            transactions.length === 0
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        ◇
                    </div>

                    <div class="empty-state-title">
                        No recent transactions
                    </div>

                    <div class="empty-state-description">
                        No transaction records are currently available.
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Transaction</th>
                            <th>Player</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Time</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${transactions
                            .slice(0, 20)
                            .map(
                                (transaction) => {
                                    const id =
                                        transaction.id ??
                                        transaction.transactionId ??
                                        "—";

                                    const player =
                                        transaction.playerUsername ??
                                        transaction.username ??
                                        transaction.playerId ??
                                        "—";

                                    const type =
                                        transaction.type ??
                                        transaction.transactionType ??
                                        "unknown";

                                    const amount =
                                        transaction.amount ??
                                        0;

                                    const status =
                                        transaction.status ??
                                        "unknown";

                                    const time =
                                        transaction.createdAt ??
                                        transaction.created_at ??
                                        transaction.timestamp;

                                    return `
                                        <tr>
                                            <td>
                                                <span class="table-primary mono">
                                                    ${escapeHtml(
                                                        id
                                                    )}
                                                </span>
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    player
                                                )}
                                            </td>

                                            <td>
                                                <span class="${transactionTypeClass(
                                                    type
                                                )}">
                                                    ${escapeHtml(
                                                        type
                                                    )}
                                                </span>
                                            </td>

                                            <td>
                                                ${formatPi(
                                                    amount
                                                )}
                                            </td>

                                            <td>
                                                <span class="${transactionStatusClass(
                                                    status
                                                )}">
                                                    ${escapeHtml(
                                                        status
                                                    )}
                                                </span>
                                            </td>

                                            <td class="table-muted">
                                                ${escapeHtml(
                                                    formatDate(
                                                        time
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    `;
                                }
                            )
                            .join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    /* -----------------------------------------------------
     * Render
     * --------------------------------------------------- */

    function render(data) {
        state.data = data;

        renderStats(data);

        renderHealth(
            data.health
        );

        renderGames(
            data.recentGames
        );

        renderTransactions(
            data.recentTransactions
        );

        state.lastUpdated =
            new Date();

        setText(
            SELECTORS.lastUpdated,
            state.lastUpdated.toLocaleTimeString()
        );
    }

    /* -----------------------------------------------------
     * Load
     * --------------------------------------------------- */

    async function load(
        options = {}
    ) {
        if (
            state.loading &&
            !options.force
        ) {
            return;
        }

        state.refreshing =
            Boolean(
                options.refresh
            );

        hideError();

        setLoading(true);

        try {
            const response =
                await API.dashboard.overview();

            const data =
                normalizeDashboard(
                    response
                );

            render(data);

            window.dispatchEvent(
                new CustomEvent(
                    "plinko:dashboard-updated",
                    {
                        detail: data,
                    }
                )
            );
        } catch (error) {
            console.error(
                "[Plinko Admin] Dashboard load failed:",
                error
            );

            showError(error);
        } finally {
            state.refreshing =
                false;

            setLoading(false);
        }
    }

    /* -----------------------------------------------------
     * Auto refresh
     * --------------------------------------------------- */

    function startPolling(
        interval = 15000
    ) {
        stopPolling();

        state.timer =
            window.setInterval(
                () => {
                    if (
                        document.hidden
                    ) {
                        return;
                    }

                    load();
                },
                interval
            );
    }

    function stopPolling() {
        if (
            state.timer !== null
        ) {
            window.clearInterval(
                state.timer
            );

            state.timer = null;
        }
    }

    /* -----------------------------------------------------
     * Events
     * --------------------------------------------------- */

    function bindEvents() {
        const refresh =
            query(
                SELECTORS.refresh
            );

        if (refresh) {
            refresh.addEventListener(
                "click",
                () =>
                    load({
                        force: true,
                        refresh: true,
                    })
            );
        }

        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    document.hidden
                ) {
                    return;
                }

                load();
            }
        );

        window.addEventListener(
            "beforeunload",
            stopPolling
        );
    }

    /* -----------------------------------------------------
     * Public API
     * --------------------------------------------------- */

    window.PlinkoAdminDashboard =
        {
            state,

            load,

            refresh() {
                return load({
                    force: true,
                    refresh: true,
                });
            },

            startPolling,

            stopPolling,

            render,

            getState() {
                return {
                    ...state,
                };
            },
        };

    /* -----------------------------------------------------
     * Initialization
     * --------------------------------------------------- */

    function init() {
        bindEvents();

        load();

        const interval =
            Number(
                window
                    .PLINKO_ADMIN_CONFIG
                    ?.polling
                    ?.dashboard
            ) || 15000;

        startPolling(interval);
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true,
            }
        );
    } else {
        init();
    }
})(window, document);
async function fetchDashboard() {
  try {
    const res = await fetch("https://yourbackend.com/admin/metrics");
    const data = await res.json();

    document.getElementById("totalBets").innerText = data.totalBets;
    document.getElementById("totalWagered").innerText = data.totalWagered.toFixed(2);
    document.getElementById("totalPayouts").innerText = data.totalPayouts.toFixed(2);
    document.getElementById("totalProfit").innerText = data.profit.toFixed(2);

    // Recent Bets
    const betsTable = document.getElementById("recentBets");
    betsTable.innerHTML = "";
    data.recentBets.forEach(bet => {
      let row = `<tr>
        <td>${bet.user}</td>
        <td>${bet.betAmount}</td>
        <td>x${bet.multiplier}</td>
        <td>${bet.winnings.toFixed(2)}</td>
        <td>${new Date(bet.timestamp).toLocaleString()}</td>
      </tr>`;
      betsTable.innerHTML += row;
    });

    // Leaderboard
    const list = document.getElementById("leaderboardList");
    list.innerHTML = "";
    data.leaderboard.forEach(player => {
      let li = document.createElement("li");
      li.textContent = `${player._id} — ${player.totalWinnings.toFixed(2)} Pi`;
      list.appendChild(li);
    });

  } catch (err) {
    console.error("Dashboard fetch error:", err);
  }
}

// Refresh every 30s
fetchDashboard();
setInterval(fetchDashboard, 30000);}

// Refresh every 30s
fetchDashboard();
setInterval(fetchDashboard, 30000);
