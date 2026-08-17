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
                Accept:
                    "application/json",
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


function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString();
}


function formatPi(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? `${number.toFixed(4)} π`
        : "—";
}


function playerStatus(status) {
    const value =
        String(status || "")
            .toLowerCase();

    if (
        [
            "active",
            "online",
            "verified",
        ].includes(value)
    ) {
        return "app-status app-status-success";
    }

    if (
        [
            "suspended",
            "pending",
        ].includes(value)
    ) {
        return "app-status app-status-warning";
    }

    if (
        [
            "banned",
            "disabled",
            "blocked",
        ].includes(value)
    ) {
        return "app-status app-status-danger";
    }

    return "app-status app-status-neutral";
}


export default function PlayersManager() {
    const [players, setPlayers] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);

    const [search, setSearch] =
        useState("");


    const loadPlayers =
        useCallback(
            async (signal) => {
                setLoading(true);
                setError(null);

                try {
                    const params =
                        new URLSearchParams();

                    if (
                        search.trim()
                    ) {
                        params.set(
                            "search",
                            search.trim()
                        );
                    }

                    const query =
                        params.toString();

                    const data =
                        await request(
                            `/admin/players${
                                query
                                    ? `?${query}`
                                    : ""
                            }`,
                            { signal }
                        );

                    setPlayers(
                        Array.isArray(
                            data
                        )
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
            [search]
        );


    useEffect(() => {
        const controller =
            new AbortController();

        loadPlayers(
            controller.signal
        );

        return () =>
            controller.abort();
    }, [loadPlayers]);


    const columns = [
        {
            key: "username",
            label: "Player",
            render: (player) => (
                <strong>
                    {player.username ||
                        player.name ||
                        "Unknown"}
                </strong>
            ),
        },

        {
            key: "pi_uid",
            label: "Pi UID",
            render: (player) => (
                <span
                    className="app-mono"
                >
                    {player.pi_uid ||
                        player.uid ||
                        player.pi_user_id ||
                        "—"}
                </span>
            ),
        },

        {
            key: "games",
            label: "Games",
            render: (player) =>
                player.games_count ??
                player.game_count ??
                0,
        },

        {
            key: "wagered",
            label: "Wagered",
            render: (player) =>
                formatPi(
                    player.total_wagered ??
                        player.wagered
                ),
        },

        {
            key: "payouts",
            label: "Payouts",
            render: (player) =>
                formatPi(
                    player.total_payouts ??
                        player.payouts
                ),
        },

        {
            key: "status",
            label: "Status",
            render: (player) => (
                <span
                    className={playerStatus(
                        player.status
                    )}
                >
                    {player.status ||
                        "unknown"}
                </span>
            ),
        },

        {
            key: "created_at",
            label: "Joined",
            render: (player) =>
                formatDate(
                    player.created_at
                ),
        },
    ];


    return (
        <div className="app-page">

            <div className="app-page-header">

                <div>
                    <h1>Players</h1>

                    <p>
                        Manage registered
                        Plinko-on-Pi players.
                    </p>
                </div>

                <button
                    type="button"
                    className="app-button"
                    onClick={() =>
                        loadPlayers()
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
                <div className="app-card-body">

                    <input
                        className="app-input"
                        placeholder="Search username or Pi UID..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                    />

                </div>
            </div>


            {error ? (
                <ErrorState
                    message={error}
                    onRetry={() =>
                        loadPlayers()
                    }
                />
            ) : loading ? (
                <Loading />
            ) : (
                <DataTable
                    columns={columns}
                    rows={players}
                    emptyMessage="No players found."
                />
            )}

        </div>
    );
          }
