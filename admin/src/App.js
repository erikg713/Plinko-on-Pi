import React, {
    useCallback,
    useEffect,
    useState,
} from "react";

import "./App.css";

import Dashboard from "./components/Dashboard";
import SeedsManager from "./components/SeedsManager";
import GamesManager from "./components/GamesManager";
import PlayersManager from "./components/PlayersManager";
import TransactionsManager from "./components/TransactionsManager";
import SystemHealth from "./components/SystemHealth";
import LogsViewer from "./components/LogsViewer";
import SettingsManager from "./components/SettingsManager";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Toast from "./components/Toast";

const STORAGE_KEY =
    "plinko-admin-active-page";

const PAGE_TITLES = {
    dashboard: {
        title: "Dashboard",
        description:
            "Overview of the Plinko-on-Pi platform.",
    },

    games: {
        title: "Games",
        description:
            "Monitor Plinko rounds and game outcomes.",
    },

    players: {
        title: "Players",
        description:
            "Manage and monitor platform players.",
    },

    transactions: {
        title: "Transactions",
        description:
            "Monitor Pi-related platform transactions.",
    },

    seeds: {
        title: "Provably Fair Seeds",
        description:
            "Manage server and client seed state.",
    },

    health: {
        title: "System Health",
        description:
            "Monitor platform services and dependencies.",
    },

    logs: {
        title: "Logs",
        description:
            "Inspect application and system events.",
    },

    settings: {
        title: "Settings",
        description:
            "Configure platform operational controls.",
    },
};


function getInitialPage() {
    try {
        const saved =
            window.localStorage.getItem(
                STORAGE_KEY
            );

        if (
            saved &&
            PAGE_TITLES[saved]
        ) {
            return saved;
        }
    } catch {
        // Ignore localStorage failures.
    }

    return "dashboard";
}


function getAdminUser() {
    try {
        const raw =
            window.localStorage.getItem(
                "plinko-admin-user"
            );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    } catch {
        return null;
    }
}


export default function App() {
    const [activePage, setActivePage] =
        useState(getInitialPage);

    const [user, setUser] =
        useState(getAdminUser);

    const [toast, setToast] =
        useState(null);

    const [sidebarOpen, setSidebarOpen] =
        useState(false);

    const navigate = useCallback(
        (page) => {
            if (!PAGE_TITLES[page]) {
                return;
            }

            setActivePage(page);
            setSidebarOpen(false);

            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    page
                );
            } catch {
                // Ignore storage failures.
            }

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        },
        []
    );


    const notify = useCallback(
        (
            message,
            type = "info"
        ) => {
            setToast({
                message,
                type,
                id: Date.now(),
            });
        },
        []
    );


    const logout = useCallback(
        async () => {
            try {
                const base = (
                    process.env
                        .REACT_APP_API_URL ||
                    "/api"
                ).replace(
                    /\/+$/,
                    ""
                );

                await fetch(
                    `${base}/admin/logout`,
                    {
                        method: "POST",
                        credentials:
                            "include",
                        headers: {
                            Accept:
                                "application/json",
                        },
                    }
                );
            } catch {
                // Clear local state even if
                // the server request fails.
            }

            try {
                window.localStorage.removeItem(
                    "plinko-admin-user"
                );

                window.localStorage.removeItem(
                    STORAGE_KEY
                );
            } catch {
                // Ignore storage failures.
            }

            setUser(null);

            notify(
                "You have been signed out.",
                "success"
            );

            /*
             * If the project has a dedicated
             * authentication route, change this
             * to window.location.assign("/login").
             */
            window.location.reload();
        },
        [notify]
    );


    useEffect(() => {
        const handleKeyDown = (
            event
        ) => {
            /*
             * Ctrl/Cmd + K opens the dashboard.
             */
            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() ===
                    "k"
            ) {
                event.preventDefault();
                navigate("dashboard");
            }

            /*
             * Escape closes mobile sidebar.
             */
            if (
                event.key === "Escape"
            ) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [navigate]);


    const page =
        PAGE_TITLES[activePage] ||
        PAGE_TITLES.dashboard;


    const renderPage = () => {
        switch (activePage) {
            case "dashboard":
                return (
                    <Dashboard
                        onNavigate={navigate}
                    />
                );

            case "games":
                return <GamesManager />;

            case "players":
                return (
                    <PlayersManager />
                );

            case "transactions":
                return (
                    <TransactionsManager />
                );

            case "seeds":
                return <SeedsManager />;

            case "health":
                return <SystemHealth />;

            case "logs":
                return <LogsViewer />;

            case "settings":
                return (
                    <SettingsManager />
                );

            default:
                return (
                    <Dashboard
                        onNavigate={navigate}
                    />
                );
        }
    };


    return (
        <div className="app-shell">

            {sidebarOpen && (
                <div
                    className="app-sidebar-overlay"
                    onClick={() =>
                        setSidebarOpen(false)
                    }
                    aria-hidden="true"
                />
            )}


            <div
                className={
                    sidebarOpen
                        ? "app-sidebar-container open"
                        : "app-sidebar-container"
                }
            >
                <Sidebar
                    activePage={
                        activePage
                    }
                    onNavigate={
                        navigate
                    }
                />
            </div>


            <main className="app-main">

                <div className="app-mobile-header">
                    <button
                        type="button"
                        className="app-mobile-menu"
                        onClick={() =>
                            setSidebarOpen(
                                true
                            )
                        }
                        aria-label="Open navigation"
                    >
                        ☰
                    </button>

                    <div>
                        <strong>
                            Plinko-on-Pi
                        </strong>
                    </div>
                </div>


                <Header
                    title={page.title}
                    description={
                        page.description
                    }
                    user={user}
                    onLogout={
                        user
                            ? logout
                            : undefined
                    }
                />


                <div className="app-content">
                    {renderPage()}
                </div>

            </main>


            <div className="app-toast-container">
                <Toast
                    key={toast?.id}
                    message={
                        toast?.message
                    }
                    type={toast?.type}
                    onClose={() =>
                        setToast(null)
                    }
                />
            </div>

        </div>
    );
    }
