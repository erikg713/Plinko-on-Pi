import React from "react";

export default function Loading({
    message = "Loading...",
    fullPage = false,
}) {
    return (
        <div
            className={
                fullPage
                    ? "app-loading app-loading-full"
                    : "app-loading"
            }
            role="status"
            aria-live="polite"
        >
            <span
                className="app-spinner"
                aria-hidden="true"
            />

            <span>
                {message}
            </span>
        </div>
    );
}
