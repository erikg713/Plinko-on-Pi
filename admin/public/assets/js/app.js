"use strict";

/**
 * Plinko-on-Pi Admin
 * Application Controller
 *
 * Responsibilities:
 * - Initialize admin UI
 * - Navigation
 * - Authentication state
 * - API connectivity
 * - Refresh controls
 * - Mobile sidebar
 * - Search/filtering
 * - Toast notifications
 * - Keyboard shortcuts
 * - Global error handling
 */

(() => {
    "use strict";

    const App = {

        state: {
            currentPage: "dashboard",
            loading: false,
            initialized: false,
            online: false,
            lastUpdated: null
        },

        elements: {},

        /**
         * Initialize application.
         */
        async init() {

            if (this.state.initialized) {
                return;
            }

            this.cacheElements();

            this.bindNavigation();
            this.bindRefresh();
            this.bindLogout();
            this.bindMobileMenu();
            this.bindSearch();
            this.bindGlobalEvents();
            this.bindKeyboardShortcuts();

            this.state.initialized = true;

            this.restorePage();

            await this.startup();

        },

        /**
         * Cache frequently used DOM nodes.
         */
        cacheElements() {

            this.elements = {
                sidebar:
                    document.getElementById(
                        "sidebar"
                    ),

                sidebarOverlay:
                    document.getElementById(
                        "sidebarOverlay"
                    ),

                menuButton:
                    document.getElementById(
                        "menuButton"
                    ),

                refreshButton:
                    document.getElementById(
                        "refreshButton"
                    ),

                logoutButton:
                    document.getElementById(
                        "logoutButton"
                    ),

                pageTitle:
                    document.getElementById(
                        "pageTitle"
                    ),

                pageDescription:
                    document.getElementById(
                        "pageDescription"
                    ),

                lastUpdated:
                    document.getElementById(
                        "lastUpdated"
                    ),

                connectionDot:
                    document.getElementById(
                        "connectionDot"
                    ),

                connectionText:
                    document.getElementById(
                        "connectionText"
                    ),

                toastContainer:
                    document.getElementById(
                        "toastContainer"
                    )
            };
        },

        /**
         * Start application services.
         */
        async startup() {

            this.setLoading(true);

            try {

                await this.checkAuthentication();

                await this.refresh();

                this.startAutoRefresh();

            } catch (error) {

                console.error(
                    "Admin startup failed:",
                    error
                );

                this.handleError(
                    error,
                    "Unable to initialize admin dashboard."
                );

            } finally {

                this.setLoading(false);

            }
        },

        /**
         * Check whether an admin token exists.
         *
         * If the backend exposes /admin/auth/me,
         * validate it server-side.
         */
        async checkAuthentication() {

            if (
                typeof window.Auth ===
                "undefined"
            ) {
                return;
            }

            if (!Auth.isAuthenticated()) {

                /*
                 * Do not forcibly redirect here.
                 * This allows the backend to handle
                 * authentication middleware.
                 */
                this.setConnection(
                    false,
                    "Authentication required"
                );

                return;
            }

            if (
                !window.adminAPI ||
                typeof adminAPI.me !==
                "function"
            ) {
                return;
            }

            try {

                await adminAPI.me();

            } catch (error) {

                if (
                    error?.status === 401
                ) {
                    Auth.clear();

                    this.showToast(
                        "Admin session expired.",
                        "error"
                    );
                }

                throw error;
            }
        },

        /**
         * Load all dashboard data.
         */
        async refresh() {

            if (this.state.loading) {
                return;
            }

            this.setLoading(true);

            try {

                if (
                    !window.Dashboard ||
                    typeof Dashboard.loadAll !==
                    "function"
                ) {
                    throw new Error(
                        "Dashboard module is unavailable."
                    );
                }

                await Dashboard.loadAll();

                this.state.online = true;
                this.state.lastUpdated =
                    new Date();

                this.setConnection(
                    true,
                    "Connected"
                );

                this.updateLastUpdated();

            } catch (error) {

                console.error(
                    "Dashboard refresh failed:",
                    error
                );

                this.state.online = false;

                this.setConnection(
                    false,
                    "Disconnected"
                );

                throw error;

            } finally {

                this.setLoading(false);

            }
        },

        /**
         * Start automatic dashboard refresh.
         */
        startAutoRefresh() {

            this.stopAutoRefresh();

            const config =
                window.PLINKO_ADMIN_CONFIG ||
                {};

            const interval =
                Number(
                    config.AUTO_REFRESH_MS ??
                    30000
                );

            if (
                !Number.isFinite(interval) ||
                interval <= 0
            ) {
                return;
            }

            this.autoRefreshTimer =
                window.setInterval(
                    async () => {

                        if (
                            document.hidden
                        ) {
                            return;
                        }

                        try {
                            await this.refresh();
                        } catch {
                            /*
                             * Connection state is
                             * already updated by refresh().
                             */
                        }

                    },
                    interval
                );
        },

        /**
         * Stop automatic refresh.
         */
        stopAutoRefresh() {

            if (
                this.autoRefreshTimer
            ) {

                clearInterval(
                    this.autoRefreshTimer
                );

                this.autoRefreshTimer =
                    null;
            }
        },

        /**
         * Navigation event handlers.
         */
        bindNavigation() {

            document
                .querySelectorAll(
                    "[data-page]"
                )
                .forEach(element => {

                    element.addEventListener(
                        "click",
                        event => {

                            const page =
                                event.currentTarget
                                    .dataset
                                    .page;

                            if (!page) {
                                return;
                            }

                            this.showPage(
                                page
                            );
                        }
                    );
                });
        },

        /**
         * Display a page.
         */
        showPage(page) {

            const pageElement =
                document.getElementById(
                    `${page}Page`
                );

            if (!pageElement) {

                console.warn(
                    `Unknown admin page: ${page}`
                );

                return;
            }

            document
                .querySelectorAll(
                    ".page"
                )
                .forEach(element => {

                    element.classList.remove(
                        "active"
                    );
                });

            pageElement.classList.add(
                "active"
            );

            document
                .querySelectorAll(
                    ".nav-item[data-page]"
                )
                .forEach(element => {

                    element.classList.toggle(
                        "active",
                        element.dataset.page ===
                            page
                    );
                });

            const metadata = {
                dashboard: {
                    title: "Dashboard",
                    description:
                        "Plinko-on-Pi system overview"
                },

                players: {
                    title: "Players",
                    description:
                        "Registered Plinko-on-Pi users"
                },

                games: {
                    title: "Games",
                    description:
                        "Plinko game rounds"
                },

                transactions: {
                    title: "Transactions",
                    description:
                        "Pi transaction activity"
                },

                health: {
                    title: "System Health",
                    description:
                        "Backend service status"
                },

                logs: {
                    title: "Event Logs",
                    description:
                        "System and administrative events"
                }
            };

            const info =
                metadata[page] ??
                metadata.dashboard;

            this.setText(
                this.elements.pageTitle,
                info.title
            );

            this.setText(
                this.elements.pageDescription,
                info.description
            );

            this.state.currentPage =
                page;

            this.savePage(page);

            this.closeMobileMenu();

            this.dispatch(
                "admin:navigation",
                {
                    page
                }
            );
        },

        /**
         * Restore previous page.
         */
        restorePage() {

            const page =
                sessionStorage.getItem(
                    "plinko_admin_page"
                );

            this.showPage(
                page || "dashboard"
            );
        },

        /**
         * Save current page.
         */
        savePage(page) {

            sessionStorage.setItem(
                "plinko_admin_page",
                page
            );
        },

        /**
         * Refresh button.
         */
        bindRefresh() {

            this.elements
                .refreshButton
                ?.addEventListener(
                    "click",
                    async () => {

                        try {

                            await this.refresh();

                            this.showToast(
                                "Dashboard refreshed.",
                                "success"
                            );

                        } catch (error) {

                            this.handleError(
                                error,
                                "Dashboard refresh failed."
                            );
                        }
                    }
                );
        },

        /**
         * Logout button.
         */
        bindLogout() {

            this.elements
                .logoutButton
                ?.addEventListener(
                    "click",
                    async () => {

                        const confirmed =
                            window.confirm(
                                "Log out of the admin dashboard?"
                            );

                        if (!confirmed) {
                            return;
                        }

                        try {

                            if (
                                window.adminAPI &&
                                typeof adminAPI.logout ===
                                    "function"
                            ) {
                                await adminAPI.logout();
                            } else if (
                                window.Auth
                            ) {
                                Auth.clear();
                            }

                            this.stopAutoRefresh();

                            this.showToast(
                                "Logged out.",
                                "success"
                            );

                            window.setTimeout(
                                () => {
                                    window.location.reload();
                                },
                                300
                            );

                        } catch (error) {

                            console.error(
                                "Logout failed:",
                                error
                            );

                            if (
                                window.Auth
                            ) {
                                Auth.clear();
                            }

                            window.location.reload();
                        }
                    }
                );
        },

        /**
         * Mobile sidebar.
         */
        bindMobileMenu() {

            this.elements
                .menuButton
                ?.addEventListener(
                    "click",
                    () => {
                        this.openMobileMenu();
                    }
                );

            this.elements
                .sidebarOverlay
                ?.addEventListener(
                    "click",
                    () => {
                        this.closeMobileMenu();
                    }
                );
        },

        openMobileMenu() {

            this.elements
                .sidebar
                ?.classList.add(
                    "open"
                );

            this.elements
                .sidebarOverlay
                ?.classList.add(
                    "visible"
                );

            document.body.classList.add(
                "menu-open"
            );
        },

        closeMobileMenu() {

            this.elements
                .sidebar
                ?.classList.remove(
                    "open"
                );

            this.elements
                .sidebarOverlay
                ?.classList.remove(
                    "visible"
                );

            document.body.classList.remove(
                "menu-open"
            );
        },

        /**
         * Search controls.
         */
        bindSearch() {

            this.bindTableSearch(
                "playerSearch",
                "playersTable"
            );

            this.bindTableSearch(
                "gameSearch",
                "gamesTable"
            );

            this.bindTableSearch(
                "transactionSearch",
                "transactionsTable"
            );
        },

        bindTableSearch(
            inputId,
            tableId
        ) {

            const input =
                document.getElementById(
                    inputId
                );

            const table =
                document.getElementById(
                    tableId
                );

            if (!input || !table) {
                return;
            }

            input.addEventListener(
                "input",
                () => {

                    const query =
                        input.value
                            .trim()
                            .toLowerCase();

                    const rows =
                        table.querySelectorAll(
                            "tr"
                        );

                    rows.forEach(row => {

                        if (
                            row
                                .querySelector(
                                    ".empty"
                                )
                        ) {
                            return;
                        }

                        const text =
                            row.textContent
                                .toLowerCase();

                        row.hidden =
                            Boolean(query) &&
                            !text.includes(
                                query
                            );
                    });
                }
            );
        },

        /**
         * Global events.
         */
        bindGlobalEvents() {

            window.addEventListener(
                "admin:unauthorized",
                () => {

                    this.setConnection(
                        false,
                        "Unauthorized"
                    );

                    this.showToast(
                        "Your admin session has expired.",
                        "error"
                    );
                }
            );

            window.addEventListener(
                "online",
                () => {

                    this.showToast(
                        "Network connection restored.",
                        "success"
                    );

                    this.refresh()
                        .catch(() => {});
                }
            );

            window.addEventListener(
                "offline",
                () => {

                    this.setConnection(
                        false,
                        "Network offline"
                    );

                    this.showToast(
                        "Network connection lost.",
                        "error"
                    );
                }
            );

            document.addEventListener(
                "visibilitychange",
                () => {

                    if (
                        !document.hidden
                    ) {
                        this.refresh()
                            .catch(() => {});
                    }
                }
            );
        },

        /**
         * Keyboard shortcuts.
         */
        bindKeyboardShortcuts() {

            document.addEventListener(
                "keydown",
                event => {

                    /*
                     * Ignore shortcuts while typing.
                     */
                    const target =
                        event.target;

                    if (
                        target instanceof
                            HTMLInputElement ||
                        target instanceof
                            HTMLTextAreaElement ||
                        target instanceof
                            HTMLSelectElement ||
                        target?.isContentEditable
                    ) {
                        return;
                    }

                    /*
                     * R = refresh.
                     */
                    if (
                        event.key
                            .toLowerCase() ===
                        "r"
                    ) {

                        event.preventDefault();

                        this.refresh()
                            .then(() => {
                                this.showToast(
                                    "Dashboard refreshed.",
                                    "success"
                                );
                            })
                            .catch(error => {
                                this.handleError(
                                    error,
                                    "Refresh failed."
                                );
                            });
                    }

                    /*
                     * Escape = close mobile menu.
                     */
                    if (
                        event.key ===
                        "Escape"
                    ) {
                        this.closeMobileMenu();
                    }
                }
            );
        },

        /**
         * Connection indicator.
         */
        setConnection(
            online,
            text = null
        ) {

            this.state.online =
                Boolean(online);

            const dot =
                this.elements
                    .connectionDot;

            const label =
                this.elements
                    .connectionText;

            if (dot) {

                dot.classList.toggle(
                    "online",
                    online
                );

                dot.classList.toggle(
                    "offline",
                    !online
                );
            }

            if (label) {

                label.textContent =
                    text ??
                    (
                        online
                            ? "Connected"
                            : "Disconnected"
                    );
            }
        },

        /**
         * Loading state.
         */
        setLoading(loading) {

            this.state.loading =
                Boolean(loading);

            const button =
                this.elements
                    .refreshButton;

            if (!button) {
                return;
            }

            button.disabled =
                loading;

            button.textContent =
                loading
                    ? "↻ Loading..."
                    : "↻ Refresh";
        },

        /**
         * Update footer timestamp.
         */
        updateLastUpdated() {

            const element =
                this.elements
                    .lastUpdated;

            if (!element) {
                return;
            }

            if (!this.state.lastUpdated) {
                element.textContent =
                    "Never updated";

                return;
            }

            element.textContent =
                `Updated ${this.state.lastUpdated.toLocaleTimeString()}`;
        },

        /**
         * Set text safely.
         */
        setText(element, value) {

            if (!element) {
                return;
            }

            element.textContent =
                String(
                    value ?? ""
                );
        },

        /**
         * Toast notification.
         */
        showToast(
            message,
            type = "info",
            duration = 4000
        ) {

            const container =
                this.elements
                    .toastContainer;

            if (!container) {
                return;
            }

            const toast =
                document.createElement(
                    "div"
                );

            toast.className =
                `toast ${type}`;

            toast.setAttribute(
                "role",
                "status"
            );

            toast.textContent =
                String(message);

            container.appendChild(
                toast
            );

            window.setTimeout(
                () => {

                    toast.style.opacity =
                        "0";

                    toast.style.transform =
                        "translateY(8px)";

                    window.setTimeout(
                        () => {
                            toast.remove();
                        },
                        200
                    );

                },
                duration
            );
        },

        /**
         * Handle API/application errors.
         */
        handleError(
            error,
            fallbackMessage =
                "Something went wrong."
        ) {

            console.error(
                error
            );

            let message =
                fallbackMessage;

            if (error?.message) {
                message =
                    error.message;
            }

            if (
                error?.status === 401
            ) {
                message =
                    "Authentication required.";
            }

            if (
                error?.status === 403
            ) {
                message =
                    "You do not have permission to perform this action.";
            }

            if (
                error?.status === 429
            ) {
                message =
                    "Too many requests. Please wait and try again.";
            }

            if (
                error?.status >= 500
            ) {
                message =
                    "The Plinko-on-Pi server encountered an error.";
            }

            this.showToast(
                message,
                "error"
            );
        },

        /**
         * Dispatch custom application event.
         */
        dispatch(
            name,
            detail = {}
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail
                    }
                )
            );
        }
    };

    /*
     * Expose application controller.
     */
    window.PlInkoAdminApp = App;
    window.PlinkoAdminApp = App;

    /*
     * Backwards-compatible helpers.
     */
    window.showPage =
        page => App.showPage(page);

    window.showToast =
        (
            message,
            type = "info",
            duration = 4000
        ) =>
            App.showToast(
                message,
                type,
                duration
            );

    /*
     * Initialize after DOM is ready.
     */
    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => App.init(),
            {
                once: true
            }
        );

    } else {

        App.init();

    }

})();
