-- UP

/*
 * Pi Platform payments (U2A deposits).
 *
 * Every wager must settle against exactly one completed Pi
 * payment. used_by_game_id enforces the 1:1 link so a single
 * Pi payment can never fund two bets (no double-spend).
 */
CREATE TABLE IF NOT EXISTS pi_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL
        REFERENCES players(id)
        ON DELETE RESTRICT,

    pi_payment_id TEXT NOT NULL UNIQUE,

    amount NUMERIC(28, 8) NOT NULL
        CHECK (amount > 0),

    memo TEXT,

    status TEXT NOT NULL DEFAULT 'created'
        CHECK (
            status IN (
                'created',
                'approved',
                'completed',
                'cancelled',
                'failed'
            )
        ),

    txid TEXT,

    used_by_game_id UUID
        REFERENCES games(id)
        ON DELETE RESTRICT,

    raw JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_payments_player
    ON pi_payments(player_id);

CREATE INDEX IF NOT EXISTS idx_pi_payments_status
    ON pi_payments(status);

CREATE INDEX IF NOT EXISTS idx_pi_payments_pi_id
    ON pi_payments(pi_payment_id);

/*
 * Link each settled game to the Pi payment that funded it.
 */
ALTER TABLE games
    ADD COLUMN IF NOT EXISTS payment_id TEXT
        REFERENCES pi_payments(pi_payment_id)
        ON DELETE RESTRICT;

/*
 * Provably-fair rounds: commit BEFORE the bet.
 *
 * A round is created first (server_seed stored server-side,
 * only the hash is exposed). The bet references the round;
 * settlement derives the outcome from
 * HMAC-SHA256(serverSeed, clientSeed + "-" + nonce),
 * then reveals the server seed.
 */
ALTER TABLE provably_fair_rounds
    ADD COLUMN IF NOT EXISTS player_id UUID
        REFERENCES players(id)
        ON DELETE CASCADE;

ALTER TABLE provably_fair_rounds
    ADD COLUMN IF NOT EXISTS server_seed TEXT;

ALTER TABLE provably_fair_rounds
    ALTER COLUMN game_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pf_player
    ON provably_fair_rounds(player_id);

-- DOWN

ALTER TABLE provably_fair_rounds
    DROP COLUMN IF EXISTS server_seed;

ALTER TABLE provably_fair_rounds
    DROP COLUMN IF EXISTS player_id;

ALTER TABLE games
    DROP COLUMN IF EXISTS payment_id;

DROP TABLE IF EXISTS pi_payments;
