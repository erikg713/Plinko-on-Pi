"use strict";

/**
 * Plinko-on-Pi Admin Dashboard
 *
 * Responsibilities:
 * - Fetch admin dashboard data
 * - Normalize backend response shapes
 * - Render statistics
 * - Render recent games
 * - Render players
 * - Render transactions
 * - Render health information
 * - Render event logs
 * - Provide safe HTML escaping
 *
 * Security:
 * - Never inject backend values directly into innerHTML.
 * - All dynamic values pass through escapeHTML().
 * - Authorization is handled by api.js.
 */

(() => {
    "use strict";

    const Dashboard = {

        state: {
            stats: null,

            players: [],
            playersMeta: null,

            games: [],
            gamesMeta: null,

            transactions: [],
            transactionsMeta: null,

            health: null,
            logs: [],

            loading: false,
            lastError: null
        },

        /**
         * Load the complete dashboard.
         */
        async loadAll() {

            if (this.state.loading) {
                return;
            }

            this.state.loading = true;
            this.state.lastError = null;

            this.showGlobalLoading();

            try {

                const results =
                    await Promise.allSettled([
                        this.loadStats(),
                        this.loadGames({
                            page: 1,
                            limit:
                                this.getPageSize()
                        }),
                        this.loadPlayers({
                            page: 1,
                            limit:
                                this.getPageSize()
                        }),
                        this.loadTransactions({
                            page: 1,
                            limit:
                                this.getPageSize()
                        }),
                        this.loadHealth(),
                        this.loadLogs({
                            page: 1,
                            limit:
                                this.getPageSize()
                        })
                    ]);

                const failed =
                    results.filter(
                        result =>
                            result.status ===
                            "rejected"
                    );

                if (failed.length) {

                    console.warn(
                        `[Dashboard] ${failed.length} request(s) failed`
                    );
                }

                this.dispatch(
                    "admin:dashboard-loaded",
                    {
                        failed:
                            failed.length
                    }
                );

            } finally {

                this.state.loading = false;

                this.hideGlobalLoading();
            }
        },

        /**
         * Dashboard statistics.
         */
        async loadStats() {

            try {

                const response =
                    await window.adminAPI.stats();

                this.state.stats =
                    this.normalizeObject(
                        response
                    );

                this.renderStats();

                return this.state.stats;

            } catch (error) {

                console.error(
                    "[Dashboard] Stats:",
                    error
                );

                this.renderStatsError(
                    error
                );

                throw error;
            }
        },

        /**
         * Players.
         */
        async loadPlayers(
            params = {}
        ) {

            try {

                const response =
                    await window.adminAPI.players(
                        params
                    );

                const normalized =
                    this.normalizeCollection(
                        response,
                        [
                            "players",
                            "users",
                            "results",
                            "items"
                        ]
                    );

                this.state.players =
                    normalized.items;

                this.state.playersMeta =
                    normalized.meta;

                this.renderPlayers();

                return normalized;

            } catch (error) {

                console.error(
                    "[Dashboard] Players:",
                    error
                );

                this.renderTableError(
                    "playersTable",
                    6,
                    error
                );

                throw error;
            }
        },

        /**
         * Games.
         */
        async loadGames(
            params = {}
        ) {

            try {

                const response =
                    await window.adminAPI.games(
                        params
                    );

                const normalized =
                    this.normalizeCollection(
                        response,
                        [
                            "games",
                            "rounds",
                            "results",
                            "items"
                        ]
                    );

                this.state.games =
                    normalized.items;

                this.state.gamesMeta =
                    normalized.meta;

                this.renderGames();
                this.renderRecentGames();

                return normalized;

            } catch (error) {

                console.error(
                    "[Dashboard] Games:",
                    error
                );

                this.renderTableError(
                    "gamesTable",
                    7,
                    error
                );

                this.renderRecentGamesError(
                    error
                );

                throw error;
            }
        },

        /**
         * Transactions.
         */
        async loadTransactions(
            params = {}
        ) {

            try {

                const response =
                    await window.adminAPI.transactions(
                        params
                    );

                const normalized =
                    this.normalizeCollection(
                        response,
                        [
                            "transactions",
                            "payments",
                            "results",
                            "items"
                        ]
                    );

                this.state.transactions =
                    normalized.items;

                this.state.transactionsMeta =
                    normalized.meta;

                this.renderTransactions();

                return normalized;

            } catch (error) {

                console.error(
                    "[Dashboard] Transactions:",
                    error
                );

                this.renderTableError(
                    "transactionsTable",
                    6,
                    error
                );

                throw error;
            }
        },

        /**
         * Health.
         */
        async loadHealth() {

            try {

                const response =
                    await window.adminAPI.health();

                this.state.health =
                    this.normalizeObject(
                        response
                    );

                this.renderHealth();
                this.renderSystemStatus();

                return this.state.health;

            } catch (error) {

                console.error(
                    "[Dashboard] Health:",
                    error
                );

                this.renderHealthError(
                    error
                );

                this.renderSystemStatusError(
                    error
                );

                throw error;
            }
        },

        /**
         * Logs.
         */
        async loadLogs(
            params = {}
        ) {

            try {

                const response =
                    await window.adminAPI.logs(
                        params
                    );

                const normalized =
                    this.normalizeCollection(
                        response,
                        [
                            "logs",
                            "events",
                            "results",
                            "items"
                        ]
                    );

                this.state.logs =
                    normalized.items;

                this.renderLogs();

                return normalized;

            } catch (error) {

                console.error(
                    "[Dashboard] Logs:",
                    error
                );

                this.renderLogsError(
                    error
                );

                throw error;
            }
        },

        /* =====================================================
           NORMALIZATION
           ===================================================== */

        normalizeObject(
            response
        ) {

            if (
                response &&
                typeof response ===
                    "object"
            ) {

                if (
                    response.data &&
                    typeof response.data ===
                        "object" &&
                    !Array.isArray(
                        response.data
                    )
                ) {
                    return response.data;
                }

                return response;
            }

            return {};
        },

        normalizeCollection(
            response,
            possibleKeys = []
        ) {

            let source =
                response;

            let meta = {};

            if (
                response &&
                typeof response ===
                    "object" &&
                !Array.isArray(response)
            ) {

                if (
                    response.meta &&
                    typeof response.meta ===
                        "object"
                ) {
                    meta =
                        response.meta;
                }

                if (
                    response.pagination &&
                    typeof response.pagination ===
                        "object"
                ) {
                    meta = {
                        ...meta,
                        ...response.pagination
                    };
                }

                if (
                    Array.isArray(
                        response.data
                    )
                ) {
                    return {
                        items:
                            response.data,
                        meta
                    };
                }

                for (
                    const key
                    of possibleKeys
                ) {

                    if (
                        Array.isArray(
                            response[key]
                        )
                    ) {

                        return {
                            items:
                                response[key],
                            meta
                        };
                    }
                }
            }

            if (
                Array.isArray(source)
            ) {
                return {
                    items: source,
                    meta
                };
            }

            return {
                items: [],
                meta
            };
        },

        /* =====================================================
           STATS
           ===================================================== */

        renderStats() {

            const stats =
                this.state.stats || {};

            const totalPlayers =
                this.firstDefined(
                    stats.total_players,
                    stats.players,
                    stats.player_count,
                    stats.users,
                    0
                );

            const totalGames =
                this.firstDefined(
                    stats.total_games,
                    stats.games,
                    stats.game_count,
                    stats.rounds,
                    0
                );

            const totalWagered =
                this.firstDefined(
                    stats.total_wagered,
                    stats.wagered,
                    stats.total_bets,
                    stats.total_volume,
                    0
                );

            const totalPayouts =
                this.firstDefined(
                    stats.total_payouts,
                    stats.payouts,
                    stats.total_winnings,
                    0
                );

            const houseProfit =
                this.firstDefined(
                    stats.house_profit,
                    stats.profit,
                    stats.net_profit,
                    null
                );

            this.setText(
                "statPlayers",
                this.formatNumber(
                    totalPlayers
                )
            );

            this.setText(
                "statGames",
                this.formatNumber(
                    totalGames
                )
            );

            this.setText(
                "statWagered",
                this.formatPi(
                    totalWagered
                )
            );

            this.setText(
                "statPayouts",
                this.formatPi(
                    totalPayouts
                )
            );

            /*
             * Optional statistic support.
             *
             * If a future index.html adds:
             *
             * <span id="statProfit"></span>
             *
             * it will automatically be populated.
             */
            const profitElement =
                document.getElementById(
                    "statProfit"
                );

            if (
                profitElement &&
                houseProfit !== null
            ) {
                profitElement.textContent =
                    this.formatPi(
                        houseProfit
                    );
            }
        },

        renderStatsError(
            error
        ) {

            const ids = [
                "statPlayers",
                "statGames",
                "statWagered",
                "statPayouts"
            ];

            ids.forEach(id => {

                this.setText(
                    id,
                    "—"
                );
            });

            console.warn(
                "[Dashboard] Unable to render stats:",
                error
            );
        },

        /* =====================================================
           PLAYERS
           ===================================================== */

        renderPlayers() {

            const tbody =
                document.getElementById(
                    "playersTable"
                );

            if (!tbody) {
                return;
            }

            const players =
                this.state.players;

            if (!players.length) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="6"
                            class="empty"
                        >
                            No players found
                        </td>
                    </tr>
                `;

                return;
            }

            tbody.innerHTML =
                players.map(
                    player =>
                        this.playerRow(
                            player
                        )
                ).join("");
        },

        playerRow(
            player
        ) {

            const id =
                this.firstDefined(
                    player.id,
                    player.player_id,
                    player.user_id,
                    "—"
                );

            const username =
                this.firstDefined(
                    player.username,
                    player.name,
                    player.display_name,
                    player.pi_username,
                    "Unknown"
                );

            const wallet =
                this.firstDefined(
                    player.wallet,
                    player.pi_wallet,
                    player.wallet_address,
                    "—"
                );

            const games =
                this.firstDefined(
                    player.games,
                    player.game_count,
                    player.total_games,
                    0
                );

            const balance =
                this.firstDefined(
                    player.balance,
                    player.pi_balance,
                    player.wallet_balance,
                    0
                );

            const status =
                this.firstDefined(
                    player.status,
                    player.state,
                    player.active === false
                        ? "inactive"
                        : "active"
                );

            return `
                <tr>
                    <td class="mono">
                        ${this.escapeHTML(id)}
                    </td>

                    <td>
                        ${this.escapeHTML(
                            username
                        )}
                    </td>

                    <td class="mono">
                        ${this.escapeHTML(
                            this.truncate(
                                wallet,
                                22
                            )
                        )}
                    </td>

                    <td>
                        ${this.formatNumber(
                            games
                        )}
                    </td>

                    <td>
                        ${this.formatPi(
                            balance
                        )}
                    </td>

                    <td>
                        ${this.statusBadge(
                            status
                        )}
                    </td>
                </tr>
            `;
        },

        /* =====================================================
           GAMES
           ===================================================== */

        renderGames() {

            const tbody =
                document.getElementById(
                    "gamesTable"
                );

            if (!tbody) {
                return;
            }

            const games =
                this.state.games;

            if (!games.length) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="7"
                            class="empty"
                        >
                            No games found
                        </td>
                    </tr>
                `;

                return;
            }

            tbody.innerHTML =
                games.map(
                    game =>
                        this.gameRow(
                            game
                        )
                ).join("");
        },

        gameRow(
            game
        ) {

            const id =
                this.firstDefined(
                    game.id,
                    game.round_id,
                    game.game_id,
                    "—"
                );

            const player =
                this.firstDefined(
                    game.username,
                    game.player,
                    game.player_name,
                    game.player_id,
                    "Unknown"
                );

            const wager =
                this.firstDefined(
                    game.wager,
                    game.bet,
                    game.bet_amount,
                    game.amount,
                    0
                );

            const multiplier =
                this.firstDefined(
                    game.multiplier,
                    game.payout_multiplier,
                    game.multiplier_value,
                    null
                );

            const payout =
                this.firstDefined(
                    game.payout,
                    game.win_amount,
                    game.winnings,
                    0
                );

            const status =
                this.firstDefined(
                    game.status,
                    game.state,
                    "completed"
                );

            const created =
                this.firstDefined(
                    game.created_at,
                    game.created,
                    game.timestamp,
                    game.started_at,
                    null
                );

            return `
                <tr>

                    <td class="mono">
                        ${this.escapeHTML(id)}
                    </td>

                    <td>
                        ${this.escapeHTML(
                            player
                        )}
                    </td>

                    <td>
                        ${this.formatPi(
                            wager
                        )}
                    </td>

                    <td>
                        ${this.formatMultiplier(
                            multiplier
                        )}
                    </td>

                    <td>
                        ${this.formatPi(
                            payout
                        )}
                    </td>

                    <td>
                        ${this.statusBadge(
                            status
                        )}
                    </td>

                    <td>
                        ${this.formatDate(
                            created
                        )}
                    </td>

                </tr>
            `;
        },

        renderRecentGames() {

            const tbody =
                document.getElementById(
                    "recentGames"
                );

            if (!tbody) {
                return;
            }

            const games =
                this.state.games
                    .slice(0, 8);

            if (!games.length) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="5"
                            class="empty"
                        >
                            No recent games
                        </td>
                    </tr>
                `;

                return;
            }

            tbody.innerHTML =
                games.map(
                    game => {

                        const id =
                            this.firstDefined(
                                game.id,
                                game.round_id,
                                game.game_id,
                                "—"
                            );

                        const player =
                            this.firstDefined(
                                game.username,
                                game.player,
                                game.player_name,
                                game.player_id,
                                "Unknown"
                            );

                        const wager =
                            this.firstDefined(
                                game.wager,
                                game.bet,
                                game.bet_amount,
                                game.amount,
                                0
                            );

                        const payout =
                            this.firstDefined(
                                game.payout,
                                game.win_amount,
                                game.winnings,
                                0
                            );

                        const status =
                            this.firstDefined(
                                game.status,
                                game.state,
                                "completed"
                            );

                        return `
                            <tr>

                                <td class="mono">
                                    ${this.escapeHTML(
                                        id
                                    )}
                                </td>

                                <td>
                                    ${this.escapeHTML(
                                        player
                                    )}
                                </td>

                                <td>
                                    ${this.formatPi(
                                        wager
                                    )}
                                </td>

                                <td>
                                    ${this.formatPi(
                                        payout
                                    )}
                                </td>

                                <td>
                                    ${this.statusBadge(
                                        status
                                    )}
                                </td>

                            </tr>
                        `;
                    }
                ).join("");
        },

        renderRecentGamesError(
            error
        ) {

            const tbody =
                document.getElementById(
                    "recentGames"
                );

            if (!tbody) {
                return;
            }

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="5"
                        class="error-cell"
                    >
                        Unable to load recent games.
                    </td>
                </tr>
            `;

            console.warn(
                "[Dashboard] Recent games:",
                error
            );
        },

        /* =====================================================
           TRANSACTIONS
           ===================================================== */

        renderTransactions() {

            const tbody =
                document.getElementById(
                    "transactionsTable"
                );

            if (!tbody) {
                return;
            }

            const transactions =
                this.state.transactions;

            if (!transactions.length) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="6"
                            class="empty"
                        >
                            No transactions found
                        </td>
                    </tr>
                `;

                return;
            }

            tbody.innerHTML =
                transactions.map(
                    transaction =>
                        this.transactionRow(
                            transaction
                        )
                ).join("");
        },

        transactionRow(
            transaction
        ) {

            const id =
                this.firstDefined(
                    transaction.id,
                    transaction.transaction_id,
                    transaction.txid,
                    "—"
                );

            const player =
                this.firstDefined(
                    transaction.username,
                    transaction.player,
                    transaction.player_name,
                    transaction.player_id,
                    "Unknown"
                );

            const type =
                this.firstDefined(
                    transaction.type,
                    transaction.transaction_type,
                    "unknown"
                );

            const amount =
                this.firstDefined(
                    transaction.amount,
                    transaction.value,
                    transaction.pi_amount,
                    0
                );

            const status =
                this.firstDefined(
                    transaction.status,
                    transaction.state,
                    "pending"
                );

            const created =
                this.firstDefined(
                    transaction.created_at,
                    transaction.created,
                    transaction.timestamp,
                    null
                );

            return `
                <tr>

                    <td class="mono">
                        ${this.escapeHTML(
                            id
                        )}
                    </td>

                    <td>
                        ${this.escapeHTML(
                            player
                        )}
                    </td>

                    <td>
                        ${this.escapeHTML(
                            this.prettyLabel(
                                type
                            )
                        )}
                    </td>

                    <td>
                        ${this.formatPi(
                            amount
                        )}
                    </td>

                    <td>
                        ${this.statusBadge(
                            status
                        )}
                    </td>

                    <td>
                        ${this.formatDate(
                            created
                        )}
                    </td>

                </tr>
            `;
        },

        /* =====================================================
           HEALTH
           ===================================================== */

        renderHealth() {

            const container =
                document.getElementById(
                    "healthCards"
                );

            if (!container) {
                return;
            }

            const services =
                this.extractServices(
                    this.state.health
                );

            if (!services.length) {

                container.innerHTML = `
                    <div class="loading-card">
                        No health information available.
                    </div>
                `;

                return;
            }

            container.innerHTML =
                services.map(
                    service =>
                        this.healthCard(
                            service
                        )
                ).join("");
        },

        extractServices(
            health
        ) {

            if (!health) {
                return [];
            }

            const source =
                health.services ??
                health.components ??
                health.checks ??
                health.data ??
                health;

            if (
                Array.isArray(source)
            ) {

                return source.map(
                    service => ({
                        name:
                            service.name ??
                            service.service ??
                            "Service",

                        status:
                            service.status ??
                            service.state ??
                            "unknown",

                        message:
                            service.message ??
                            service.description ??
                            "",

                        latency:
                            service.latency ??
                            null
                    })
                );
            }

            if (
                typeof source ===
                "object"
            ) {

                return Object.entries(
                    source
                ).map(
                    ([name, value]) => {

                        if (
                            value &&
                            typeof value ===
                            "object"
                        ) {

                            return {
                                name,

                                status:
                                    value.status ??
                                    value.state ??
                                    "unknown",

                                message:
                                    value.message ??
                                    value.description ??
                                    "",

                                latency:
                                    value.latency ??
                                    null
                            };
                        }

                        return {
                            name,

                            status:
                                value ??
                                "unknown",

                            message: "",

                            latency: null
                        };
                    }
                );
            }

            return [];
        },

        healthCard(
            service
        ) {

            return `
                <article class="health-card">

                    <div class="health-card-header">

                        <h3>
                            ${this.escapeHTML(
                                service.name
                            )}
                        </h3>

                        ${this.statusBadge(
                            service.status
                        )}

                    </div>

                    ${
                        service.message
                            ? `
                                <p>
                                    ${this.escapeHTML(
                                        service.message
                                    )}
                                </p>
                            `
                            : ""
                    }

                    ${
                        service.latency !== null
                            ? `
                                <small>
                                    Latency:
                                    ${this.escapeHTML(
                                        service.latency
                                    )}
                                </small>
                            `
                            : ""
                    }

                </article>
            `;
        },

        renderSystemStatus() {

            const container =
                document.getElementById(
                    "systemStatus"
                );

            if (!container) {
                return;
            }

            const services =
                this.extractServices(
                    this.state.health
                );

            const aliases = [
                {
                    label: "API",
                    matches: [
                        "api",
                        "backend",
                        "server"
                    ]
                },

                {
                    label: "Database",
                    matches: [
                        "database",
                        "db",
                        "postgres",
                        "supabase"
                    ]
                },

                {
                    label: "Game Engine",
                    matches: [
                        "game",
                        "engine",
                        "plinko"
                    ]
                },

                {
                    label: "Pi Network",
                    matches: [
                        "pi",
                        "pi network",
                        "blockchain"
                    ]
                }
            ];

            container.innerHTML =
                aliases.map(alias => {

                    const service =
                        services.find(
                            item => {

                                const name =
                                    String(
                                        item.name
                                    )
                                    .toLowerCase();

                                return alias.matches.some(
                                    match =>
                                        name.includes(
                                            match
                                        )
                                );
                            }
                        );

                    return `
                        <div class="health-row">

                            <span>
                                ${this.escapeHTML(
                                    alias.label
                                )}
                            </span>

                            ${
                                service
                                    ? this.statusBadge(
                                        service.status
                                    )
                                    : this.statusBadge(
                                        "unknown"
                                    )
                            }

                        </div>
                    `;
                }).join("");
        },

        renderHealthError(
            error
        ) {

            const container =
                document.getElementById(
                    "healthCards"
                );

            if (!container) {
                return;
            }

            container.innerHTML = `
                <div class="loading-card">
                    Unable to retrieve system health.
                </div>
            `;

            console.warn(
                "[Dashboard] Health:",
                error
            );
        },

        renderSystemStatusError(
            error
        ) {

            const container =
                document.getElementById(
                    "systemStatus"
                );

            if (!container) {
                return;
            }

            container.innerHTML =
                [
                    "API",
                    "Database",
                    "Game Engine",
                    "Pi Network"
                ]
                .map(
                    name => `
                        <div class="health-row">

                            <span>
                                ${this.escapeHTML(
                                    name
                                )}
                            </span>

                            ${this.statusBadge(
                                "unknown"
                            )}

                        </div>
                    `
                )
                .join("");

            console.warn(
                "[Dashboard] System status:",
                error
            );
        },

        /* =====================================================
           LOGS
           ===================================================== */

        renderLogs() {

            const container =
                document.getElementById(
                    "logsContainer"
                );

            if (!container) {
                return;
            }

            const logs =
                this.state.logs;

            if (!logs.length) {

                container.innerHTML =
                    `<div class="empty">
                        No events found.
                    </div>`;

                return;
            }

            container.innerHTML =
                logs.map(
                    log =>
                        this.logRow(
                            log
                        )
                ).join("");
        },

        logRow(
            log
        ) {

            const timestamp =
                this.firstDefined(
                    log.created_at,
                    log.timestamp,
                    log.created,
                    null
                );

            const level =
                this.firstDefined(
                    log.level,
                    log.severity,
                    log.status,
                    "info"
                );

            const message =
                this.firstDefined(
                    log.message,
                    log.event,
                    log.description,
                    "System event"
                );

            return `
                <div class="log-row">

                    <div class="log-time">
                        ${this.formatDate(
                            timestamp
                        )}
                    </div>

                    <div class="log-level">
                        ${this.statusBadge(
                            level
                        )}
                    </div>

                    <div class="log-message">
                        ${this.escapeHTML(
                            message
                        )}
                    </div>

                </div>
            `;
        },

        renderLogsError(
            error
        ) {

            const container =
                document.getElementById(
                    "logsContainer"
                );

            if (!container) {
                return;
            }

            container.innerHTML = `
                <div class="empty">
                    Unable to load event logs.
                </div>
            `;

            console.warn(
                "[Dashboard] Logs:",
                error
            );
        },

        /* =====================================================
           TABLE ERRORS
           ===================================================== */

        renderTableError(
            id,
            colspan,
            error
        ) {

            const tbody =
                document.getElementById(
                    id
                );

            if (!tbody) {
                return;
            }

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="${Number(
                            colspan
                        )}"
                        class="error-cell"
                    >
                        Unable to load data.
                    </td>
                </tr>
            `;

            console.warn(
                `[Dashboard] ${id}:`,
                error
            );
        },

        /* =====================================================
           LOADING
           ===================================================== */

        showGlobalLoading() {

            document.body.classList.add(
                "dashboard-loading"
            );
        },

        hideGlobalLoading() {

            document.body.classList.remove(
                "dashboard-loading"
            );
        },

        /* =====================================================
           HELPERS
           ===================================================== */

        getPageSize() {

            const config =
                window.PLINKO_ADMIN_CONFIG ||
                {};

            const size =
                Number(
                    config.DEFAULT_PAGE_SIZE ??
                    25
                );

            return Number.isFinite(size)
                ? Math.max(1, size)
                : 25;
        },

        firstDefined(
            ...values
        ) {

            for (
                const value
                of values
            ) {

                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {
                    return value;
                }
            }

            return null;
        },

        formatNumber(
            value
        ) {

            const number =
                Number(value);

            if (
                !Number.isFinite(
                    number
                )
            ) {
                return "0";
            }

            return new Intl.NumberFormat(
                "en-US"
            ).format(number);
        },

        formatPi(
            value
        ) {

            const number =
                Number(value);

            if (
                !Number.isFinite(
                    number
                )
            ) {
                return "0 π";
            }

            return `${number.toLocaleString(
                "en-US",
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 8
                }
            )} π`;
        },

        formatMultiplier(
            value
        ) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return "—";
            }

            const number =
                Number(value);

            if (
                !Number.isFinite(
                    number
                )
            ) {
                return this.escapeHTML(
                    value
                );
            }

            return `${number}×`;
        },

        formatDate(
            value
        ) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return "—";
            }

            const date =
                new Date(value);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return this.escapeHTML(
                    value
                );
            }

            return date.toLocaleString(
                "en-US",
                {
                    dateStyle: "short",
                    timeStyle: "short"
                }
            );
        },

        prettyLabel(
            value
        ) {

            return String(
                value ?? ""
            )
            .replaceAll(
                "_",
                " "
            )
            .replace(
                /\b\w/g,
                character =>
                    character.toUpperCase()
            );
        },

        truncate(
            value,
            length = 24
        ) {

            const text =
                String(
                    value ?? ""
                );

            if (
                text.length <= length
            ) {
                return text;
            }

            return (
                text.slice(
                    0,
                    Math.max(
                        1,
                        length - 3
                    )
                ) +
                "..."
            );
        },

        statusBadge(
            value
        ) {

            const raw =
                String(
                    value ??
                    "unknown"
                );

            const normalized =
                raw.toLowerCase();

            let className =
                "neutral";

            if (
                [
                    "active",
                    "completed",
                    "complete",
                    "success",
                    "successful",
                    "healthy",
                    "online",
                    "ok",
                    "approved",
                    "confirmed"
                ].includes(
                    normalized
                )
            ) {
                className =
                    "success";
            }

            if (
                [
                    "failed",
                    "failure",
                    "error",
                    "offline",
                    "critical",
                    "rejected",
                    "cancelled",
                    "canceled",
                    "inactive"
                ].includes(
                    normalized
                )
            ) {
                className =
                    "danger";
            }

            if (
                [
                    "pending",
                    "processing",
                    "warning",
                    "queued",
                    "waiting"
                ].includes(
                    normalized
                )
            ) {
                className =
                    "warning";
            }

            return `
                <span
                    class="status-badge ${className}"
                >
                    ${this.escapeHTML(
                        raw
                    )}
                </span>
            `;
        },

        /**
         * Prevent backend-controlled strings
         * from becoming executable HTML.
         */
        escapeHTML(
            value
        ) {

            return String(
                value ?? ""
            )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
        },

        setText(
            id,
            value
        ) {

            const element =
                typeof id ===
                "string"
                    ? document.getElementById(
                        id
                    )
                    : id;

            if (!element) {
                return;
            }

            element.textContent =
                String(
                    value ?? ""
                );
        },

        dispatch(
            eventName,
            detail = {}
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    eventName,
                    {
                        detail
                    }
                )
            );
        }
    };

    /*
     * Expose globally.
     */
    window.Dashboard =
        Dashboard;

})();
