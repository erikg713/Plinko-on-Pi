import React, {
    useEffect,
} from "react";

export default function Modal({
    open,
    title,
    children,
    footer,
    onClose,
    width = "560px",
}) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const previous =
            document.body.style.overflow;

        document.body.style.overflow =
            "hidden";

        const handleKeyDown = (
            event
        ) => {
            if (
                event.key === "Escape"
            ) {
                onClose?.();
            }
        };

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.body.style.overflow =
                previous;

            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        open,
        onClose,
    ]);

    if (!open) {
        return null;
    }

    return (
        <div
            className="app-modal-backdrop"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose?.();
                }
            }}
        >
            <div
                className="app-modal"
                style={{
                    width: "min(100% - 32px, " +
                        width +
                        ")",
                }}
                role="dialog"
                aria-modal="true"
            >
                <header className="app-modal-header">
                    <h2>
                        {title}
                    </h2>

                    <button
                        type="button"
                        className="app-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </header>

                <div className="app-modal-body">
                    {children}
                </div>

                {footer && (
                    <footer className="app-modal-footer">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
}
