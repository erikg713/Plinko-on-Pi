CREATE TABLE IF NOT EXISTS provably_fair (

    id BIGSERIAL PRIMARY KEY,

    game_id BIGINT NOT NULL
        REFERENCES games(id)
        ON DELETE CASCADE,

    server_seed_hash VARCHAR(128)
        NOT NULL,

    server_seed VARCHAR(128),

    client_seed VARCHAR(128),

    nonce BIGINT NOT NULL DEFAULT 0,

    hash_algorithm VARCHAR(50)
        DEFAULT 'SHA256',

    verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    verified_at TIMESTAMPTZ
);


CREATE INDEX idx_fair_game
ON provably_fair(game_id);
