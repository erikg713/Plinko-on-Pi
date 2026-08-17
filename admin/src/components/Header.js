import React from "react";

export default function Header({
    title = "Dashboard",
    description,
    user,
    onRefresh,
    loading = false,
    onLogout,
}) {
    return (
        <header className="app-header">

            <div className="app-header-title">

                <h1>
                    {title}
                </h1>

                {description && (
                    <p>
                        {description}
                    </p>
                )}

            </div>


            <div className="app-header-actions">

                {onRefresh && (
                    <button
                        type="button"
                        className="app-button"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        {loading
                            ? "Refreshing..."
                            : "Refresh"}
                    </button>
                )}


                {user && (
                    <div className="app-user-menu">

                        <div className="app-user-avatar">
                            {String(
                                user.name ||
                                user.username ||
                                "A"
                            )
                                .charAt(0)
                                .toUpperCase()}
                        </div>

                        <div>
                            <div className="app-user-name">
                                {
                                    user.name ||
                                    user.username ||
                                    "Administrator"
                                }
                            </div>

                            {user.role && (
                                <div className="app-user-role">
                                    {user.role}
                                </div>
                            )}
                        </div>

                        {onLogout && (
                            <button
                                type="button"
                                className="app-button app-button-small"
                                onClick={
                                    onLogout
                                }
                            >
                                Logout
                            </button>
                        )}

                    </div>
                )}

            </div>

        </header>
    );
}
