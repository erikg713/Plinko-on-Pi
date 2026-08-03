CREATE OR REPLACE VIEW player_stats AS

SELECT

p.player_uid,

p.pi_username,

COUNT(b.id) AS total_bets,

COALESCE(
SUM(b.wager),
0
) AS total_wagered,

COALESCE(
SUM(b.payout),
0
) AS total_paid,

COALESCE(
SUM(b.profit),
0
) AS profit,

COUNT(
CASE
WHEN b.game_result='WIN'
THEN 1
END
) AS wins

FROM players p

LEFT JOIN bets b

ON p.player_uid=b.player_uid

GROUP BY

p.player_uid,
p.pi_username;
