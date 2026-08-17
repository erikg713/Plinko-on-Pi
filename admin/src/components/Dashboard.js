/*
 * Plinko-on-Pi Admin
 * admin/src/components/Dashboard.js
 */

import React, { useMemo } from "react";


/* =========================================================
   HELPERS
   ========================================================= */

function asNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (value && Array.isArray(value.data)) {
        return value.data;
    }

    if (value && Array.isArray(value.items)) {
        return value.items;
    }

    if (value && Array.isArray(value.results)) {
        return value.results;
    }

    return [];
}


function formatNumber(value, digits = 2) {
    return asNumber(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits: digits,
        }
    );
}


function formatPi(value) {
    return `${formatNumber(value, 4)} π`;
}


function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}


function normalizeStatus(value) {
    return String(value || "unknown")
        .trim()
        .toLowerCase();
}


function statusClass(value) {
    const status = normalizeStatus(value);

    if (
        [
            "online",
            "healthy",
            "active",
            "success",
            "successful",
            "completed",
            "complete",
            "confirmed",
        ].includes(status)
    ) {
        return "app-status-success";
    }

    if (
        [
            "pending",
            "processing",
            "queued",
            "warning",
            "degraded",
        ].includes(status)
    ) {
        return "app-status-warning";
    }

    if (
        [
            "offline",
            "error",
            "failed",
            "failure",
            "rejected",
            "disabled",
            "cancelled",
            "canceled",
        ].includes(status)
    ) {
        return "app-status-danger";
    }

    return "app-status-neutral";
}


function truncate(value, start = 8, end = 6) {
    if (!value) {
        return "—";
    }

    const text = String(value);

    if (text.length <= start + end + 1) {
        return text;
    }

    return `${text.slice(0, start)}…${text.slice(-end)}`;
}


/* =========================================================
   STAT CARD
   ========================================================= */

function StatCard({
    label,
    value,
    description,
    icon,
    trend,
}) {
    return (
        <article className="app-stat-card">

            <div className="app-stat-header">

                <span className="app-stat-label">
                    {label}
                </span>

                <span
                    className="app-stat-icon"
                    aria-hidden="true"
                >
                    {icon}
                </span>

            </div>


            <div className="app-stat-value">
                {value}
            </div>


            <div className="app-stat-description">
                {description}

                {trend !== undefined && (
                    <span
                        style={{
                            marginLeft: "7px",
                            color:
                                Number(trend) >= 0
                                    ? "var(--app-success)"
                                    : "var(--app-danger)",
                            fontWeight: 700,
                        }}
                    >
                        {Number(trend) >= 0
                            ? "↑"
                            : "↓"}{" "}
                        {Math.abs(Number(trend)).toFixed(2)}%
                    </span>
                )}
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
   RECENT GAMES
   ========================================================= */

function RecentGames({
    games,
    onViewAll,
}) {
    return (
        <Card
            title="Recent Games"
            description="Latest Plinko rounds"
            action={
                onViewAll && (
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onViewAll}
                    >
                        View all
                    </button>
                )
            }
        >

            <div className="app-table-wrapper">

                <table className="app-table">

                    <thead>
                        <tr>
                            <th>Game</th>
                            <th>Player</th>
                            <th>Wager</th>
                            <th>Multiplier</th>
                            <th>Payout</th>
                            <th>Status</th>
                        </tr>
                    </thead>


                    <tbody>

                        {games.length === 0 ? (

                            <tr>
                                <td
                                    colSpan="6"
                                    className="empty"
                                >
                                    No recent games.
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

                                        <td>
                                            <span className="app-mono">
                                                {
                                                    game.id ||
                                                    game.game_id ||
                                                    "—"
                                                }
                                            </span>
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
                                                game.wager ??
                                                game.bet_amount
                                            )}
                                        </td>


                                        <td>
                                            {game.multiplier !==
                                                undefined &&
                                            game.multiplier !==
                                                null
                                                ? `${game.multiplier}x`
                                                : "—"}
                                        </td>


                                        <td>
                                            {formatPi(
                                                game.payout
                                            )}
                                        </td>


                                        <td>

                                            <span
                                                className={
                                                    `app-status ${statusClass(
                                                        game.status
                                                    )}`
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
    );
}


/* =========================================================
   SERVICE STATUS
   ========================================================= */

function ServiceStatus({
    services,
}) {
    return (
        <Card
            title="System Status"
            description="Core Plinko-on-Pi services"
        >

            <div>

                {services.length === 0 ? (

                    <div className="app-alert app-alert-warning">
                        No service health data available.
                    </div>

                ) : (

                    services.map(
                        (service, index) => (
                            <div
                                key={
                                    service.id ||
                                    service.name ||
                                    index
                                }
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent:
                                        "space-between",
                                    gap: "12px",
                                    padding: "11px 0",
                                    borderBottom:
                                        index <
                                        services.length - 1
                                            ? "1px solid var(--app-border)"
                                            : "0",
                                }}
                            >

                                <div
                                    style={{
                                        minWidth: 0,
                                    }}
                                >

                                    <div
                                        style={{
                                            fontWeight: 650,
                                            fontSize: "13px",
                                        }}
                                    >
                                        {
                                            service.name ||
                                            "Service"
                                        }
                                    </div>

                                    {service.message && (
                                        <div
                                            style={{
                                                marginTop:
                                                    "3px",
                                                color:
                                                    "var(--app-text-muted)",
                                                fontSize:
                                                    "11px",
                                            }}
                                        >
                                            {
                                                service.message
                                            }
                                        </div>
                                    )}

                                </div>


                                <span
                                    className={
                                        `app-status ${statusClass(
                                            service.status
                                        )}`
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
    );
}


/* =========================================================
   RECENT EVENTS
   ========================================================= */

function RecentEvents({
    events,
    onViewAll,
}) {
    return (
        <Card
            title="Recent Events"
            description="Latest administrative and system events"
            action={
                onViewAll && (
                    <button
                        type="button"
                        className="app-button app-button-small"
                        onClick={onViewAll}
                    >
                        View logs
                    </button>
                )
            }
        >

            <div className="app-log-list">

                {events.length === 0 ? (

                    <div className="app-loading">
                        No recent events.
                    </div>

                ) : (

                    events.map(
                        (event, index) => (
                            <div
                                className="app-log-row"
                                key={
                                    event.id ||
                                    event.event_id ||
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
                                            `app-status ${statusClass(
                                                event.level ||
                                                event.status
                                            )}`
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
    );
}


/* =========================================================
   METRICS
   ========================================================= */

function MetricsCard({
    metrics,
}) {
    const rows = [
        {
            label: "Games today",
            value: formatNumber(
                metrics.gamesToday ??
                metrics.games_today
            ),
        },

        {
            label: "Wagered today",
            value: formatPi(
                metrics.wageredToday ??
                metrics.wagered_today
            ),
        },

        {
            label: "Payouts today",
            value: formatPi(
                metrics.payoutsToday ??
                metrics.payouts_today
            ),
        },

        {
            label: "Active players",
            value: formatNumber(
                metrics.activePlayers ??
                metrics.active_players
            ),
        },

        {
            label: "Pending transactions",
            value: formatNumber(
                metrics.pendingTransactions ??
                metrics.pending_transactions
            ),
        },

        {
            label: "Failed transactions",
            value: formatNumber(
                metrics.failedTransactions ??
                metrics.failed_transactions
            ),
        },
    ];

    return (
        <Card
            title="Operational Metrics"
            description="Current platform activity"
        >

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                    gap: "10px",
                }}
            >

                {rows.map((row) => (
                    <div
                        key={row.label}
                        style={{
                            padding: "12px",
                            background:
                                "var(--app-surface-soft)",
                            border:
                                "1px solid var(--app-border)",
                            borderRadius:
                                "var(--app-radius)",
                        }}
                    >

                        <div
                            style={{
                                color:
                                    "var(--app-text-muted)",
                                fontSize: "11px",
                                marginBottom: "5px",
                            }}
                        >
                            {row.label}
                        </div>

                        <div
                            className="app-number"
                            style={{
                                fontSize: "16px",
                                fontWeight: 750,
                            }}
                        >
                            {row.value}
                        </div>

                    </div>
                ))}

            </div>

        </Card>
    );
}


/* =========================================================
   QUICK ACTIONS
   ========================================================= */

function QuickActions({
    onNavigate,
}) {
    const actions = [
        {
            label: "View Games",
            page: "games",
            icon: "◆",
        },

        {
            label: "View Players",
            page: "players",
            icon: "●",
        },

        {
            label: "Transactions",
            page: "transactions",
            icon: "$",
        },

        {
            label: "System Health",
            page: "health",
            icon: "+",
        },
    ];

    return (
        <Card
            title="Quick Actions"
            description="Administration shortcuts"
        >

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                    gap: "10px",
                }}
            >

                {actions.map((action) => (
                    <button
                        type="button"
                        key={action.page}
                        className="app-button"
                        style={{
                            justifyContent:
                                "flex-start",
                            minHeight: "46px",
                        }}
                        onClick={() =>
                            onNavigate?.(
                                action.page
                            )
                        }
                    >

                        <span
                            className="app-nav-icon"
                            aria-hidden="true"
                        >
                            {action.icon}
                        </span>

                        {action.label}

                    </button>
                ))}

            </div>

        </Card>
    );
}


/* =========================================================
   MAIN DASHBOARD
   ========================================================= */

export default function Dashboard({
    data = {},
    loading = false,
    error = null,
    onRefresh,
    onNavigate,
}) {
    const stats =
        data.stats ||
        data.metrics ||
        {};

    const games = useMemo(
        () =>
            asArray(
                data.recentGames ||
                data.recent_games ||
                data.games
            ).slice(0, 10),
        [data]
    );

    const events = useMemo(
        () =>
            asArray(
                data.recentEvents ||
                data.recent_events ||
                data.events
            ).slice(0, 10),
        [data]
    );

    const services = useMemo(
        () =>
            asArray(
                data.services ||
                data.service_status ||
                data.health?.services
            ),
        [data]
    );

    const metrics =
        data.metrics ||
        data;


    const playerCount =
        stats.players ??
        stats.playerCount ??
        stats.player_count ??
        data.players_count ??
        data.player_count ??
        0;

    const gameCount =
        stats.games ??
        stats.gameCount ??
        stats.game_count ??
        data.games_count ??
        data.game_count ??
        0;

    const wagered =
        stats.wagered ??
        stats.totalWagered ??
        stats.total_wagered ??
        data.total_wagered ??
        0;

    const payouts =
        stats.payouts ??
        stats.totalPayouts ??
        stats.total_payouts ??
        data.total_payouts ??
        0;


    if (loading && !data) {
        return (
            <div className="app-page">
                <div className="app-loading">
                    <span className="app-spinner" />
                </div>
            </div>
        );
    }


    return (
        <div className="app-page">

            {error && (
                <div
                    className="app-alert app-alert-error"
                    role="alert"
                >
                    {error}
                </div>
            )}


            {/* =================================================
                TOP STATS
               ================================================= */}

            <div className="app-dashboard-grid">

                <StatCard
                    label="Players"
                    value={formatNumber(
                        playerCount
                    )}
                    description="Registered players"
                    icon="●"
                />


                <StatCard
                    label="Games"
                    value={formatNumber(
                        gameCount
                    )}
                    description="Total Plinko rounds"
                    icon="◆"
                />


                <StatCard
                    label="Wagered"
                    value={formatPi(
                        wagered
                    )}
                    description="Total wager volume"
                    icon="π"
                />


                <StatCard
                    label="Payouts"
                    value={formatPi(
                        payouts
                    )}
                    description="Total player payouts"
                    icon="↗"
                />

            </div>


            {/* =================================================
                PRIMARY DASHBOARD
               ================================================= */}

            <div className="app-card-grid">

                <RecentGames
                    games={games}
                    onViewAll={() =>
                        onNavigate?.(
                            "games"
                        )
                    }
                />


                <ServiceStatus
                    services={services}
                />

            </div>


            {/* =================================================
                OPERATIONAL METRICS
               ================================================= */}

            <div className="app-card-grid">

                <MetricsCard
                    metrics={metrics}
                />


                <QuickActions
                    onNavigate={
                        onNavigate
                    }
                />

            </div>


            {/* =================================================
                EVENTS
               ================================================= */}

            <RecentEvents
                events={events}
                onViewAll={() =>
                    onNavigate?.(
                        "logs"
                    )
                }
            />


            {/* =================================================
                REFRESH
               ================================================= */}

            {onRefresh && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: "16px",
                    }}
                >
                    <button
                        type="button"
                        className="app-button app-button-primary"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        {loading
                            ? "Refreshing..."
                            : "Refresh Dashboard"}
                    </button>
                </div>
            )}

        </div>
    );
      }
