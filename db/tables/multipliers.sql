-- ============================================================
-- Table: multipliers
-- Plinko payout multipliers
-- ============================================================

CREATE TABLE IF NOT EXISTS multipliers (
    id BIGSERIAL PRIMARY KEY,

    rows INTEGER NOT NULL
        CHECK (rows BETWEEN 8 AND 16),

    risk_level VARCHAR(10) NOT NULL
        CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

    slot INTEGER NOT NULL,

    multiplier NUMERIC(10,4) NOT NULL
        CHECK (multiplier >= 0),

    UNIQUE (rows, risk_level, slot)
);

CREATE INDEX IF NOT EXISTS idx_multipliers_rows
ON multipliers(rows);

CREATE INDEX IF NOT EXISTS idx_multipliers_risk
ON multipliers(risk_level);

CREATE INDEX IF NOT EXISTS idx_multipliers_lookup
ON multipliers(rows, risk_level, slot);
