-- ============================================================
-- Table: drop_inventory
-- Player drop inventory: free regenerating drops, purchased
-- drops (from fixed-price store packs), and owned cosmetic
-- board themes.
-- ============================================================

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
