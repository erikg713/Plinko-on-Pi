import React from "react";

export default function StatCard({
    title,
    value,
    description,
    icon = "•",
    trend,
    loading = false,
}) {
    const numericTrend =
        typeof trend === "number"
            ? trend
            : Number(trend);

    const hasTrend =
        Number.isFinite(numericTrend);

    return (
        <article className="app-stat-card">
            <div className="app-stat-header">
                <span className="app-stat-label">
                    {title}
                </span>

                <span
                    className="app-stat-icon"
                    aria-hidden="true"
                >
                    {icon}
                </span>
            </div>

            {loading ? (
                <div
                    className="app-skeleton"
                    style={{
                        height: "30px",
                        width: "65%",
                        marginTop: "8px",
                    }}
                />
            ) : (
                <div className="app-stat-value">
                    {value ?? "—"}
                </div>
            )}

            {(description || hasTrend) && (
                <div className="app-stat-description">
                    {description}

                    {hasTrend && (
                        <span
                            style={{
                                marginLeft: "7px",
                                fontWeight: 700,
                                color:
                                    numericTrend >= 0
                                        ? "var(--app-success)"
                                        : "var(--app-danger)",
                            }}
                        >
                            {numericTrend >= 0
                                ? "↑"
                                : "↓"}{" "}
                            {Math.abs(
                                numericTrend
                            ).toFixed(2)}
                            %
                        </span>
                    )}
                </div>
            )}
        </article>
    );
                  }
