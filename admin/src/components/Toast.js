import React, {
    useEffect,
} from "react";

export default function Toast({
    message,
    type = "info",
    duration = 4000,
    onClose,
}) {
    useEffect(() => {
        if (!message) {
            return undefined;
        }

        const timer =
            window.setTimeout(
                () => {
                    onClose?.();
                },
                duration
            );

        return () =>
            window.clearTimeout(
                timer
            );
    }, [
        message,
        duration,
        onClose,
    ]);

    if (!message) {
        return null;
    }

    const normalized =
        String(type)
            .toLowerCase();

    const className =
        normalized === "success"
            ? "app-toast app-toast-success"
            : normalized === "error"
              ? "app-toast app-toast-error"
              : normalized ===
                  "warning"
                ? "app-toast app-toast-warning"
                : "app-toast";

    return (
        <div
            className={className}
            role={
                normalized ===
                "error"
                    ? "alert"
                    : "status"
            }
        >
            <span>
                {message}
            </span>

            <button
                type="button"
                className="app-toast-close"
                onClick={onClose}
                aria-label="Dismiss notification"
            >
                ×
            </button>
        </div>
    );
}
