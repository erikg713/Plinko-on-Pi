import React from "react";

const DEFAULT_ITEMS = [
    {
        id: "dashboard",
        label: "Dashboard",
        icon: "▦",
    },
    {
        id: "games",
        label: "Games",
        icon: "◆",
    },
    {
        id: "players",
        label: "Players",
        icon: "●",
    },
    {
        id: "transactions",
        label: "Transactions",
        icon: "$",
    },
    {
        id: "seeds",
        label: "Seeds",
        icon: "◇",
    },
    {
        id: "health",
        label: "System Health",
        icon: "+",
    },
    {
        id: "logs",
        label: "Logs",
        icon: "≡",
    },
    {
        id: "settings",
        label: "Settings",
        icon: "⚙",
    },
];

export default function Sidebar({
    activePage = "dashboard",
    onNavigate,
    items = DEFAULT_ITEMS,
}) {
    return (
        <aside className="app-sidebar">
            <div className="app-sidebar-brand">
                <div className="app-brand-mark">
                    π
                </div>

                <div>
                    <div className="app-brand-name">
                        Plinko-on-Pi
                    </div>

                    <div className="app-brand-subtitle">
                        Admin
                    </div>
                </div>
            </div>

            <nav
                className="app-sidebar-nav"
                aria-label="Admin navigation"
            >
                {items.map((item) => {
                    const active =
                        item.id ===
                        activePage;

                    return (
                        <button
                            type="button"
                            key={item.id}
                            className={
                                active
                                    ? "app-nav-item active"
                                    : "app-nav-item"
                            }
                            onClick={() =>
                                onNavigate?.(
                                    item.id
                                )
                            }
                        >
                            <span
                                className="app-nav-icon"
                                aria-hidden="true"
                            >
                                {item.icon}
                            </span>

                            <span>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
