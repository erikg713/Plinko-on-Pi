-- UP

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL
        REFERENCES players(id)
        ON DELETE RESTRICT,

    game_id UUID
        REFERENCES games(id)
        ON DELETE SET NULL,

    type TEXT NOT NULL
        CHECK (
            type IN (
                'deposit',
                'withdrawal',
                'wager',
                'payout',
                'refund',
                'adjustment'
            )
        ),

    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'pending',
                'completed',
                'failed',
                'reversed'
            )
        ),

    amount NUMERIC(28, 8) NOT NULL
        CHECK (amount > 0),

    balance_before NUMERIC(28, 8) NOT NULL
        CHECK (balance_before >= 0),

    balance_after NUMERIC(28, 8) NOT NULL
        CHECK (balance_after >= 0),

    reference TEXT UNIQUE,

    idempotency_key TEXT UNIQUE,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transactions_player_id
    ON transactions(player_id);

CREATE INDEX IF NOT EXISTS idx_transactions_game_id
    ON transactions(game_id);

CREATE INDEX IF NOT EXISTS idx_transactions_type
    ON transactions(type);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_metadata
    ON transactions USING GIN(metadata);

-- DOWN

DROP TABLE IF EXISTS transactions;
