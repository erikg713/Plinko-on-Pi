-- ============================================================
-- Table: games
-- Pi Web3 Plinko Game Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,

    game_uuid UUID NOT NULL UNIQUE,

    player_uid UUID NOT NULL,

    pi_username VARCHAR(64) NOT NULL,

    game_type VARCHAR(20) NOT NULL DEFAULT 'PLINKO',

    risk_level VARCHAR(10) NOT NULL
        CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

    rows INTEGER NOT NULL
        CHECK (rows BETWEEN 8 AND 16),

    server_seed_hash VARCHAR(128) NOT NULL,

    server_seed VARCHAR(128),

    client_seed VARCHAR(128),

    nonce BIGINT NOT NULL DEFAULT 0,

    total_bets INTEGER NOT NULL DEFAULT 0,

    total_wager NUMERIC(18,8) NOT NULL DEFAULT 0,

    total_payout NUMERIC(18,8) NOT NULL DEFAULT 0,

    total_profit NUMERIC(18,8) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'FINISHED',
                'CANCELLED'
            )
        ),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_games_player
ON games(player_uid);

CREATE INDEX IF NOT EXISTS idx_games_username
ON games(pi_username);

CREATE INDEX IF NOT EXISTS idx_games_status
ON games(status);

CREATE INDEX IF NOT EXISTS idx_games_started
ON games(started_at);

CREATE INDEX IF NOT EXISTS idx_games_type
ON games(game_type);
