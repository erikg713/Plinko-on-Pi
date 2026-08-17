/*
 * Plinko-on-Pi Admin
 * admin/src/App.js
 */

import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import "./App.css";


/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE =
    (
        process.env.REACT_APP_API_URL ||
        "/api"
    ).replace(/\/+$/, "");


const PAGE_META = {
    dashboard: {
        title: "Dashboard",
        description: "Plinko-on-Pi administration",
    },

    games: {
        title: "Games",
        description: "Review Plinko game rounds",
    },

    players: {
        title: "Players",
        description: "Registered Plinko-on-Pi players",
    },

    transactions: {
        title: "Transactions",
        description: "Pi payment and transaction activity",
    },

    health: {
        title: "System Health",
        description: "Plinko-on-Pi infrastructure status",
    },

    logs: {
        title: "Event Logs",
        description: "Administrative and system events",
    },
};


/* =========================================================
   API HELPER
   ========================================================= */

async function apiRequest(
    path,
    options = {}
) {
    const {
        method = "GET",
        body,
        headers = {},
        signal,
    } = options;

    const requestHeaders = {
        Accept: "application/json",
        ...headers,
    };

    if (body !== undefined) {
        requestHeaders["Content-Type"] =
            "application/json";
    }

    const response = await fetch(
        `${API_BASE}${path}`,
        {
            method,
            headers: requestHeaders,
            credentials: "include",
            body:
                body === undefined
                    ? undefined
                    : JSON.stringify(body),
            signal,
        }
    );

    const contentType =
        response.headers.get("content-type") || "";

    let payload = null;

    if (
        contentType.includes(
            "application/json"
        )
    ) {
        payload = await response.json();
    } else {
        const text =
            await response.text();

        payload = text
            ? { message: text }
            : null;
    }

    if (!response.ok) {
        const error =
            new Error(
                payload?.message ||
                payload?.error ||
                `Request failed (${response.status})`
            );

        error.status =
            response.status;

        error.payload =
            payload;

        throw error;
    }

    return payload;
}


/* =========================================================
   NORMALIZERS
   ========================================================= */

function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (
        value &&
        Array.isArray(value.data)
    ) {
        return value.data;
    }

    if (
        value &&
        Array.isArray(value.items)
    ) {
        return value.items;
    }

    if (
        value &&
        Array.isArray(value.results)
    ) {
        return value.results;
    }

    return [];
}


function asNumber(
    value,
    fallback = 0
) {
    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function formatNumber(
    value
) {
    return asNumber(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits: 4,
        }
    );
}


function formatPi(
    value
) {
    return `${formatNumber(value)} π`;
}


function formatDate(
    value
) {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString();
}


function getStatusClass(
    status
) {
    const normalized =
        String(status || "")
            .toLowerCase();

    if (
        [
            "active",
            "success",
            "successful",
            "completed",
            "complete",
            "online",
            "healthy",
            "confirmed",
        ].includes(normalized)
    ) {
        return "app-status-success";
    }

    if (
        [
            "pending",
            "processing",
            "warning",
            "degraded",
            "queued",
        ].includes(normalized)
    ) {
        return "app-status-warning";
    }

    if (
        [
            "failed",
            "failure",
            "error",
            "offline",
            "disabled",
            "cancelled",
            "canceled",
            "rejected",
        ].includes(normalized)
    ) {
        return "app-status-danger";
    }

    return "app-status-neutral";
}


/* =========================================================
   NAVIGATION
   ========================================================= */

const NAV_SECTIONS = [
    {
        title: "Main",
        items: [
            {
                id: "dashboard",
                label: "Dashboard",
                icon: "◈",
            },
        ],
    },

    {
        title: "Operations",
        items: [
            {
                id: "games",
                label: "Games",
                icon: "◆",
            },

            {
                id: "players",
                label: "Players",
                icon: "●",
            },

            {
                id: "transactions",
                label: "Transactions",
                icon: "$",
            },
        ],
    },

    {
        title: "System",
        items: [
            {
                id: "health",
                label: "System Health",
                icon: "+",
            },

            {
                id: "logs",
                label: "Event Logs",
                icon: "≡",
            },
        ],
    },
];


/* =========================================================
   SIDEBAR
   ========================================================= */

function Sidebar({
    page,
    onNavigate,
    open,
    onLogout,
}) {
    return (
        <aside
            className={
                `app-sidebar ${
                    open ? "open" : ""
                }`
            }
        >

            <div className="app-sidebar-header">

                <div className="app-logo">

                    <span className="app-logo-mark">
                        π
                    </span>

                    <span className="app-logo-text">
                        Plinko-on-Pi
                    </span>

                </div>

            </div>


            <nav className="app-nav">

                {NAV_SECTIONS.map(
                    (section) => (
                        <div
                            className="app-nav-section"
                            key={section.title}
                        >

                            <div className="app-nav-title">
                                {section.title}
                            </div>


                            {section.items.map(
                                (item) => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className={
                                            `app-nav-link ${
                                                page === item.id
                                                    ? "active"
                                                    : ""
                                            }`
                                        }
                                        onClick={() =>
                                            onNavigate(
                                                item.id
                                            )
                                        }
                                    >

                                        <span
                                            className="app-nav-icon"
                                            aria-hidden="true"
                                        >
                                            {item.icon}
                                        </span>

                                        <span>
                                            {item.label}
                                        </span>

                                    </button>
                                )
                            )}

                        </div>
                    )
                )}

            </nav>


            <div className="app-sidebar-footer">

                <button
                    type="button"
                    className="app-button app-button-danger"
                    style={{
                        width: "100%",
                    }}
                    onClick={onLogout}
                >
                    Logout
                </button>

            </div>

        </aside>
    );
}


/* =========================================================
   HEADER
   ========================================================= */

function Header({
    page,
    connection,
    onMenu,
    onRefresh,
}) {
    const meta =
        PAGE_META[page] ||
        PAGE_META.dashboard;

    return (
        <header className="app-header">

            <div className="app-header-left">

                <button
                    type="button"
                    className="app-menu-button"
                    onClick={onMenu}
                    aria-label="Open navigation"
                >
                    ☰
                </button>


                <div>

                    <h1 className="app-header-title">
                        {meta.title}
                    </h1>

                    <p className="app-header-subtitle">
                        {meta.description}
                    </p>

                </div>

            </div>


            <div className="app-header-right">

                <div className="app-connection">

                    <span
                        className={
                            `app-connection-dot ${
                                connection
                                    ? "online"
                                    : "offline"
                            }`
                        }
                    />

                    <span>
                        {connection
                            ? "Connected"
                            : "Offline"}
                    </span>

                </div>


                <button
                    type="button"
                    className="app-button"
                    onClick={onRefresh}
                >
                    Refresh
                </button>

            </div>

        </header>
    );
}


/* =========================================================
   STAT CARD
   ========================================================= */

function StatCard({
    label,
    value,
    description,
    icon,
}) {
    return (
        <article className="app-stat-card">

            <div className="app-stat-header">

                <span className="app-stat-label">
                    {label}
                </span>

                <span className="app-stat-icon">
                    {icon}
                </span>

            </div>


            <div className="app-stat-value">
                {value}
            </div>


            <div className="app-stat-description">
                {description}
            </div>

        </article>
    );
}


/* =========================================================
   CARD
   ========================================================= */

function Card({
    title,
    description,
    children,
    action,
}) {
    return (
        <section className="app-card">

            <header className="app-card-header">

                <div>

                    <h2 className="app-card-title">
                        {title}
                    </h2>

                    {description && (
                        <p className="app-card-description">
                            {description}
                        </p>
                    )}

                </div>

                {action}

            </header>


            <div className="app-card-body">
                {children}
            </div>

        </section>
    );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function Dashboard({
    dashboard,
    loading,
    onNavigate,
}) {
    const stats =
        dashboard?.stats || {};

    const games =
        asArray(
            dashboard?.recentGames
        );

    const events =
        asArray(
            dashboard?.recentEvents
        );

    const services =
        asArray(
            dashboard?.services
        );

    return (
        <div className="app-page">

            <div className="app-dashboard-grid">

                <StatCard
                    label="Players"
                    value={
                        loading
                            ? "..."
                            : formatNumber(
                                stats.players
                            )
                    }
                    description="Registered players"
                    icon="●"
                />


                <StatCard
                    label="Games"
                    value={
                        loading
                            ? "..."
                            : formatNumber(
                                stats.games
                            )
                    }
                    description="Total Plinko games"
                    icon="◆"
                />


                <StatCard
                    label="Wagered"
                    value={
                        loading
                            ? "..."
                            : formatPi(
                                stats.wagered
                            )
                    }
                    description="Total wager volume"
                    icon="π"
                />


                <StatCard
                    label="Payouts"
                    value={
                        loading
                            ? "..."
                            : formatPi(
                                stats.payouts
                            )
                    }
                    description="Total player payouts"
                    icon="↗"
                />

            </div>


            <div className="app-card-grid">

                <Card
                    title="Recent Games"
                    description="Latest Plinko activity"
                    action={
                        <button
                            type="button"
                            className="app-button app-button-small"
                            onClick={() =>
                                onNavigate(
                                    "games"
                                )
                            }
                        >
                            View all
                        </button>
                    }
                >

                    <div className="app-table-wrapper">

                        <table className="app-table">

                            <thead>

                                <tr>
                                    <th>Game</th>
                                    <th>Player</th>
                                    <th>Wager</th>
                                    <th>Payout</th>
                                    <th>Status</th>
                                </tr>

                            </thead>

                            <tbody>

                                {games.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="empty"
                                        >
                                            No games found.
                                        </td>
                                    </tr>
                                ) : (
                                    games.map(
                                        (game, index) => (
                                            <tr
                                                key={
                                                    game.id ||
                                                    game.game_id ||
                                                    index
                                                }
                                            >

                                                <td className="app-mono">
                                                    {
                                                        game.id ||
                                                        game.game_id ||
                                                        "—"
                                                    }
                                                </td>

                                                <td>
                                                    {
                                                        game.player_name ||
                                                        game.username ||
                                                        game.player ||
                                                        "—"
                                                    }
                                                </td>

                                                <td>
                                                    {formatPi(
                                                        game.wager
                                                    )}
                                                </td>

                                                <td>
                                                    {formatPi(
                                                        game.payout
                                                    )}
                                                </td>

                                                <td>

                                                    <span
                                                        className={
                                                            `app-status ${
                                                                getStatusClass(
                                                                    game.status
                                                                )
                                                            }`
                                                        }
                                                    >
                                                        {
                                                            game.status ||
                                                            "unknown"
                                                        }
                                                    </span>

                                                </td>

                                            </tr>
                                        )
                                    )
                                )}

                            </tbody>

                        </table>

                    </div>

                </Card>


                <Card
                    title="System Status"
                    description="Core service availability"
                >

                    <div>

                        {services.length === 0 ? (

                            <div className="app-loading">
                                <span>
                                    No service data available.
                                </span>
                            </div>

                        ) : (

                            services.map(
                                (
                                    service,
                                    index
                                ) => (
                                    <div
                                        key={
                                            service.name ||
                                            index
                                        }
                                        style={{
                                            display:
                                                "flex",
                                            justifyContent:
                                                "space-between",
                                            alignItems:
                                                "center",
                                            padding:
                                                "10px 0",
                                            borderBottom:
                                                "1px solid var(--app-border)",
                                        }}
                                    >

                                        <span>
                                            {
                                                service.name ||
                                                "Service"
                                            }
                                        </span>

                                        <span
                                            className={
                                                `app-status ${
                                                    getStatusClass(
                                                        service.status
                                                    )
                                                }`
                                            }
                                        >
                                            {
                                                service.status ||
                                                "unknown"
                                            }
                                        </span>

                                    </div>
                                )
                            )

                        )}

                    </div>

                </Card>

            </div>


            <Card
                title="Recent Events"
                description="Latest administrative events"
            >

                <div className="app-log-list">

                    {events.length === 0 ? (

                        <div className="app-loading">
                            No recent events.
                        </div>

                    ) : (

                        events.map(
                            (
                                event,
                                index
                            ) => (
                                <div
                                    className="app-log-row"
                                    key={
                                        event.id ||
                                        index
                                    }
                                >

                                    <span className="app-log-time">
                                        {formatDate(
                                            event.created_at ||
                                            event.timestamp
                                        )}
                                    </span>

                                    <span>
                                        <span
                                            className={
                                                `app-status ${
                                                    getStatusClass(
                                                        event.level ||
                                                        event.status
                                                    )
                                                }`
                                            }
                                        >
                                            {
                                                event.level ||
                                                event.status ||
                                                "INFO"
                                            }
                                        </span>
                                    </span>

                                    <span className="app-log-message">
                                        {
                                            event.message ||
                                            event.description ||
                                            "—"
                                        }
                                    </span>

                                </div>
                            )
                        )

                    )}

                </div>

            </Card>

        </div>
    );
}


/* =========================================================
   GENERIC DATA TABLE
   ========================================================= */

function DataTable({
    columns,
    rows,
    emptyMessage = "No records found.",
}) {
    return (
        <div className="app-table-wrapper">

            <table className="app-table">

                <thead>

                    <tr>

                        {columns.map(
                            (column) => (
                                <th
                                    key={
                                        column.key
                                    }
                                >
                                    {
                                        column.label
                                    }
                                </th>
                            )
                        )}

                    </tr>

                </thead>


                <tbody>

                    {rows.length === 0 ? (

                        <tr>

                            <td
                                colSpan={
                                    columns.length
                                }
                                className="empty"
                            >
                                {emptyMessage}
                            </td>

                        </tr>

                    ) : (

                        rows.map(
                            (row, index) => (
                                <tr
                                    key={
                                        row.id ||
                                        row.game_id ||
                                        row.transaction_id ||
                                        index
                                    }
                                >

                                    {columns.map(
                                        (column) => (
                                            <td
                                                key={
                                                    column.key
                                                }
                                            >
                                                {column.render
                                                    ? column.render(
                                                        row
                                                    )
                                                    : row[
                                                        column.key
                                                    ] ?? "—"}
                                            </td>
                                        )
                                    )}

                                </tr>
                            )
                        )

                    )}

                </tbody>

            </table>

        </div>
    );
}


/* =========================================================
   SEARCH INPUT
   ========================================================= */

function SearchInput({
    value,
    onChange,
    placeholder,
}) {
    return (
        <div className="app-search">

            <span
                className="app-search-icon"
                aria-hidden="true"
            >
                ⌕
            </span>

            <input
                className="app-input"
                type="search"
                value={value}
                onChange={(event) =>
                    onChange(
                        event.target.value
                    )
                }
                placeholder={
                    placeholder ||
                    "Search..."
                }
            />

        </div>
    );
}


/* =========================================================
   GAMES PAGE
   ========================================================= */

function GamesPage({
    games,
    loading,
    onRefresh,
}) {
    const [
        search,
        setSearch,
    ] = useState("");

    const filtered =
        useMemo(() => {
            const query =
                search
                    .trim()
                    .toLowerCase();

            if (!query) {
                return games;
            }

            return games.filter(
                (game) =>
                    JSON.stringify(
                        game
                    )
                        .toLowerCase()
                        .includes(query)
            );
        }, [
            games,
            search,
        ]);

    const columns = [
        {
            key: "id",
            label: "Game",
            render: (row) => (
                <span className="app-mono">
                    {
                        row.id ||
                        row.game_id ||
                        "—"
                    }
                </span>
            ),
        },

        {
            key: "player",
            label: "Player",
            render: (row) =>
                row.player_name ||
                row.username ||
                row.player ||
                "—",
        },

        {
            key: "wager",
            label: "Wager",
            render: (row) =>
                formatPi(
                    row.wager
                ),
        },

        {
            key: "multiplier",
            label: "Multiplier",
            render: (row) =>
                row.multiplier != null
                    ? `${row.multiplier}x`
                    : "—",
        },

        {
            key: "payout",
            label: "Payout",
            render: (row) =>
                formatPi(
                    row.payout
                ),
        },

        {
            key: "status",
            label: "Status",
            render: (row) => (
                <span
                    className={
                        `app-status ${
                            getStatusClass(
                                row.status
                            )
                        }`
                    }
                >
                    {
                        row.status ||
                        "unknown"
                    }
                </span>
            ),
        },

        {
            key: "created_at",
            label: "Created",
            render: (row) =>
                formatDate(
                    row.created_at ||
                    row.timestamp
                ),
        },
    ];

    return (
        <div className="app-page">

            <Card
                title="Games"
                description="Review Plinko game rounds"
                action={
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onRefresh}
                    >
                        Refresh
                    </button>
                }
            >

                <div className="app-toolbar">

                    <div className="app-toolbar-left">

                        <SearchInput
                            value={search}
                            onChange={
                                setSearch
                            }
                            placeholder="Search games..."
                        />

                    </div>

                </div>


                {loading ? (
                    <div className="app-loading">
                        Loading games...
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        rows={filtered}
                        emptyMessage="No games found."
                    />
                )}

            </Card>

        </div>
    );
}


/* =========================================================
   PLAYERS PAGE
   ========================================================= */

function PlayersPage({
    players,
    loading,
    onRefresh,
}) {
    const [
        search,
        setSearch,
    ] = useState("");

    const filtered =
        useMemo(() => {
            const query =
                search
                    .trim()
                    .toLowerCase();

            if (!query) {
                return players;
            }

            return players.filter(
                (player) =>
                    JSON.stringify(
                        player
                    )
                        .toLowerCase()
                        .includes(query)
            );
        }, [
            players,
            search,
        ]);

    const columns = [
        {
            key: "id",
            label: "ID",
            render: (row) => (
                <span className="app-mono">
                    {row.id || "—"}
                </span>
            ),
        },

        {
            key: "player",
            label: "Player",
            render: (row) =>
                row.username ||
                row.name ||
                row.player ||
                "—",
        },

        {
            key: "wallet",
            label: "Wallet",
            render: (row) => (
                <span
                    className="app-mono"
                    title={
                        row.wallet_address ||
                        row.wallet ||
                        ""
                    }
                >
                    {truncate(
                        row.wallet_address ||
                        row.wallet
                    )}
                </span>
            ),
        },

        {
            key: "games",
            label: "Games",
            render: (row) =>
                formatNumber(
                    row.games_count ??
                    row.games
                ),
        },

        {
            key: "balance",
            label: "Balance",
            render: (row) =>
                formatPi(
                    row.balance
                ),
        },

        {
            key: "status",
            label: "Status",
            render: (row) => (
                <span
                    className={
                        `app-status ${
                            getStatusClass(
                                row.status
                            )
                        }`
                    }
                >
                    {
                        row.status ||
                        "active"
                    }
                </span>
            ),
        },
    ];

    return (
        <div className="app-page">

            <Card
                title="Players"
                description="Registered Plinko-on-Pi players"
                action={
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onRefresh}
                    >
                        Refresh
                    </button>
                }
            >

                <div className="app-toolbar">

                    <SearchInput
                        value={search}
                        onChange={
                            setSearch
                        }
                        placeholder="Search players..."
                    />

                </div>


                {loading ? (
                    <div className="app-loading">
                        Loading players...
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        rows={filtered}
                        emptyMessage="No players found."
                    />
                )}

            </Card>

        </div>
    );
}


/* =========================================================
   TRANSACTIONS PAGE
   ========================================================= */

function TransactionsPage({
    transactions,
    loading,
    onRefresh,
}) {
    const [
        search,
        setSearch,
    ] = useState("");

    const filtered =
        useMemo(() => {
            const query =
                search
                    .trim()
                    .toLowerCase();

            if (!query) {
                return transactions;
            }

            return transactions.filter(
                (transaction) =>
                    JSON.stringify(
                        transaction
                    )
                        .toLowerCase()
                        .includes(query)
            );
        }, [
            transactions,
            search,
        ]);

    const columns = [
        {
            key: "id",
            label: "Transaction",
            render: (row) => (
                <span className="app-mono">
                    {
                        row.id ||
                        row.transaction_id ||
                        "—"
                    }
                </span>
            ),
        },

        {
            key: "player",
            label: "Player",
            render: (row) =>
                row.player_name ||
                row.username ||
                row.player ||
                "—",
        },

        {
            key: "type",
            label: "Type",
            render: (row) =>
                row.type ||
                row.transaction_type ||
                "—",
        },

        {
            key: "amount",
            label: "Amount",
            render: (row) =>
                formatPi(
                    row.amount
                ),
        },

        {
            key: "status",
            label: "Status",
            render: (row) => (
                <span
                    className={
                        `app-status ${
                            getStatusClass(
                                row.status
                            )
                        }`
                    }
                >
                    {
                        row.status ||
                        "unknown"
                    }
                </span>
            ),
        },

        {
            key: "created_at",
            label: "Created",
            render: (row) =>
                formatDate(
                    row.created_at ||
                    row.timestamp
                ),
        },
    ];

    return (
        <div className="app-page">

            <Card
                title="Transactions"
                description="Pi payment and transaction activity"
                action={
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onRefresh}
                    >
                        Refresh
                    </button>
                }
            >

                <div className="app-toolbar">

                    <SearchInput
                        value={search}
                        onChange={
                            setSearch
                        }
                        placeholder="Search transactions..."
                    />

                </div>


                {loading ? (
                    <div className="app-loading">
                        Loading transactions...
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        rows={filtered}
                        emptyMessage="No transactions found."
                    />
                )}

            </Card>

        </div>
    );
}


/* =========================================================
   HEALTH PAGE
   ========================================================= */

function HealthPage({
    health,
    loading,
    onRefresh,
}) {
    const services =
        asArray(
            health?.services ||
            health
        );

    return (
        <div className="app-page">

            <Card
                title="System Health"
                description="Plinko-on-Pi infrastructure status"
                action={
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onRefresh}
                    >
                        Refresh
                    </button>
                }
            >

                {loading ? (

                    <div className="app-loading">
                        Loading system health...
                    </div>

                ) : (

                    <div className="app-health-grid">

                        {services.length === 0 ? (

                            <div className="app-alert app-alert-warning">
                                No health information was returned by the API.
                            </div>

                        ) : (

                            services.map(
                                (
                                    service,
                                    index
                                ) => (
                                    <div
                                        className="app-health-card"
                                        key={
                                            service.name ||
                                            index
                                        }
                                    >

                                        <div className="app-health-card-header">

                                            <h3 className="app-health-card-title">
                                                {
                                                    service.name ||
                                                    "Service"
                                                }
                                            </h3>

                                            <span
                                                className={
                                                    `app-status ${
                                                        getStatusClass(
                                                            service.status
                                                        )
                                                    }`
                                                }
                                            >
                                                {
                                                    service.status ||
                                                    "unknown"
                                                }
                                            </span>

                                        </div>

                                        <p className="app-health-card-description">
                                            {
                                                service.message ||
                                                service.description ||
                                                "No additional information."
                                            }
                                        </p>

                                    </div>
                                )
                            )

                        )}

                    </div>

                )}

            </Card>

        </div>
    );
}


/* =========================================================
   LOGS PAGE
   ========================================================= */

function LogsPage({
    logs,
    loading,
    onRefresh,
}) {
    return (
        <div className="app-page">

            <Card
                title="Event Logs"
                description="Administrative and system events"
                action={
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onRefresh}
                    >
                        Refresh
                    </button>
                }
            >

                {loading ? (

                    <div className="app-loading">
                        Loading events...
                    </div>

                ) : (

                    <div className="app-log-list">

                        {logs.length === 0 ? (

                            <div className="app-loading">
                                No events found.
                            </div>

                        ) : (

                            logs.map(
                                (
                                    log,
                                    index
                                ) => (
                                    <div
                                        className="app-log-row"
                                        key={
                                            log.id ||
                                            index
                                        }
                                    >

                                        <span className="app-log-time">
                                            {formatDate(
                                                log.created_at ||
                                                log.timestamp
                                            )}
                                        </span>

                                        <span>

                                            <span
                                                className={
                                                    `app-status ${
                                                        getStatusClass(
                                                            log.level ||
                                                            log.status
                                                        )
                                                    }`
                                                }
                                            >
                                                {
                                                    log.level ||
                                                    log.status ||
                                                    "INFO"
                                                }
                                            </span>

                                        </span>

                                        <span className="app-log-message">
                                            {
                                                log.message ||
                                                log.description ||
                                                "—"
                                            }
                                        </span>

                                    </div>
                                )
                            )

                        )}

                    </div>

                )}

            </Card>

        </div>
    );
}


/* =========================================================
   HELPERS
   ========================================================= */

function truncate(
    value,
    length = 18
) {
    if (!value) {
        return "—";
    }

    const text =
        String(value);

    if (
        text.length <= length
    ) {
        return text;
    }

    return `${text.slice(
        0,
        8
    )}…${text.slice(-6)}`;
}


/* =========================================================
   APP
   ========================================================= */

export default function App() {
    const [
        page,
        setPage,
    ] = useState(() =>
        getInitialPage()
    );

    const [
        sidebarOpen,
        setSidebarOpen,
    ] = useState(false);

    const [
        connection,
        setConnection,
    ] = useState(false);

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    const [
        dashboard,
        setDashboard,
    ] = useState(null);

    const [
        games,
        setGames,
    ] = useState([]);

    const [
        players,
        setPlayers,
    ] = useState([]);

    const [
        transactions,
        setTransactions,
    ] = useState([]);

    const [
        health,
        setHealth,
    ] = useState(null);

    const [
        logs,
        setLogs,
    ] = useState([]);


    /* =====================================================
       NAVIGATION
       ===================================================== */

    const navigate = useCallback(
        (nextPage) => {
            if (
                !PAGE_META[nextPage]
            ) {
                nextPage =
                    "dashboard";
            }

            setPage(nextPage);

            window.history.replaceState(
                null,
                "",
                `#${nextPage}`
            );

            setSidebarOpen(false);
        },
        []
    );


    /* =====================================================
       LOAD DASHBOARD
       ===================================================== */

    const loadDashboard =
        useCallback(
            async (
                signal
            ) => {
                try {
                    const result =
                        await apiRequest(
                            "/admin/dashboard",
                            { signal }
                        );

                    setDashboard(
                        result?.data ||
                        result
                    );

                    setConnection(
                        true
                    );

                    return result;
                } catch (requestError) {

                    if (
                        requestError.name ===
                        "AbortError"
                    ) {
                        return null;
                    }

                    throw requestError;
                }
            },
            []
        );


    /* =====================================================
       LOAD GAMES
       ===================================================== */

    const loadGames =
        useCallback(
            async (
                signal
            ) => {
                const result =
                    await apiRequest(
                        "/admin/games",
                        { signal }
                    );

                setGames(
                    asArray(
                        result?.data ||
                        result
                    )
                );

                setConnection(
                    true
                );
            },
            []
        );


    /* =====================================================
       LOAD PLAYERS
       ===================================================== */

    const loadPlayers =
        useCallback(
            async (
                signal
            ) => {
                const result =
                    await apiRequest(
                        "/admin/players",
                        { signal }
                    );

                setPlayers(
                    asArray(
                        result?.data ||
                        result
                    )
                );

                setConnection(
                    true
                );
            },
            []
        );


    /* =====================================================
       LOAD TRANSACTIONS
       ===================================================== */

    const loadTransactions =
        useCallback(
            async (
                signal
            ) => {
                const result =
                    await apiRequest(
                        "/admin/transactions",
                        { signal }
                    );

                setTransactions(
                    asArray(
                        result?.data ||
                        result
                    )
                );

                setConnection(
                    true
                );
            },
            []
        );


    /* =====================================================
       LOAD HEALTH
       ===================================================== */

    const loadHealth =
        useCallback(
            async (
                signal
            ) => {
                const result =
                    await apiRequest(
                        "/admin/health",
                        { signal }
                    );

                setHealth(
                    result?.data ||
                    result
                );

                setConnection(
                    true
                );
            },
            []
        );


    /* =====================================================
       LOAD LOGS
       ===================================================== */

    const loadLogs =
        useCallback(
            async (
                signal
            ) => {
                const result =
                    await apiRequest(
                        "/admin/logs",
                        { signal }
                    );

                setLogs(
                    asArray(
                        result?.data ||
                        result
                    )
                );

                setConnection(
                    true
                );
            },
            []
        );


    /* =====================================================
       REFRESH CURRENT PAGE
       ===================================================== */

    const refresh =
        useCallback(
            async () => {
                const controller =
                    new AbortController();

                setLoading(true);
                setError(null);

                try {
                    switch (page) {

                        case "games":
                            await loadGames(
                                controller.signal
                            );
                            break;

                        case "players":
                            await loadPlayers(
                                controller.signal
                            );
                            break;

                        case "transactions":
                            await loadTransactions(
                                controller.signal
                            );
                            break;

                        case "health":
                            await loadHealth(
                                controller.signal
                            );
                            break;

                        case "logs":
                            await loadLogs(
                                controller.signal
                            );
                            break;

                        case "dashboard":
                        default:
                            await loadDashboard(
                                controller.signal
                            );

                            /*
                             * Dashboard can also show
                             * recent events and service
                             * information returned by
                             * the dashboard endpoint.
                             */
                            break;
                    }

                } catch (requestError) {

                    if (
                        requestError.name ===
                        "AbortError"
                    ) {
                        return;
                    }

                    setConnection(
                        false
                    );

                    setError(
                        requestError.message ||
                        "Unable to load admin data."
                    );

                } finally {
                    setLoading(false);
                }
            },
            [
                page,
                loadDashboard,
                loadGames,
                loadPlayers,
                loadTransactions,
                loadHealth,
                loadLogs,
            ]
        );


    /* =====================================================
       INITIAL LOAD
       ===================================================== */

    useEffect(
        () => {
            refresh();

            return undefined;
        },
        [refresh]
    );


    /* =====================================================
       HASH NAVIGATION
       ===================================================== */

    useEffect(
        () => {
            const handleHashChange =
                () => {
                    const next =
                        window.location.hash
                            .replace(
                                "#",
                                ""
                            );

                    if (
                        PAGE_META[next]
                    ) {
                        setPage(
                            next
                        );
                    }
                };

            window.addEventListener(
                "hashchange",
                handleHashChange
            );

            return () =>
                window.removeEventListener(
                    "hashchange",
                    handleHashChange
                );
        },
        []
    );


    /* =====================================================
       LOGOUT
       ===================================================== */

    const logout =
        useCallback(
            async () => {
                try {
                    await apiRequest(
                        "/admin/logout",
                        {
                            method: "POST",
                        }
                    );
                } catch {
                    /*
                     * Continue to login even if
                     * the server-side session has
                     * already expired.
                     */
                } finally {
                    window.location.href =
                        "/admin/login";
                }
            },
            []
        );


    /* =====================================================
       RENDER PAGE
       ===================================================== */

    const renderPage =
        () => {
            switch (page) {

                case "games":
                    return (
                        <GamesPage
                            games={games}
                            loading={loading}
                            onRefresh={
                                refresh
                            }
                        />
                    );

                case "players":
                    return (
                        <PlayersPage
                            players={players}
                            loading={loading}
                            onRefresh={
                                refresh
                            }
                        />
                    );

                case "transactions":
                    return (
                        <TransactionsPage
                            transactions={
                                transactions
                            }
                            loading={loading}
                            onRefresh={
                                refresh
                            }
                        />
                    );

                case "health":
                    return (
                        <HealthPage
                            health={health}
                            loading={loading}
                            onRefresh={
                                refresh
                            }
                        />
                    );

                case "logs":
                    return (
                        <LogsPage
                            logs={logs}
                            loading={loading}
                            onRefresh={
                                refresh
                            }
                        />
                    );

                case "dashboard":
                default:
                    return (
                        <Dashboard
                            dashboard={
                                dashboard
                            }
                            loading={loading}
                            onNavigate={
                                navigate
                            }
                        />
                    );
            }
        };


    return (
        <div className="app">

            <div className="app-shell">

                <Sidebar
                    page={page}
                    onNavigate={navigate}
                    open={sidebarOpen}
                    onLogout={logout}
                />


                <div
                    className={
                        `app-sidebar-overlay ${
                            sidebarOpen
                                ? "visible"
                                : ""
                        }`
                    }
                    onClick={() =>
                        setSidebarOpen(
                            false
                        )
                    }
                    aria-hidden="true"
                />


                <main className="app-main">

                    <Header
                        page={page}
                        connection={
                            connection
                        }
                        onMenu={() =>
                            setSidebarOpen(
                                true
                            )
                        }
                        onRefresh={
                            refresh
                        }
                    />


                    <div className="app-content">

                        {error && (
                            <div
                                className="app-alert app-alert-error"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        {renderPage()}

                    </div>

                </main>

            </div>

        </div>
    );
}


/* =========================================================
   INITIAL PAGE
   ========================================================= */

function getInitialPage() {
    const hash =
        window.location.hash
            .replace(
                "#",
                ""
            );

    return PAGE_META[hash]
        ? hash
        : "dashboard";
}
