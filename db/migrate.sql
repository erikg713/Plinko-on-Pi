-- ============================================================
-- Pi Plinko Database Migration
-- ============================================================

BEGIN;

\i tables/players.sql
\i tables/wallets.sql
\i tables/game_settings.sql
\i tables/multipliers.sql
\i tables/games.sql
\i tables/bets.sql
\i tables/plinko_drops.sql
\i tables/transactions.sql
\i tables/provably_fair.sql
\i tables/rewards.sql
\i tables/leaderboards.sql
\i tables/achievements.sql
\i tables/referrals.sql
\i tables/sessions.sql
\i tables/audit_logs.sql

COMMIT;
