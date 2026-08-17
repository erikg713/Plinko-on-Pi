/*
 * Plinko-on-Pi Admin
 * admin/src/components/SeedsManager.js
 *
 * Server-side provably-fair seed management UI.
 *
 * IMPORTANT:
 * - Never expose an active secret/server seed to the browser.
 * - The API should return only public hashes/metadata.
 * - Seed generation, storage, hashing, rotation and reveal
 *   must happen server-side.
 */

import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";


/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE = (
    process.env.REACT_APP_API_URL ||
    "/api"
).replace(/\/+$/, "");


/* =========================================================
   API
   ========================================================= */

async function apiRequest(
    path,
    options = {}
) {
    const {
        method = "GET",
        body,
        signal,
    } = options;

    const headers = {
        Accept: "application/json",
    };

    if (body !== undefined) {
        headers["Content-Type"] =
            "application/json";
    }

    const response = await fetch(
        `${API_BASE}${path}`,
        {
            method,
            headers,
            credentials: "include",
            body:
                body === undefined
                    ? undefined
                    : JSON.stringify(body),
            signal,
        }
    );

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    let payload = null;

    if (
        contentType.includes(
            "application/json"
        )
    ) {
        payload =
            await response.json();
    } else {
        const text =
            await response.text();

        payload = text
            ? {
                message: text,
            }
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
   HELPERS
   ========================================================= */

function getData(payload) {
    if (
        payload &&
        payload.data !== undefined
    ) {
        return payload.data;
    }

    return payload;
}


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

    return [];
}


function formatDate(value) {
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


function truncate(
    value,
    start = 12,
    end = 10
) {
    if (!value) {
        return "—";
    }

    const text =
        String(value);

    if (
        text.length <=
        start + end + 1
    ) {
        return text;
    }

    return (
        `${text.slice(0, start)}` +
        `…` +
        `${text.slice(-end)}`
    );
}


function statusClass(value) {
    const status =
        String(
            value || "unknown"
        ).toLowerCase();

    if (
        [
            "active",
            "current",
            "committed",
            "revealed",
            "verified",
            "valid",
            "ready",
        ].includes(status)
    ) {
        return "app-status-success";
    }

    if (
        [
            "pending",
            "scheduled",
            "rotating",
            "warning",
        ].includes(status)
    ) {
        return "app-status-warning";
    }

    if (
        [
            "revoked",
            "invalid",
            "error",
            "failed",
        ].includes(status)
    ) {
        return "app-status-danger";
    }

    return "app-status-neutral";
}


/* =========================================================
   COPY BUTTON
   ========================================================= */

function CopyButton({
    value,
}) {
    const [
        copied,
        setCopied,
    ] = useState(false);

    const copy = async () => {
        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                String(value)
            );

            setCopied(true);

            window.setTimeout(
                () => setCopied(false),
                1500
            );
        } catch {
            setCopied(false);
        }
    };

    return (
        <button
            type="button"
            className="app-button app-button-small"
            onClick={copy}
            disabled={!value}
        >
            {copied
                ? "Copied"
                : "Copy"}
        </button>
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
   SEED STATUS
   ========================================================= */

function SeedStatus({
    currentSeed,
}) {
    if (!currentSeed) {
        return (
            <div className="app-alert app-alert-warning">
                No active seed information is available.
            </div>
        );
    }

    return (
        <div className="app-health-grid">

            <div className="app-health-card">

                <div className="app-health-card-header">

                    <h3 className="app-health-card-title">
                        Current Seed
                    </h3>

                    <span
                        className={
                            `app-status ${
                                statusClass(
                                    currentSeed.status ||
                                    "active"
                                )
                            }`
                        }
                    >
                        {
                            currentSeed.status ||
                            "active"
                        }
                    </span>

                </div>

                <p className="app-health-card-description">
                    {
                        currentSeed.description ||
                        "Active server-side game seed."
                    }
                </p>

            </div>


            <div className="app-health-card">

                <div className="app-health-card-header">

                    <h3 className="app-health-card-title">
                        Public Hash
                    </h3>

                    <CopyButton
                        value={
                            currentSeed.public_hash ||
                            currentSeed.hash ||
                            currentSeed.server_seed_hash
                        }
                    />

                </div>

                <p className="app-health-card-description app-mono">
                    {truncate(
                        currentSeed.public_hash ||
                        currentSeed.hash ||
                        currentSeed.server_seed_hash,
                        18,
                        14
                    )}
                </p>

            </div>


            <div className="app-health-card">

                <div className="app-health-card-header">

                    <h3 className="app-health-card-title">
                        Created
                    </h3>

                </div>

                <p className="app-health-card-description">
                    {formatDate(
                        currentSeed.created_at
                    )}
                </p>

            </div>


            <div className="app-health-card">

                <div className="app-health-card-header">

                    <h3 className="app-health-card-title">
                        Activated
                    </h3>

                </div>

                <p className="app-health-card-description">
                    {formatDate(
                        currentSeed.activated_at
                    )}
                </p>

            </div>

        </div>
    );
}


/* =========================================================
   ROTATION DIALOG
   ========================================================= */

function RotationPanel({
    onRotate,
    loading,
}) {
    const [
        confirmed,
        setConfirmed,
    ] = useState(false);

    return (
        <Card
            title="Rotate Server Seed"
            description="Generate a new server-side seed for future games."
        >

            <div className="app-alert app-alert-warning">

                <strong>
                    Important:
                </strong>{" "}
                Rotation should only affect
                future games. Existing games must
                remain verifiable against the seed
                that was committed when they were played.

            </div>


            <label
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "9px",
                    marginBottom: "15px",
                    color:
                        "var(--app-text-secondary)",
                    fontSize: "13px",
                }}
            >

                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) =>
                        setConfirmed(
                            event.target.checked
                        )
                    }
                />

                <span>
                    I understand that rotating the
                    seed changes the seed used for
                    future games.
                </span>

            </label>


            <button
                type="button"
                className="app-button app-button-primary"
                disabled={
                    !confirmed ||
                    loading
                }
                onClick={onRotate}
            >
                {loading
                    ? "Rotating..."
                    : "Rotate Server Seed"}
            </button>

        </Card>
    );
}


/* =========================================================
   HISTORY TABLE
   ========================================================= */

function SeedHistory({
    seeds,
}) {
    return (
        <Card
            title="Seed History"
            description="Previously committed public seed records"
        >

            <div className="app-table-wrapper">

                <table className="app-table">

                    <thead>

                        <tr>
                            <th>ID</th>
                            <th>Public Hash</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Activated</th>
                            <th>Revealed</th>
                        </tr>

                    </thead>


                    <tbody>

                        {seeds.length === 0 ? (

                            <tr>

                                <td
                                    colSpan="6"
                                    className="empty"
                                >
                                    No seed history available.
                                </td>

                            </tr>

                        ) : (

                            seeds.map(
                                (
                                    seed,
                                    index
                                ) => (
                                    <tr
                                        key={
                                            seed.id ||
                                            seed.seed_id ||
                                            index
                                        }
                                    >

                                        <td>
                                            <span className="app-mono">
                                                {
                                                    seed.id ||
                                                    seed.seed_id ||
                                                    "—"
                                                }
                                            </span>
                                        </td>


                                        <td>

                                            <div
                                                style={{
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    gap:
                                                        "8px",
                                                }}
                                            >

                                                <span
                                                    className="app-mono"
                                                    title={
                                                        seed.public_hash ||
                                                        seed.hash ||
                                                        ""
                                                    }
                                                >
                                                    {truncate(
                                                        seed.public_hash ||
                                                        seed.hash ||
                                                        seed.server_seed_hash,
                                                        10,
                                                        8
                                                    )}
                                                </span>

                                                <CopyButton
                                                    value={
                                                        seed.public_hash ||
                                                        seed.hash ||
                                                        seed.server_seed_hash
                                                    }
                                                />

                                            </div>

                                        </td>


                                        <td>

                                            <span
                                                className={
                                                    `app-status ${
                                                        statusClass(
                                                            seed.status
                                                        )
                                                    }`
                                                }
                                            >
                                                {
                                                    seed.status ||
                                                    "unknown"
                                                }
                                            </span>

                                        </td>


                                        <td>
                                            {formatDate(
                                                seed.created_at
                                            )}
                                        </td>


                                        <td>
                                            {formatDate(
                                                seed.activated_at
                                            )}
                                        </td>


                                        <td>
                                            {formatDate(
                                                seed.revealed_at
                                            )}
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
   COMMIT / VERIFY INFORMATION
   ========================================================= */

function VerificationInfo({
    currentSeed,
}) {
    const hash =
        currentSeed?.public_hash ||
        currentSeed?.hash ||
        currentSeed?.server_seed_hash;

    return (
        <Card
            title="Provably Fair Verification"
            description="Public commitment information for Plinko results"
        >

            <div
                style={{
                    display: "grid",
                    gap: "12px",
                }}
            >

                <div className="app-alert app-alert-success">

                    The active server seed should be
                    committed publicly by its cryptographic
                    hash before it is used for game results.

                </div>


                <div
                    style={{
                        padding: "14px",
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
                            marginBottom: "7px",
                            color:
                                "var(--app-text-muted)",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform:
                                "uppercase",
                            letterSpacing:
                                "0.05em",
                        }}
                    >
                        Public commitment
                    </div>


                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                        }}
                    >

                        <code
                            className="app-mono"
                            style={{
                                minWidth: 0,
                                overflowWrap:
                                    "anywhere",
                                color:
                                    "var(--app-text-secondary)",
                            }}
                        >
                            {hash || "Not available"}
                        </code>

                        {hash && (
                            <CopyButton
                                value={hash}
                            />
                        )}

                    </div>

                </div>


                <div className="app-alert app-alert-warning">

                    <strong>
                        Never place the raw server seed
                        in React state, HTML, localStorage,
                        logs, analytics, or API responses
                        while it is active.
                    </strong>

                </div>

            </div>

        </Card>
    );
}


/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function SeedsManager({
    initialData = null,
}) {
    const [
        currentSeed,
        setCurrentSeed,
    ] = useState(
        initialData?.current ||
        initialData?.current_seed ||
        null
    );

    const [
        seeds,
        setSeeds,
    ] = useState(
        asArray(
            initialData?.history ||
            initialData?.seeds
        )
    );

    const [
        loading,
        setLoading,
    ] = useState(
        !initialData
    );

    const [
        rotating,
        setRotating,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    const [
        success,
        setSuccess,
    ] = useState(null);


    /* =====================================================
       LOAD
       ===================================================== */

    const loadSeeds =
        useCallback(
            async (
                signal
            ) => {
                setLoading(true);
                setError(null);

                try {
                    const result =
                        await apiRequest(
                            "/admin/seeds",
                            {
                                signal,
                            }
                        );

                    const data =
                        getData(result);

                    setCurrentSeed(
                        data?.current ||
                        data?.current_seed ||
                        null
                    );

                    setSeeds(
                        asArray(
                            data?.history ||
                            data?.seeds
                        )
                    );

                } catch (requestError) {

                    if (
                        requestError.name ===
                        "AbortError"
                    ) {
                        return;
                    }

                    setError(
                        requestError.message ||
                        "Unable to load seed information."
                    );

                } finally {
                    setLoading(false);
                }
            },
            []
        );


    useEffect(
        () => {
            if (initialData) {
                return undefined;
            }

            const controller =
                new AbortController();

            loadSeeds(
                controller.signal
            );

            return () =>
                controller.abort();
        },
        [
            initialData,
            loadSeeds,
        ]
    );


    /* =====================================================
       ROTATE
       ===================================================== */

    const rotateSeed =
        useCallback(
            async () => {
                setRotating(true);
                setError(null);
                setSuccess(null);

                try {
                    const result =
                        await apiRequest(
                            "/admin/seeds/rotate",
                            {
                                method:
                                    "POST",
                            }
                        );

                    const data =
                        getData(result);

                    /*
                     * The API should return the
                     * new public commitment only.
                     *
                     * Never expect a raw server seed
                     * in this response.
                     */

                    if (
                        data?.current ||
                        data?.current_seed
                    ) {
                        setCurrentSeed(
                            data.current ||
                            data.current_seed
                        );
                    }

                    if (
                        data?.history ||
                        data?.seeds
                    ) {
                        setSeeds(
                            asArray(
                                data.history ||
                                data.seeds
                            )
                        );
                    } else {
                        await loadSeeds();
                    }

                    setSuccess(
                        "Server seed rotated successfully."
                    );

                } catch (requestError) {

                    setError(
                        requestError.message ||
                        "Seed rotation failed."
                    );

                } finally {
                    setRotating(false);
                }
            },
            [
                loadSeeds,
            ]
        );


    /* =====================================================
       DERIVED STATE
       ===================================================== */

    const activeHash =
        useMemo(
            () =>
                currentSeed?.public_hash ||
                currentSeed?.hash ||
                currentSeed?.server_seed_hash ||
                null,
            [currentSeed]
        );


    /* =====================================================
       RENDER
       ===================================================== */

    return (
        <div className="app-page">

            <div
                style={{
                    display: "flex",
                    justifyContent:
                        "space-between",
                    alignItems:
                        "center",
                    gap: "12px",
                    marginBottom:
                        "18px",
                }}
            >

                <div>

                    <h1
                        style={{
                            margin: 0,
                            fontSize: "22px",
                            fontWeight: 800,
                        }}
                    >
                        Seeds Manager
                    </h1>

                    <p
                        style={{
                            margin:
                                "5px 0 0",
                            color:
                                "var(--app-text-muted)",
                            fontSize:
                                "13px",
                        }}
                    >
                        Manage provably fair Plinko
                        server-seed commitments.
                    </p>

                </div>


                <button
                    type="button"
                    className="app-button"
                    onClick={() =>
                        loadSeeds()
                    }
                    disabled={loading}
                >
                    {loading
                        ? "Loading..."
                        : "Refresh"}
                </button>

            </div>


            {error && (
                <div
                    className="app-alert app-alert-error"
                    role="alert"
                >
                    {error}
                </div>
            )}


            {success && (
                <div
                    className="app-alert app-alert-success"
                    role="status"
                >
                    {success}
                </div>
            )}


            <div
                className="app-card-grid"
                style={{
                    marginBottom:
                        "18px",
                }}
            >

                <Card
                    title="Active Seed"
                    description="Current public commitment"
                >

                    {loading ? (

                        <div className="app-loading">
                            <span className="app-spinner" />
                        </div>

                    ) : (

                        <SeedStatus
                            currentSeed={
                                currentSeed
                            }
                        />

                    )}

                </Card>


                <VerificationInfo
                    currentSeed={
                        currentSeed
                    }
                />

            </div>


            <RotationPanel
                onRotate={
                    rotateSeed
                }
                loading={
                    rotating
                }
            />


            <div
                style={{
                    marginTop:
                        "18px",
                }}
            >

                <SeedHistory
                    seeds={
                        seeds
                    }
                />

            </div>


            <div
                className="app-alert app-alert-warning"
                style={{
                    marginTop:
                        "18px",
                }}
            >
                <strong>
                    Security boundary:
                </strong>{" "}
                The browser should receive only public
                seed commitments and metadata. Raw active
                server seeds must remain inside the trusted
                backend/secret-storage boundary.
            </div>

        </div>
    );
                          }
