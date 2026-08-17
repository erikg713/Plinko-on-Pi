-- UP

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    external_id TEXT NOT NULL UNIQUE,

    username TEXT NOT NULL UNIQUE,

    display_name TEXT,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'suspended',
                'banned',
                'closed'
            )
        ),

    balance NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (balance >= 0),

    total_wagered NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (total_wagered >= 0),

    total_won NUMERIC(28, 8) NOT NULL DEFAULT 0
        CHECK (total_won >= 0),

    total_games BIGINT NOT NULL DEFAULT 0
        CHECK (total_games >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_players_status
    ON players(status);

CREATE INDEX IF NOT EXISTS idx_players_created_at
    ON players(created_at);

CREATE INDEX IF NOT EXISTS idx_players_external_id
    ON players(external_id);

-- DOWN

DROP TABLE IF EXISTS players;
