-- UP

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL
        REFERENCES players(id)
        ON DELETE RESTRICT,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'completed',
                'cancelled',
                'failed'
            )
        ),

    bet_amount NUMERIC(28, 8) NOT NULL
        CHECK (bet_amount > 0),

    payout_amount NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (payout_amount >= 0),

    multiplier NUMERIC(20, 8) NOT NULL DEFAULT 0
        CHECK (multiplier >= 0),

    profit NUMERIC(28, 8) NOT NULL DEFAULT 0,

    rows INTEGER NOT NULL
        CHECK (rows BETWEEN 1 AND 100),

    risk TEXT NOT NULL
        CHECK (
            risk IN (
                'low',
                'medium',
                'high'
            )
        ),

    result_slot INTEGER,

    path TEXT,

    nonce BIGINT,

    server_seed_hash TEXT,

    client_seed TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_games_player_id
    ON games(player_id);

CREATE INDEX IF NOT EXISTS idx_games_status
    ON games(status);

CREATE INDEX IF NOT EXISTS idx_games_created_at
    ON games(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_player_created
    ON games(player_id, created_at DESC);

-- DOWN

DROP TABLE IF EXISTS games;
