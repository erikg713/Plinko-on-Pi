-- ============================================================
-- Table: plinko_drops
-- Individual Plinko ball drops
-- ============================================================

CREATE TABLE IF NOT EXISTS plinko_drops (
    id BIGSERIAL PRIMARY KEY,

    game_id BIGINT NOT NULL
        REFERENCES games(id) ON DELETE CASCADE,

    bet_id BIGINT NOT NULL
        REFERENCES bets(id) ON DELETE CASCADE,

    player_uid UUID NOT NULL,

    drop_number INTEGER NOT NULL,

    rows INTEGER NOT NULL
        CHECK (rows BETWEEN 8 AND 16),

    risk_level VARCHAR(10) NOT NULL
        CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

    ball_path JSONB NOT NULL,

    final_slot INTEGER NOT NULL,

    multiplier NUMERIC(10,4) NOT NULL,

    wager NUMERIC(18,8) NOT NULL,

    payout NUMERIC(18,8) NOT NULL,

    profit NUMERIC(18,8) NOT NULL,

    server_seed_hash VARCHAR(128) NOT NULL,

    client_seed VARCHAR(128),

    nonce BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_plinko_drops_game
ON plinko_drops(game_id);

CREATE INDEX IF NOT EXISTS idx_plinko_drops_bet
ON plinko_drops(bet_id);

CREATE INDEX IF NOT EXISTS idx_plinko_drops_player
ON plinko_drops(player_uid);

CREATE INDEX IF NOT EXISTS idx_plinko_drops_created
ON plinko_drops(created_at);
