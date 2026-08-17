-- UP

CREATE TABLE IF NOT EXISTS provably_fair_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    game_id UUID NOT NULL UNIQUE
        REFERENCES games(id)
        ON DELETE CASCADE,

    server_seed_hash TEXT NOT NULL,

    client_seed TEXT NOT NULL,

    nonce BIGINT NOT NULL
        CHECK (nonce >= 0),

    algorithm TEXT NOT NULL DEFAULT 'sha256',

    hmac_algorithm TEXT NOT NULL DEFAULT 'sha256',

    result_hash TEXT,

    revealed BOOLEAN NOT NULL DEFAULT FALSE,

    revealed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pf_game_id
    ON provably_fair_rounds(game_id);

CREATE INDEX IF NOT EXISTS idx_pf_server_hash
    ON provably_fair_rounds(server_seed_hash);

CREATE INDEX IF NOT EXISTS idx_pf_revealed
    ON provably_fair_rounds(revealed);

CREATE TABLE IF NOT EXISTS server_seed_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    seed_hash TEXT NOT NULL UNIQUE,

    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    retired_at TIMESTAMPTZ,

    revealed_at TIMESTAMPTZ,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'retired',
                'revealed'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_seed_rotations_status
    ON server_seed_rotations(status);

-- DOWN

DROP TABLE IF EXISTS server_seed_rotations;
DROP TABLE IF EXISTS provably_fair_rounds;
