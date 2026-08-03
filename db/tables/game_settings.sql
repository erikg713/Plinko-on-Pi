CREATE TABLE IF NOT EXISTS game_settings (

    id BIGSERIAL PRIMARY KEY,

    setting_key VARCHAR(100)
        UNIQUE NOT NULL,

    setting_value JSONB NOT NULL,

    description TEXT,

    enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);


INSERT INTO game_settings
(setting_key, setting_value, description)
VALUES

(
'plinko_limits',
'{
 "min_bet":0.1,
 "max_bet":1000,
 "min_rows":8,
 "max_rows":16
}',
'Plinko game limits'
),

(
'house_edge',
'{
 "percentage":3
}',
'Casino house edge'
)

ON CONFLICT DO NOTHING;
