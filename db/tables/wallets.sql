-- ============================================================
-- Table: wallets
-- Pi Web3 Player Wallet Management
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL UNIQUE,

    pi_username VARCHAR(64) NOT NULL UNIQUE,

    pi_wallet_address VARCHAR(128),

    pi_account_verified BOOLEAN NOT NULL DEFAULT FALSE,

    available_balance NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (available_balance >= 0),

    locked_balance NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (locked_balance >= 0),

    total_wagered NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (total_wagered >= 0),

    total_won NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (total_won >= 0),

    total_lost NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (total_lost >= 0),

    total_withdrawn NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (total_withdrawn >= 0),

    total_deposited NUMERIC(18,8) NOT NULL DEFAULT 0
        CHECK (total_deposited >= 0),

    lifetime_profit NUMERIC(18,8) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'LOCKED',
                'SUSPENDED'
            )
        ),

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wallets_player
ON wallets(player_uid);

CREATE INDEX IF NOT EXISTS idx_wallets_username
ON wallets(pi_username);

CREATE INDEX IF NOT EXISTS idx_wallets_address
ON wallets(pi_wallet_address);

CREATE INDEX IF NOT EXISTS idx_wallets_status
ON wallets(status);

-- ============================================================
-- Auto update timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallet_updated_at ON wallets;

CREATE TRIGGER trg_wallet_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION update_wallet_updated_at();
