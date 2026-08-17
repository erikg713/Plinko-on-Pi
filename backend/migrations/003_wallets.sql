-- UP

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL UNIQUE
        REFERENCES players(id)
        ON DELETE CASCADE,

    currency TEXT NOT NULL DEFAULT 'PI',

    available_balance NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (available_balance >= 0),

    locked_balance NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (locked_balance >= 0),

    total_deposited NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (total_deposited >= 0),

    total_withdrawn NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (total_withdrawn >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wallets_currency_check
        CHECK (currency <> '')
);

CREATE INDEX IF NOT EXISTS idx_wallets_player_id
    ON wallets(player_id);

CREATE INDEX IF NOT EXISTS idx_wallets_currency
    ON wallets(currency);

-- DOWN

DROP TABLE IF EXISTS wallets;
