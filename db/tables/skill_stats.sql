-- ============================================================
-- Table: skill_stats
-- Per-player skill aggregates for the leaderboards (points,
-- streaks, aim accuracy). No money, no payouts.
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_stats (
    player_id UUID PRIMARY KEY
        REFERENCES players(id)
        ON DELETE CASCADE,

    total_runs BIGINT NOT NULL DEFAULT 0,
    total_points BIGINT NOT NULL DEFAULT 0,
    best_run_points INTEGER NOT NULL DEFAULT 0,

    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    target_hits BIGINT NOT NULL DEFAULT 0,

    -- Sum of per-run aim accuracy (0..1); avg = aim_total / total_runs
    aim_total NUMERIC(18, 6) NOT NULL DEFAULT 0,

    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
