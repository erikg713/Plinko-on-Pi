import React, {
    useCallback,
    useEffect,
    useState,
} from "react";

import Loading from "./Loading";
import ErrorState from "./ErrorState";
import ConfirmDialog from "./ConfirmDialog";

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

    const payload = type.includes(
        "application/json"
    )
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(
            payload?.message ||
                payload?.error ||
                "Settings request failed"
        );
    }

    return payload?.data ?? payload;
}

const DEFAULT_SETTINGS = {
    maintenance_mode: false,
    accepting_games: true,
    accepting_withdrawals: true,
    accepting_deposits: true,
    max_bet: "",
    min_bet: "",
    default_risk_limit: "",
};

export default function SettingsManager() {
    const [
        settings,
        setSettings,
    ] = useState(
        DEFAULT_SETTINGS
    );

    const [
        original,
        setOriginal,
    ] = useState(
        DEFAULT_SETTINGS
    );

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        saving,
        setSaving,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    const [
        success,
        setSuccess,
    ] = useState(null);

    const [
        showMaintenanceConfirm,
        setShowMaintenanceConfirm,
    ] = useState(false);


    const loadSettings =
        useCallback(
            async (signal) => {
                setLoading(true);
                setError(null);

                try {
                    const data =
                        await request(
                            "/admin/settings",
                            { signal }
                        );

                    const next = {
                        ...DEFAULT_SETTINGS,
                        ...(data || {}),
                    };

                    setSettings(next);
                    setOriginal(next);
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

        loadSettings(
            controller.signal
        );

        return () =>
            controller.abort();
    }, [loadSettings]);


    const update = (
        key,
        value
    ) => {
        setSettings(
            (current) => ({
                ...current,
                [key]: value,
            })
        );

        setSuccess(null);
    };


    const saveSettings =
        async () => {
            setSaving(true);
            setError(null);
            setSuccess(null);

            try {
                await request(
                    "/admin/settings",
                    {
                        method: "PATCH",
                        body: JSON.stringify(
                            settings
                        ),
                    }
                );

                setOriginal(
                    settings
                );

                setSuccess(
                    "Settings saved successfully."
                );
            } catch (err) {
                setError(
                    err.message
                );
            } finally {
                setSaving(false);
            }
        };


    const hasChanges =
        JSON.stringify(
            settings
        ) !==
        JSON.stringify(
            original
        );


    const toggleMaintenance = () => {
        const next =
            !settings.maintenance_mode;

        if (next) {
            setShowMaintenanceConfirm(
                true
            );
            return;
        }

        update(
            "maintenance_mode",
            false
        );
    };


    if (loading) {
        return (
            <div className="app-page">
                <Loading
                    message="Loading settings..."
                    fullPage
                />
            </div>
        );
    }


    if (error && !settings) {
        return (
            <div className="app-page">
                <ErrorState
                    message={error}
                    onRetry={() =>
                        loadSettings()
                    }
                />
            </div>
        );
    }


    return (
        <div className="app-page">

            <div className="app-page-header">

                <div>
                    <h1>
                        Settings
                    </h1>

                    <p>
                        Configure operational
                        controls for Plinko-on-Pi.
                    </p>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "8px",
                    }}
                >
                    <button
                        type="button"
                        className="app-button"
                        onClick={() => {
                            setSettings(
                                original
                            );
                            setSuccess(null);
                        }}
                        disabled={
                            !hasChanges ||
                            saving
                        }
                    >
                        Discard
                    </button>

                    <button
                        type="button"
                        className="app-button app-button-primary"
                        onClick={
                            saveSettings
                        }
                        disabled={
                            !hasChanges ||
                            saving
                        }
                    >
                        {saving
                            ? "Saving..."
                            : "Save Changes"}
                    </button>
                </div>

            </div>


            {error && (
                <div className="app-alert app-alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="app-alert app-alert-success">
                    {success}
                </div>
            )}


            <section className="app-card">

                <header className="app-card-header">

                    <div>
                        <h2 className="app-card-title">
                            Platform Controls
                        </h2>

                        <p className="app-card-description">
                            Operational switches for
                            the game platform.
                        </p>
                    </div>

                </header>


                <div className="app-card-body">

                    <div
                        style={{
                            display: "grid",
                            gap: "16px",
                        }}
                    >

                        <label className="app-setting-row">

                            <span>
                                <strong>
                                    Maintenance mode
                                </strong>

                                <small>
                                    Temporarily
                                    disable normal
                                    player activity.
                                </small>
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    Boolean(
                                        settings.maintenance_mode
                                    )
                                }
                                onChange={
                                    toggleMaintenance
                                }
                            />

                        </label>


                        <label className="app-setting-row">

                            <span>
                                <strong>
                                    Accept games
                                </strong>

                                <small>
                                    Allow players to
                                    start new Plinko
                                    rounds.
                                </small>
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    Boolean(
                                        settings.accepting_games
                                    )
                                }
                                onChange={(event) =>
                                    update(
                                        "accepting_games",
                                        event.target
                                            .checked
                                    )
                                }
                            />

                        </label>


                        <label className="app-setting-row">

                            <span>
                                <strong>
                                    Accept deposits
                                </strong>

                                <small>
                                    Allow supported
                                    deposit flows.
                                </small>
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    Boolean(
                                        settings.accepting_deposits
                                    )
                                }
                                onChange={(event) =>
                                    update(
                                        "accepting_deposits",
                                        event.target
                                            .checked
                                    )
                                }
                            />

                        </label>


                        <label className="app-setting-row">

                            <span>
                                <strong>
                                    Accept withdrawals
                                </strong>

                                <small>
                                    Allow supported
                                    withdrawal flows.
                                </small>
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    Boolean(
                                        settings.accepting_withdrawals
                                    )
                                }
                                onChange={(event) =>
                                    update(
                                        "accepting_withdrawals",
                                        event.target
                                            .checked
                                    )
                                }
                            />

                        </label>

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
                            Betting Limits
                        </h2>

                        <p className="app-card-description">
                            Configure server-side
                            wager boundaries.
                        </p>
                    </div>

                </header>


                <div className="app-card-body">

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "15px",
                        }}
                    >

                        <label>
                            <span className="app-form-label">
                                Minimum bet
                            </span>

                            <input
                                className="app-input"
                                type="number"
                                min="0"
                                step="0.0001"
                                value={
                                    settings.min_bet
                                }
                                onChange={(event) =>
                                    update(
                                        "min_bet",
                                        event.target
                                            .value
                                    )
                                }
                            />
                        </label>


                        <label>
                            <span className="app-form-label">
                                Maximum bet
                            </span>

                            <input
                                className="app-input"
                                type="number"
                                min="0"
                                step="0.0001"
                                value={
                                    settings.max_bet
                                }
                                onChange={(event) =>
                                    update(
                                        "max_bet",
                                        event.target
                                            .value
                                    )
                                }
                            />
                        </label>


                        <label>
                            <span className="app-form-label">
                                Default risk limit
                            </span>

                            <input
                                className="app-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    settings.default_risk_limit
                                }
                                onChange={(event) =>
                                    update(
                                        "default_risk_limit",
                                        event.target
                                            .value
                                    )
                                }
                            />
                        </label>

                    </div>

                </div>

            </section>


            <ConfirmDialog
                open={
                    showMaintenanceConfirm
                }
                title="Enable maintenance mode?"
                message="This can prevent players from starting normal game activity. Existing settled records should remain untouched."
                confirmText="Enable Maintenance"
                cancelText="Cancel"
                danger
                onCancel={() =>
                    setShowMaintenanceConfirm(
                        false
                    )
                }
                onConfirm={() => {
                    update(
                        "maintenance_mode",
                        true
                    );

                    setShowMaintenanceConfirm(
                        false
                    );
                }}
            />

        </div>
    );
      }
