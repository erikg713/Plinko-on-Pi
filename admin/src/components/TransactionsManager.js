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

    return Number.isFinite(number)
        ? `${number.toFixed(4)} π`
        : "—";
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


function transactionStatus(
    status
) {
    const value =
        String(status || "")
            .toLowerCase();

    if (
        [
            "completed",
            "confirmed",
            "success",
            "successful",
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
            "rejected",
            "cancelled",
            "canceled",
        ].includes(value)
    ) {
        return "app-status app-status-danger";
    }

    return "app-status app-status-neutral";
}


export default function TransactionsManager() {
    const [
        transactions,
        setTransactions,
    ] = useState([]);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState(null);

    const [
        status,
        setStatus,
    ] = useState("all");


    const loadTransactions =
        useCallback(
            async (signal) => {
                setLoading(true);
                setError(null);

                try {
                    const params =
                        new URLSearchParams();

                    if (
                        status !== "all"
                    ) {
                        params.set(
                            "status",
                            status
                        );
                    }

                    const query =
                        params.toString();

                    const data =
                        await request(
                            `/admin/transactions${
                                query
                                    ? `?${query}`
                                    : ""
                            }`,
                            { signal }
                        );

                    setTransactions(
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
            [status]
        );


    useEffect(() => {
        const controller =
            new AbortController();

        loadTransactions(
            controller.signal
        );

        return () =>
            controller.abort();
    }, [
        loadTransactions,
    ]);


    const columns = [
        {
            key: "id",
            label: "Transaction",
            render: (transaction) => (
                <span className="app-mono">
                    {transaction.id ||
                        transaction.txid ||
                        transaction.transaction_id ||
                        "—"}
                </span>
            ),
        },

        {
            key: "player",
            label: "Player",
            render: (transaction) =>
                transaction.username ||
                transaction.player_name ||
                transaction.player_id ||
                "—",
        },

        {
            key: "type",
            label: "Type",
            render: (transaction) =>
                transaction.type ||
                transaction.transaction_type ||
                "—",
        },

        {
            key: "amount",
            label: "Amount",
            render: (transaction) =>
                formatPi(
                    transaction.amount
                ),
        },

        {
            key: "status",
            label: "Status",
            render: (transaction) => (
                <span
                    className={transactionStatus(
                        transaction.status
                    )}
                >
                    {transaction.status ||
                        "unknown"}
                </span>
            ),
        },

        {
            key: "created_at",
            label: "Created",
            render: (transaction) =>
                formatDate(
                    transaction.created_at
                ),
        },
    ];


    return (
        <div className="app-page">

            <div className="app-page-header">

                <div>
                    <h1>
                        Transactions
                    </h1>

                    <p>
                        Monitor Pi-related
                        platform transactions.
                    </p>
                </div>

                <button
                    type="button"
                    className="app-button"
                    onClick={() =>
                        loadTransactions()
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
                            All transactions
                        </option>

                        <option value="pending">
                            Pending
                        </option>

                        <option value="completed">
                            Completed
                        </option>

                        <option value="failed">
                            Failed
                        </option>

                        <option value="rejected">
                            Rejected
                        </option>
                    </select>

                </div>
            </div>


            {error ? (
                <ErrorState
                    message={error}
                    onRetry={() =>
                        loadTransactions()
                    }
                />
            ) : loading ? (
                <Loading />
            ) : (
                <DataTable
                    columns={columns}
                    rows={transactions}
                    emptyMessage="No transactions found."
                />
            )}

        </div>
    );
          }
