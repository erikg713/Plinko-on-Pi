INSERT INTO game_settings
(setting_key, setting_value, description)
VALUES

(
'plinko',
'{
 "enabled": true,
 "min_rows": 8,
 "max_rows": 16,
 "min_bet": 0.1,
 "max_bet": 1000
}',
'Main Plinko configuration'
),

(
'security',
'{
 "max_daily_loss": 5000,
 "anti_cheat": true
}',
'Security configuration'
),

(
'pi_payment',
'{
 "confirmation_required": true,
 "timeout_seconds":300
}',
'Pi payment rules'
)

ON CONFLICT(setting_key)
DO UPDATE SET
setting_value = EXCLUDED.setting_value;
