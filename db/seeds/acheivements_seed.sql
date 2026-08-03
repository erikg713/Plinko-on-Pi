INSERT INTO achievements
(
achievement_key,
name,
description,
requirement,
reward_amount
)
VALUES

(
'first_drop',
'First Drop',
'Complete your first Plinko game',
'{
 "games":1
}',
1
),

(
'100_games',
'Plinko Veteran',
'Play 100 games',
'{
 "games":100
}',
10
),

(
'big_win',
'Jackpot Hit',
'Win a 50x multiplier',
'{
 "multiplier":50
}',
25
),

(
'whale_player',
'High Roller',
'Wager 1000 Pi',
'{
 "wager":1000
}',
50
)

ON CONFLICT(achievement_key)
DO NOTHING;
