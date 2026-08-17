import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import Loading from "./Loading";
import ErrorState from "./ErrorState";
import StatCard from "./StatCard";

const API_BASE = (
    process.env.REACT_APP_API_URL ||
    "/api"
).replace(/\/+$/, "");

async function request(path, options = {}) {
    const response = await fetch(
        `${API_BASE}${path}`,
        {
            credentials: "include",
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? {
                          "Content-Type":
                              "application/json",
                      }
                    : {}),
            },
            ...options,
        }
    );

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    const payload = contentType.includes(
        "application/json"
    )
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(
            payload?.message ||
                payload?.error ||
                "Health request failed"
        );
    }

    return payload?.data ?? payload;
}

function statusClass(status) {
    const value = String(
        status || ""
    ).toLowerCase();

    if (
        [
            "healthy",
            "ok",
            "online",
            "operational",
            "connected",
        ].includes(value)
    ) {
        return "app-status app-status-success";
    }

    if (
        [
            "warning",
            "degraded",
            "slow",
        ].includes(value)
    ) {
        return "app-status app-status-warning";
    }

    if (
        [
            "error",
            "failed",
            "offline",
            "down",
        ].includes(value)
    ) {
        return "app-status app-status-danger";
    }

    return "app-status app-status-neutral";
}

function formatBytes(value) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes)) {
        return "—";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 ** 2) {
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    if (bytes < 1024 ** 3) {
        return `${(
            bytes /
            1024 ** 2
        ).toFixed(1)} MB`;
    }

    return `${(
        bytes /
        1024 ** 3
    ).toFixed(2)} GB`;
}

function formatUptime(seconds) {
    const value = Number(seconds);

    if (!Number.isFinite(value)) {
        return "—";
    }

    const days = Math.floor(
        value / 86400
    );

    const hours = Math.floor(
        (value % 86400) / 3600
    );

    const minutes = Math.floor(
        (value % 3600) / 60
    );

    return [
        days ? `${days}d` : null,
        hours ? `${hours}h` : null,
        minutes ? `${minutes}m` : null,
    ]
        .filter(Boolean)
        .join(" ") || "<1m";
}

export default function SystemHealth() {
    const [health, setHealth] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);

    const [lastUpdated, setLastUpdated] =
        useState(null);

    const loadHealth = useCallback(
        async (signal) => {
            setLoading(true);
            setError(null);

            try {
                const data =
                    await request(
                        "/admin/health",
                        { signal }
                    );

                setHealth(data);
                setLastUpdated(
                    new Date()
                );
            } catch (err) {
                if (
                    err.name !==
                    "AbortError"
                ) {
                    setError(
                        err.message
                    );
                }
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        const controller =
            new AbortController();

        loadHealth(
            controller.signal
        );

        return () =>
            controller.abort();
    }, [loadHealth]);

    const services = useMemo(() => {
        if (
            Array.isArray(
                health?.services
            )
        ) {
            return health.services;
        }

        if (
            health?.services &&
            typeof health.services ===
                "object"
        ) {
            return Object.entries(
                health.services
            ).map(
                ([name, service]) => ({
                    name,
                    ...(typeof service ===
                    "object"
                        ? service
                        : {
                              status: service,
                          }),
                })
            );
        }

        return [];
    }, [health]);

    if (loading && !health) {
        return (
            <div className="app-page">
                <Loading
                    message="Checking system health..."
                    fullPage
                />
            </div>
        );
    }

    if (error && !health) {
        return (
            <div className="app-page">
                <ErrorState
                    message={error}
                    onRetry={() =>
                        loadHealth()
                    }
                />
            </div>
        );
    }

    const database =
        health?.database || {};

    const pi =
        health?.pi_network ||
        health?.piNetwork ||
        {};

    const gameEngine =
        health?.game_engine ||
        health?.gameEngine ||
        {};

    return (
        <div className="app-page">
            <div className="app-page-header">
                <div>
                    <h1>
                        System Health
                    </h1>

                    <p>
                        Monitor the Plinko-on-Pi
                        platform and its dependencies.
                    </p>
                </div>

                <div>
                    <button
                        type="button"
                        className="app-button"
                        onClick={() =>
                            loadHealth()
                        }
                        disabled={loading}
                    >
                        {loading
                            ? "Checking..."
                            : "Refresh"}
                    </button>

                    {lastUpdated && (
                        <div
                            style={{
                                marginTop: "6px",
                                fontSize: "11px",
                                color:
                                    "var(--app-text-muted)",
                            }}
                        >
                            Updated{" "}
                            {lastUpdated.toLocaleTimeString()}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="app-alert app-alert-warning">
                    {error}
                </div>
            )}

            <div className="app-stats-grid">
                <StatCard
                    title="Platform"
                    value={
                        health?.status ||
                        "Unknown"
                    }
                    description="Overall platform status"
                    icon="●"
                />

                <StatCard
                    title="Uptime"
                    value={formatUptime(
                        health?.uptime
                    )}
                    description="Backend process uptime"
                    icon="◷"
                />

                <StatCard
                    title="Database"
                    value={
                        database.status ||
                        "Unknown"
                    }
                    description={
                        database.latency_ms !=
                        null
                            ? `${database.latency_ms} ms latency`
                            : "Database connectivity"
                    }
                    icon="▣"
                />

                <StatCard
                    title="Game Engine"
                    value={
                        gameEngine.status ||
                        "Unknown"
                    }
                    description="Plinko engine state"
                    icon="◆"
                />
            </div>

            <section
                className="app-card"
                style={{
                    marginTop: "18px",
                }}
            >
                <header className="app-card-header">
                    <div>
                        <h2 className="app-card-title">
                            Services
                        </h2>

                        <p className="app-card-description">
                            Backend dependencies and
                            runtime services.
                        </p>
                    </div>
                </header>

                <div className="app-card-body">
                    <div className="app-table-wrapper">
                        <table className="app-table">
                            <thead>
                                <tr>
                                    <th>
                                        Service
                                    </th>
                                    <th>
                                        Status
                                    </th>
                                    <th>
                                        Latency
                                    </th>
                                    <th>
                                        Details
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {services.length ===
                                0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="empty"
                                        >
                                            No service
                                            information
                                            returned.
                                        </td>
                                    </tr>
                                ) : (
                                    services.map(
                                        (
                                            service,
                                            index
                                        ) => (
                                            <tr
                                                key={
                                                    service.id ||
                                                    service.name ||
                                                    index
                                                }
                                            >
                                                <td>
                                                    <strong>
                                                        {service.name ||
                                                            "Service"}
                                                    </strong>
                                                </td>

                                                <td>
                                                    <span
                                                        className={statusClass(
                                                            service.status
                                                        )}
                                                    >
                                                        {service.status ||
                                                            "unknown"}
                                                    </span>
                                                </td>

                                                <td>
                                                    {service.latency_ms !=
                                                    null
                                                        ? `${service.latency_ms} ms`
                                                        : "—"}
                                                </td>

                                                <td>
                                                    {service.message ||
                                                        service.version ||
                                                        service.details ||
                                                        "—"}
                                                </td>
                                            </tr>
                                        )
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section
                className="app-card"
                style={{
                    marginTop: "18px",
                }}
            >
                <header className="app-card-header">
                    <div>
                        <h2 className="app-card-title">
                            Runtime
                        </h2>
                    </div>
                </header>

                <div className="app-card-body">
                    <div className="app-health-grid">
                        <div className="app-health-card">
                            <h3 className="app-health-card-title">
                                Node
                            </h3>
                            <p className="app-health-card-description">
                                {health?.runtime
                                    ?.node_version ||
                                    health?.node_version ||
                                    "—"}
                            </p>
                        </div>

                        <div className="app-health-card">
                            <h3 className="app-health-card-title">
                                Memory
                            </h3>
                            <p className="app-health-card-description">
                                {formatBytes(
                                    health
                                        ?.runtime
                                        ?.memory_usage
                                )}
                            </p>
                        </div>

                        <div className="app-health-card">
                            <h3 className="app-health-card-title">
                                Pi Network
                            </h3>
                            <p className="app-health-card-description">
                                <span
                                    className={statusClass(
                                        pi.status
                                    )}
                                >
                                    {pi.status ||
                                        "Unknown"}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
