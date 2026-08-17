import React, {
    useCallback,
    useEffect,
    useState,
} from "react";

import DataTable from "./DataTable";
import Loading from "./Loading";
import ErrorState from "./ErrorState";


const API_BASE = (
    process.env.REACT_APP_API_URL ||
    "/api"
).replace(/\/+$/, "");


async function request(
    path,
    options = {}
) {
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

    const type =
        response.headers.get(
            "content-type"
        ) || "";

    const data = type.includes(
        "application/json"
    )
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(
            data?.message ||
                data?.error ||
                "Request failed"
        );
    }

    return data?.data ?? data;
}


function formatPi(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return `${number.toFixed(4)} π`;
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


function statusClass(status) {
    const value = String(
        status || ""
    ).toLowerCase();

    if (
        [
            "completed",
            "complete",
            "settled",
            "success",
        ].includes(value)
    ) {
        return "app-status app-status-success";
    }

    if (
        [
            "pending",
            "processing",
        ].includes(value)
    ) {
        return "app-status app-status-warning";
    }

    if (
        [
            "failed",
            "cancelled",
            "canceled",
            "error",
        ].includes(value)
    ) {
        return "app-status app-status-danger";
    }

    return "app-status app-status-neutral";
}


export default function GamesManager() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");

    const loadGames = useCallback(
        async (signal) => {
            setLoading(true);
            setError(null);

            try {
                const params =
                    new URLSearchParams();

                if (search.trim()) {
                    params.set(
                        "search",
                        search.trim()
                    );
                }

                if (status !== "all") {
                    params.set(
                        "status",
                        status
                    );
                }

                const query =
                    params.toString();

                const data =
                    await request(
                        `/admin/games${
                            query
                                ? `?${query}`
                                : ""
                        }`,
                        { signal }
                    );

                setGames(
                    Array.isArray(data)
                        ? data
                        : data?.items || []
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
        [search, status]
    );


    useEffect(() => {
        const controller =
            new AbortController();

        loadGames(
            controller.signal
        );

        return () =>
            controller.abort();
    }, [loadGames]);


    const columns = [
        {
            key: "id",
            label: "Game",
            render: (game) => (
                <span className="app-mono">
                    {game.id ||
                        game.game_id ||
                        "—"}
                </span>
            ),
        },

        {
            key: "player",
            label: "Player",
            render: (game) =>
                game.username ||
                game.player_name ||
                game.player_id ||
                "—",
        },

        {
            key: "bet",
            label: "Wager",
            render: (game) =>
                formatPi(
                    game.bet_amount ??
                        game.wager
                ),
        },

        {
            key: "multiplier",
            label: "Multiplier",
            render: (game) =>
                game.multiplier != null
                    ? `${game.multiplier}x`
                    : "—",
        },

        {
            key: "payout",
            label: "Payout",
            render: (game) =>
                formatPi(
                    game.payout
                ),
        },

        {
            key: "status",
            label: "Status",
            render: (game) => (
                <span
                    className={statusClass(
                        game.status
                    )}
                >
                    {game.status ||
                        "unknown"}
                </span>
            ),
        },

        {
            key: "created_at",
            label: "Created",
            render: (game) =>
                formatDate(
                    game.created_at
                ),
        },
    ];


    return (
        <div className="app-page">

            <div className="app-page-header">
                <div>
                    <h1>Games</h1>

                    <p>
                        Monitor Plinko game
                        rounds and outcomes.
                    </p>
                </div>

                <button
                    type="button"
                    className="app-button"
                    onClick={() =>
                        loadGames()
                    }
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>


            <div
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
                        placeholder="Search game or player..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                    />

                    <select
                        className="app-input"
                        value={status}
                        onChange={(event) =>
                            setStatus(
                                event.target.value
                            )
                        }
                    >
                        <option value="all">
                            All statuses
                        </option>

                        <option value="completed">
                            Completed
                        </option>

                        <option value="pending">
                            Pending
                        </option>

                        <option value="failed">
                            Failed
                        </option>
                    </select>
                </div>
            </div>


            {error ? (
                <ErrorState
                    message={error}
                    onRetry={() =>
                        loadGames()
                    }
                />
            ) : loading ? (
                <Loading />
            ) : (
                <DataTable
                    columns={columns}
                    rows={games}
                    emptyMessage="No games found."
                />
            )}

        </div>
    );
          }
