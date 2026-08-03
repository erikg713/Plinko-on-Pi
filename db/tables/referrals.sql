-- ============================================================
-- Table: referrals
-- Pi player referral system
-- ============================================================

CREATE TABLE IF NOT EXISTS referrals (

    id BIGSERIAL PRIMARY KEY,

    referrer_uid UUID NOT NULL,

    referred_uid UUID NOT NULL UNIQUE,

    referral_code VARCHAR(32)
        NOT NULL,

    status VARCHAR(20)
        DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'ACTIVE',
                'REWARDED'
            )
        ),

    reward_amount NUMERIC(18,8)
        DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    rewarded_at TIMESTAMPTZ
);


CREATE INDEX idx_referrer
ON referrals(referrer_uid);


CREATE INDEX idx_referred
ON referrals(referred_uid);


CREATE INDEX idx_referral_code
ON referrals(referral_code);
