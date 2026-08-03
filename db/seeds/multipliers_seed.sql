-- 8 row LOW risk example

INSERT INTO multipliers
(rows,risk_level,slot,multiplier)
VALUES

(8,'LOW',0,5.60),
(8,'LOW',1,2.10),
(8,'LOW',2,1.40),
(8,'LOW',3,1.10),
(8,'LOW',4,0.80),
(8,'LOW',5,1.10),
(8,'LOW',6,1.40),
(8,'LOW',7,2.10),
(8,'LOW',8,5.60)

ON CONFLICT(rows,risk_level,slot)
DO UPDATE SET
multiplier = EXCLUDED.multiplier;


-- 8 row HIGH risk

INSERT INTO multipliers
(rows,risk_level,slot,multiplier)
VALUES

(8,'HIGH',0,25),
(8,'HIGH',1,8),
(8,'HIGH',2,3),
(8,'HIGH',3,0.5),
(8,'HIGH',4,0.2),
(8,'HIGH',5,0.5),
(8,'HIGH',6,3),
(8,'HIGH',7,8),
(8,'HIGH',8,25)

ON CONFLICT(rows,risk_level,slot)
DO UPDATE SET
multiplier = EXCLUDED.multiplier;
