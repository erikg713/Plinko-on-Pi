import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import Loading from "./Loading";
import ErrorState from "./ErrorState";

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
                Accept:
                    "application/json",
            },
            ...options,
        }
    );

    const type =
        response.headers.get(
            "content-type"
        ) || "";

    const payload = type.includes(
        "application/json"
    )
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(
            payload?.message ||
                payload?.error ||
                "Unable to load logs"
        );
    }

    return payload?.data ?? payload;
}

function levelClass(level) {
    const value = String(
        level || "info"
    ).toLowerCase();

    if (
        [
            "error",
            "fatal",
            "critical",
        ].includes(value)
    ) {
        return "app-status app-status-danger";
    }

    if (
        [
            "warn",
            "warning",
        ].includes(value)
    ) {
        return "app-status app-status-warning";
    }

    if (
        [
            "debug",
        ].includes(value)
    ) {
        return "app-status app-status-neutral";
    }

    return "app-status app-status-success";
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString();
}

export default function LogsViewer() {
    const [logs, setLogs] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);

    const [level, setLevel] =
        useState("all");

    const [search, setSearch] =
        useState("");

    const [autoRefresh, setAutoRefresh] =
        useState(false);

    const loadLogs = useCallback(
        async (signal) => {
            setLoading(true);
            setError(null);

            try {
                const params =
                    new URLSearchParams();

                if (
                    level !== "all"
                ) {
                    params.set(
                        "level",
                        level
                    );
                }

                if (
                    search.trim()
                ) {
                    params.set(
                        "search",
                        search.trim()
                    );
                }

                params.set(
                    "limit",
                    "250"
                );

                const data =
                    await request(
                        `/admin/logs?${params}`,
                        { signal }
                    );

                setLogs(
                    Array.isArray(data)
                        ? data
                        : data?.items ||
                              []
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
        [level, search]
    );

    useEffect(() => {
        const controller =
            new AbortController();

        loadLogs(
            controller.signal
        );

        return () =>
            controller.abort();
    }, [loadLogs]);

    useEffect(() => {
        if (!autoRefresh) {
            return undefined;
        }

        const interval =
            window.setInterval(
                () => {
                    loadLogs();
                },
                5000
            );

        return () =>
            window.clearInterval(
                interval
            );
    }, [
        autoRefresh,
        loadLogs,
    ]);

    const visibleLogs = useMemo(
        () => logs,
        [logs]
    );

    return (
        <div className="app-page">
            <div className="app-page-header">
                <div>
                    <h1>
                        Logs
                    </h1>

                    <p>
                        Application and system
                        event logs.
                    </p>
                </div>

                <button
                    type="button"
                    className="app-button"
                    onClick={() =>
                        loadLogs()
                    }
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>

            <section
                className="app-card"
                style={{
                    marginBottom: "18px",
                }}
            >
                <div
                    className="app-card-body"
                    style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                    }}
                >
                    <input
                        className="app-input"
                        placeholder="Search logs..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                    />

                    <select
                        className="app-input"
                        value={level}
                        onChange={(event) =>
                            setLevel(
                                event.target.value
                            )
                        }
                    >
                        <option value="all">
                            All levels
                        </option>

                        <option value="debug">
                            Debug
                        </option>

                        <option value="info">
                            Info
                        </option>

                        <option value="warning">
                            Warning
                        </option>

                        <option value="error">
                            Error
                        </option>

                        <option value="critical">
                            Critical
                        </option>
                    </select>

                    <label
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            gap: "7px",
                            fontSize:
                                "13px",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={
                                autoRefresh
                            }
                            onChange={(event) =>
                                setAutoRefresh(
                                    event.target
                                        .checked
                                )
                            }
                        />

                        Auto-refresh
                    </label>
                </div>
            </section>

            {error ? (
                <ErrorState
                    message={error}
                    onRetry={() =>
                        loadLogs()
                    }
                />
            ) : loading &&
              logs.length === 0 ? (
                <Loading
                    message="Loading logs..."
                />
            ) : (
                <section className="app-card">
                    <div className="app-card-body">
                        <div
                            style={{
                                maxHeight:
                                    "650px",
                                overflow:
                                    "auto",
                            }}
                        >
                            {visibleLogs.length ===
                            0 ? (
                                <div className="app-empty-state">
                                    <h3>
                                        No logs found
                                    </h3>

                                    <p>
                                        No events
                                        match the
                                        current
                                        filters.
                                    </p>
                                </div>
                            ) : (
                                visibleLogs.map(
                                    (
                                        log,
                                        index
                                    ) => (
                                        <div
                                            key={
                                                log.id ||
                                                log.timestamp ||
                                                index
                                            }
                                            style={{
                                                display:
                                                    "grid",
                                                gridTemplateColumns:
                                                    "150px 90px minmax(0, 1fr)",
                                                gap:
                                                    "12px",
                                                padding:
                                                    "10px 0",
                                                borderBottom:
                                                    "1px solid var(--app-border)",
                                                fontSize:
                                                    "12px",
                                            }}
                                        >
                                            <span
                                                className="app-mono"
                                            >
                                                {formatDate(
                                                    log.timestamp ||
                                                        log.created_at
                                                )}
                                            </span>

                                            <span
                                                className={levelClass(
                                                    log.level
                                                )}
                                            >
                                                {log.level ||
                                                    "info"}
                                            </span>

                                            <span
                                                style={{
                                                    overflowWrap:
                                                        "anywhere",
                                                }}
                                            >
                                                {log.message ||
                                                    log.msg ||
                                                    JSON.stringify(
                                                        log
                                                    )}
                                            </span>
                                        </div>
                                    )
                                )
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
