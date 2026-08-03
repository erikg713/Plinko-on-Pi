-- ============================================================
-- Table: sessions
-- Player authentication sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (

    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL,

    session_token VARCHAR(255)
        UNIQUE NOT NULL,

    ip_address INET,

    user_agent TEXT,

    expires_at TIMESTAMPTZ NOT NULL,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    last_activity TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_sessions_player
ON sessions(player_uid);


CREATE INDEX idx_sessions_token
ON sessions(session_token);


CREATE INDEX idx_sessions_active
ON sessions(active);
