CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL UNIQUE,

    pi_user_id VARCHAR(128) UNIQUE NOT NULL,

    pi_username VARCHAR(64) UNIQUE NOT NULL,

    avatar_url TEXT,

    email VARCHAR(255),

    level INTEGER NOT NULL DEFAULT 1,

    xp BIGINT NOT NULL DEFAULT 0,

    total_games INTEGER DEFAULT 0,

    total_wins INTEGER DEFAULT 0,

    total_losses INTEGER DEFAULT 0,

    status VARCHAR(20) DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'BANNED',
                'SUSPENDED'
            )
        ),

    last_seen TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_players_uid
ON players(player_uid);


CREATE INDEX IF NOT EXISTS idx_players_pi_user
ON players(pi_user_id);


CREATE INDEX IF NOT EXISTS idx_players_username
ON players(pi_username);
