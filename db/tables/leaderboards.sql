-- ============================================================
-- Table: leaderboards
-- Player rankings and competitions
-- ============================================================

CREATE TABLE IF NOT EXISTS leaderboards (

    id BIGSERIAL PRIMARY KEY,

    player_uid UUID NOT NULL,

    leaderboard_type VARCHAR(30) NOT NULL
        CHECK (
            leaderboard_type IN (
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'ALL_TIME'
            )
        ),

    rank INTEGER NOT NULL DEFAULT 0,

    score NUMERIC(18,8) NOT NULL DEFAULT 0,

    total_wagered NUMERIC(18,8) DEFAULT 0,

    total_won NUMERIC(18,8) DEFAULT 0,

    total_profit NUMERIC(18,8) DEFAULT 0,

    games_played INTEGER DEFAULT 0,

    wins INTEGER DEFAULT 0,

    period_start TIMESTAMPTZ NOT NULL,

    period_end TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(
        player_uid,
        leaderboard_type,
        period_start
    )
);


CREATE INDEX IF NOT EXISTS idx_leaderboard_player
ON leaderboards(player_uid);


CREATE INDEX IF NOT EXISTS idx_leaderboard_rank
ON leaderboards(rank);


CREATE INDEX IF NOT EXISTS idx_leaderboard_type
ON leaderboards(leaderboard_type);
