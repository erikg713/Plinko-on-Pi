import React, {
    useEffect,
} from "react";

export default function ConfirmDialog({
    open,
    title = "Confirm action",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false,
    loading = false,
    onConfirm,
    onCancel,
}) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (
            event
        ) => {
            if (event.key === "Escape") {
                onCancel?.();
            }

            if (
                event.key === "Enter" &&
                !loading
            ) {
                onConfirm?.();
            }
        };

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        open,
        loading,
        onCancel,
        onConfirm,
    ]);

    if (!open) {
        return null;
    }

    return (
        <div
            className="app-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onCancel?.();
                }
            }}
        >
            <div
                className="app-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
            >
                <div className="app-modal-header">
                    <h2 id="confirm-dialog-title">
                        {title}
                    </h2>
                </div>

                <div className="app-modal-body">
                    {message}
                </div>

                <div className="app-modal-footer">
                    <button
                        type="button"
                        className="app-button"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>

                    <button
                        type="button"
                        className={
                            danger
                                ? "app-button app-button-danger"
                                : "app-button app-button-primary"
                        }
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading
                            ? "Processing..."
                            : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
