import React from "react";

export default function ErrorState({
    title = "Something went wrong",
    message = "Unable to load this section.",
    onRetry,
}) {
    return (
        <div
            className="app-alert app-alert-error"
            role="alert"
        >
            <strong>
                {title}
            </strong>

            <div style={{ marginTop: "4px" }}>
                {message}
            </div>

            {onRetry && (
                <button
                    type="button"
                    className="app-button app-button-small"
                    style={{
                        marginTop: "10px",
                    }}
                    onClick={onRetry}
                >
                    Retry
                </button>
            )}
        </div>
    );
}
