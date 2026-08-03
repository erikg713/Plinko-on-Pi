-- ============================================================
-- Table: transactions
-- Pi Web3 Game Financial Ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,

    transaction_uuid UUID NOT NULL UNIQUE,

    player_uid UUID NOT NULL,

    pi_username VARCHAR(64) NOT NULL,

    transaction_type VARCHAR(20) NOT NULL
        CHECK (
            transaction_type IN (
                'BET',
                'WIN',
                'LOSS',
                'REFUND',
                'BONUS',
                'WITHDRAWAL',
                'DEPOSIT'
            )
        ),

    amount NUMERIC(18,8) NOT NULL
        CHECK (amount >= 0),

    balance_before NUMERIC(18,8),

    balance_after NUMERIC(18,8),

    game_id BIGINT
        REFERENCES games(id)
        ON DELETE SET NULL,

    bet_id BIGINT
        REFERENCES bets(id)
        ON DELETE SET NULL,

    pi_txid VARCHAR(128),

    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            payment_status IN (
                'PENDING',
                'CONFIRMED',
                'FAILED',
                'CANCELLED'
            )
        ),

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    confirmed_at TIMESTAMPTZ
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_player
ON transactions(player_uid);

CREATE INDEX IF NOT EXISTS idx_transactions_username
ON transactions(pi_username);

CREATE INDEX IF NOT EXISTS idx_transactions_type
ON transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_transactions_status
ON transactions(payment_status);

CREATE INDEX IF NOT EXISTS idx_transactions_game
ON transactions(game_id);

CREATE INDEX IF NOT EXISTS idx_transactions_bet
ON transactions(bet_id);

CREATE INDEX IF NOT EXISTS idx_transactions_pi_txid
ON transactions(pi_txid);

CREATE INDEX IF NOT EXISTS idx_transactions_created
ON transactions(created_at);
