-- UP

/*
 * Skill-game rework (no wagering).
 *
 * New tables for aimed skill runs, drop inventory, store
 * purchases, and skill leaderboards. All scoring is in POINTS —
 * nothing here is convertible to Pi or anything of value.
 *
 * Existing wager tables (bets, games, provably_fair_rounds,
 * wallets, multipliers) are left untouched so historical data
 * is preserved; the wager API routes were removed.
 */

/* One aimed drop. Submitted results are scored in points only. */
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

/* Per-player skill aggregates for leaderboards. */
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

    /* Sum of per-run aim accuracy (0..1); avg = aim_total / total_runs */
    aim_total NUMERIC(18, 6) NOT NULL DEFAULT 0,

    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* Drop inventory: free regenerating drops + purchased drops + themes. */
CREATE TABLE IF NOT EXISTS drop_inventory (
    player_id UUID PRIMARY KEY
        REFERENCES players(id)
        ON DELETE CASCADE,

    free_drops INTEGER NOT NULL DEFAULT 20
        CHECK (free_drops >= 0),

    purchased_drops INTEGER NOT NULL DEFAULT 0
        CHECK (purchased_drops >= 0),

    themes TEXT[] NOT NULL DEFAULT ARRAY['midnight'],

    next_regen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* Fixed-price store purchases funded by completed Pi payments. */
CREATE TABLE IF NOT EXISTS store_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL
        REFERENCES players(id)
        ON DELETE RESTRICT,

    item_id TEXT NOT NULL,
    item_kind TEXT NOT NULL
        CHECK (item_kind IN ('drops', 'theme')),

    pi_payment_id TEXT NOT NULL UNIQUE
        REFERENCES pi_payments(pi_payment_id)
        ON DELETE RESTRICT,

    price_pi NUMERIC(28, 8) NOT NULL
        CHECK (price_pi > 0),

    idempotency_key TEXT NOT NULL UNIQUE,

    granted JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_purchases_player
    ON store_purchases(player_id);

/*
 * Link a Pi payment to the store purchase it funded (1:1, same
 * anti-double-spend pattern the old wager flow used).
 */
ALTER TABLE pi_payments
    ADD COLUMN IF NOT EXISTS used_by_purchase_id UUID
        REFERENCES store_purchases(id)
        ON DELETE RESTRICT;

-- DOWN

ALTER TABLE pi_payments
    DROP COLUMN IF EXISTS used_by_purchase_id;

DROP TABLE IF EXISTS store_purchases;
DROP TABLE IF EXISTS drop_inventory;
DROP TABLE IF EXISTS skill_stats;
DROP TABLE IF EXISTS skill_runs;
