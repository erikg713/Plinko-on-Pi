-- name=db/tables/bets.sql
-- Improved bets table for Pi Web3 Plinko
-- - stronger types (ENUMs)
-- - additional constraints
-- - updated_at timestamp + trigger
-- - GIN index for JSONB
-- - composite & partial indexes for common queries

-- Create enums (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level_enum') THEN
        CREATE TYPE risk_level_enum AS ENUM ('LOW','MEDIUM','HIGH');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_result_enum') THEN
        CREATE TYPE game_result_enum AS ENUM ('WIN','LOSE','PUSH');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bet_status_enum') THEN
        CREATE TYPE bet_status_enum AS ENUM ('PENDING','COMPLETED','FAILED','CANCELLED');
    END IF;
END
$$ LANGUAGE plpgsql;

-- Main table
CREATE TABLE IF NOT EXISTS bets (
    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL, -- consider FK to players(id) if available

    pi_username VARCHAR(64) NOT NULL, -- consider CITEXT for case-insensitive comparisons

    wager NUMERIC(18,8) NOT NULL CHECK (wager > 0),

    risk_level risk_level_enum NOT NULL,

    rows SMALLINT NOT NULL CHECK (rows BETWEEN 8 AND 16),

    slot SMALLINT NOT NULL CHECK (slot >= 0), -- refine to a rows-derived upper bound per game rules

    multiplier NUMERIC(10,4) NOT NULL CHECK (multiplier >= 0),

    payout NUMERIC(18,8) NOT NULL CHECK (payout >= 0),

    profit NUMERIC(18,8) NOT NULL, -- profit may be negative on losses; keep as-is if desired

    ball_path JSONB NOT NULL,

    seed_hash VARCHAR(128) NOT NULL, -- you may want to store as TEXT if lengths vary

    client_seed VARCHAR(128),

    nonce BIGINT NOT NULL,

    game_result game_result_enum NOT NULL,

    pi_txid VARCHAR(128),

    status bet_status_enum NOT NULL DEFAULT 'COMPLETED',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Optional: enforce player relation if you have a players table
    -- CONSTRAINT fk_bets_player FOREIGN KEY (player_uid) REFERENCES players(id) ON DELETE CASCADE

    -- Optional uniqueness: prevent duplicate seed+nonce collisions (uncomment if appropriate)
    -- UNIQUE (seed_hash, nonce)
);

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bets_set_updated_at ON bets;
CREATE TRIGGER trg_bets_set_updated_at
BEFORE UPDATE ON bets
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bets_player_created
ON bets (player_uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bets_username
ON bets (pi_username);

CREATE INDEX IF NOT EXISTS idx_bets_created
ON bets (created_at);

CREATE INDEX IF NOT EXISTS idx_bets_status
ON bets (status);

-- Partial index for fast lookup of pending bets (very common)
CREATE INDEX IF NOT EXISTS idx_bets_pending
ON bets (created_at)
WHERE status = 'PENDING';

-- Index on pi_txid, only when present
CREATE INDEX IF NOT EXISTS idx_bets_txid
ON bets (pi_txid)
WHERE pi_txid IS NOT NULL;

-- GIN index for JSONB queries on ball_path (useful if you query by properties)
CREATE INDEX IF NOT EXISTS idx_bets_ball_path_gin
ON bets USING gin (ball_path);

-- Optional: enforce no duplicate seed_hash+nonce (uncomment if you want uniqueness)
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_bets_seed_nonce
-- ON bets (seed_hash, nonce);
