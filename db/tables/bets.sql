-- ============================================================
-- Table: bets
-- Pi Web3 Plinko
-- ============================================================

CREATE TABLE IF NOT EXISTS bets (
    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL,

    pi_username VARCHAR(64) NOT NULL,

    wager NUMERIC(18,8) NOT NULL CHECK (wager > 0),

    risk_level VARCHAR(10) NOT NULL
        CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

    rows INTEGER NOT NULL
        CHECK (rows BETWEEN 8 AND 16),

    slot INTEGER NOT NULL,

    multiplier NUMERIC(10,4) NOT NULL,

    payout NUMERIC(18,8) NOT NULL,

    profit NUMERIC(18,8) NOT NULL,

    ball_path JSONB NOT NULL,

    seed_hash VARCHAR(128) NOT NULL,

    client_seed VARCHAR(128),

    nonce BIGINT NOT NULL,

    game_result VARCHAR(20) NOT NULL
        CHECK (game_result IN ('WIN', 'LOSE', 'PUSH')),

    pi_txid VARCHAR(128),

    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN (
            'PENDING',
            'COMPLETED',
            'FAILED',
            'CANCELLED'
        )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bets_player
ON bets(player_uid);

CREATE INDEX IF NOT EXISTS idx_bets_username
ON bets(pi_username);

CREATE INDEX IF NOT EXISTS idx_bets_created
ON bets(created_at);

CREATE INDEX IF NOT EXISTS idx_bets_status
ON bets(status);

CREATE INDEX IF NOT EXISTS idx_bets_txid
ON bets(pi_txid);
