CREATE OR REPLACE VIEW wallet_balance_view AS

SELECT

w.player_uid,

p.pi_username,

w.available_balance,

w.locked_balance,

w.total_deposited,

w.total_withdrawn,

w.lifetime_profit

FROM wallets w

JOIN players p

ON p.player_uid=w.player_uid;
