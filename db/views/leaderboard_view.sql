CREATE OR REPLACE VIEW leaderboard_view AS

SELECT

player_uid,

pi_username,

SUM(total_profit) AS profit,

SUM(total_won) AS winnings,

SUM(games_played) AS games

FROM leaderboards l

JOIN players p

USING(player_uid)

GROUP BY

player_uid,
pi_username

ORDER BY profit DESC;
