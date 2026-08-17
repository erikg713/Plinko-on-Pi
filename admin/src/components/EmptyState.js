import React from "react";

export default function EmptyState({
    title = "Nothing here yet",
    message = "There is no data to display.",
    action,
}) {
    return (
        <div className="app-empty-state">
            <div
                className="app-empty-icon"
                aria-hidden="true"
            >
                ∅
            </div>

            <h3>
                {title}
            </h3>

            <p>
                {message}
            </p>

            {action && (
                <div className="app-empty-action">
                    {action}
                </div>
            )}
        </div>
    );
}
