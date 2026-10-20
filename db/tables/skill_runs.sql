-- ============================================================
-- Table: skill_runs
-- Aimed skill drops. Scored in POINTS ONLY — nothing here is
-- convertible to Pi or anything of value.
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL
        REFERENCES players(id)
        ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'scored', 'expired')),

    drop_x NUMERIC(8, 6) NOT NULL
        CHECK (drop_x >= 0 AND drop_x <= 1),

    rows INTEGER NOT NULL
        CHECK (rows BETWEEN 8 AND 16),

    spread TEXT NOT NULL DEFAULT 'medium'
        CHECK (spread IN ('low', 'medium', 'high')),

    target_bin INTEGER NOT NULL,

    sweep_ms INTEGER NOT NULL DEFAULT 2400,

    path TEXT,
    result_bin INTEGER,
    release_ms INTEGER,

    base_points INTEGER NOT NULL DEFAULT 0,
    target_bonus INTEGER NOT NULL DEFAULT 0,
    streak_bonus INTEGER NOT NULL DEFAULT 0,
    aim_bonus INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,

    hit_target BOOLEAN NOT NULL DEFAULT FALSE,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_skill_runs_player
ON skill_runs(player_id);

CREATE INDEX IF NOT EXISTS idx_skill_runs_status
ON skill_runs(status);

CREATE INDEX IF NOT EXISTS idx_skill_runs_started
ON skill_runs(started_at);
