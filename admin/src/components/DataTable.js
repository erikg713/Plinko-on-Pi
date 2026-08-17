import React from "react";

export default function DataTable({
    columns = [],
    rows = [],
    rowKey,
    loading = false,
    emptyMessage = "No records found.",
    onRowClick,
}) {
    return (
        <div className="app-table-wrapper">
            <table className="app-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {loading ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="empty"
                            >
                                Loading...
                            </td>
                        </tr>
                    ) : rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="empty"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, index) => (
                            <tr
                                key={
                                    rowKey
                                        ? rowKey(row, index)
                                        : row.id || index
                                }
                                onClick={() =>
                                    onRowClick?.(row)
                                }
                                style={{
                                    cursor: onRowClick
                                        ? "pointer"
                                        : undefined,
                                }}
                            >
                                {columns.map(
                                    (column) => (
                                        <td
                                            key={
                                                column.key
                                            }
                                        >
                                            {column.render
                                                ? column.render(
                                                      row,
                                                      index
                                                  )
                                                : row[
                                                      column.key
                                                  ] ?? "—"}
                                        </td>
                                    )
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
