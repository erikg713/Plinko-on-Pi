-- ============================================================
-- Table: store_purchases
-- Fixed-price store purchases (drop packs, cosmetic themes)
-- funded 1:1 by completed Pi payments. Purchases never affect
-- scoring and never pay out.
-- ============================================================

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
