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

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const STORAGE_KEY =
    "plinko-admin-active-page";

const USER_STORAGE_KEY =
    "plinko-admin-user";

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the API base URL from environment or default to /api
 */
function getApiBaseUrl() {
    const url = (
        process.env.REACT_APP_API_URL || "/api"
    ).replace(/\/+$/, "");

    return url;
}

/**
 * Safely retrieve the initially saved page from localStorage
 * Validates the page exists in PAGE_TITLES before returning
 */
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
    } catch (error) {
        console.warn(
            "Failed to read localStorage for initial page:",
            error
        );
    }

    return "dashboard";
}

/**
 * Safely retrieve the stored admin user from localStorage
 * Returns null if not found or if parsing fails
 */
function getAdminUser() {
    try {
        const raw =
            window.localStorage.getItem(
                USER_STORAGE_KEY
            );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.warn(
            "Failed to parse admin user from localStorage:",
            error
        );

        return null;
    }
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Custom hook for managing keyboard shortcuts
 * Handles:
 * - Ctrl/Cmd + K: Navigate to dashboard
 * - Escape: Close mobile sidebar
 */
function useKeyboardShortcuts(navigate, setSidebarOpen) {
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Ctrl/Cmd + K opens the dashboard
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {
                event.preventDefault();
                navigate("dashboard");
            }

            // Escape closes mobile sidebar
            if (event.key === "Escape") {
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
    }, [navigate, setSidebarOpen]);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function App() {
    // ========================================================================
    // STATE
    // ========================================================================

    const [activePage, setActivePage] =
        useState(getInitialPage);

    const [user, setUser] =
        useState(getAdminUser);

    const [toast, setToast] =
        useState(null);

    const [sidebarOpen, setSidebarOpen] =
        useState(false);

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    /**
     * Navigate to a page, validate it exists, and persist the choice
     */
    const navigate = useCallback(
        (page) => {
            if (!PAGE_TITLES[page]) {
                console.warn(
                    `Invalid page: ${page}`
                );

                return;
            }

            setActivePage(page);
            setSidebarOpen(false);

            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    page
                );
            } catch (error) {
                console.error(
                    "Failed to save page to localStorage:",
                    error
                );
            }

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        },
        []
    );

    /**
     * Display a toast notification with optional type
     * Types: 'info', 'success', 'error', 'warning'
     */
    const notify = useCallback(
        (message, type = "info") => {
            setToast({
                message,
                type,
                id: Date.now(),
            });
        },
        []
    );

    /**
     * Logout the admin user:
     * 1. Attempt to call the backend logout endpoint
     * 2. Clear localStorage (even if backend call fails)
     * 3. Clear app state
     * 4. Notify user
     * 5. Reload page to reset app
     */
    const logout = useCallback(
        async () => {
            try {
                const base = getApiBaseUrl();

                const response = await fetch(
                    `${base}/admin/logout`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            Accept:
                                "application/json",
                        },
                    }
                );

                if (!response.ok) {
                    console.error(
                        `Logout request failed with status ${response.status}`
                    );
                }
            } catch (error) {
                console.error(
                    "Failed to call logout endpoint:",
                    error
                );
            }

            // Clear local storage regardless of server response
            try {
                window.localStorage.removeItem(
                    USER_STORAGE_KEY
                );

                window.localStorage.removeItem(
                    STORAGE_KEY
                );
            } catch (error) {
                console.error(
                    "Failed to clear localStorage on logout:",
                    error
                );
            }

            // Clear app state
            setUser(null);

            // Notify user
            notify(
                "You have been signed out.",
                "success"
            );

            // Reload page to reset app state
            // TODO: Consider routing to /login instead of full reload
            // if the project has a dedicated authentication route
            window.location.reload();
        },
        [notify]
    );

    // ========================================================================
    // EFFECTS
    // ========================================================================

    /**
     * Set up keyboard shortcut listeners
     */
    useKeyboardShortcuts(navigate, setSidebarOpen);

    /**
     * Guard against unauthenticated access
     * If user is not present after initial load, redirect to login
     */
    useEffect(() => {
        // Only check after initial render
        // This gives time for getAdminUser to run
        if (user === null) {
            // TODO: Implement proper authentication flow
            // Options:
            // 1. window.location.assign('/login') - redirect to login page
            // 2. Show auth modal within the app
            // 3. Check backend session and fetch user data

            console.warn(
                "No authenticated user found. Consider implementing auth guard."
            );
        }
    }, []);

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================

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

    // ========================================================================
    // MAIN RENDER
    // ========================================================================

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
                        aria-label="Open navigation menu"
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
