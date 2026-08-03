CREATE TABLE IF NOT EXISTS rewards (

    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL,

    reward_type VARCHAR(30)
    CHECK (
        reward_type IN(
            'DAILY',
            'LEVEL',
            'ACHIEVEMENT',
            'REFERRAL',
            'BONUS'
        )
    ),

    amount NUMERIC(18,8)
        NOT NULL,

    claimed BOOLEAN DEFAULT FALSE,

    claimed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_rewards_player
ON rewards(player_uid);
