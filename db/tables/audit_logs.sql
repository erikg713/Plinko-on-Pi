-- ============================================================
-- Table: audit_logs
-- Security and anti-cheat logging
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (

    id BIGSERIAL PRIMARY KEY,

    player_uid UUID,

    event_type VARCHAR(50)
        NOT NULL,

    severity VARCHAR(20)
        DEFAULT 'INFO'
        CHECK (
            severity IN(
                'INFO',
                'WARNING',
                'CRITICAL'
            )
        ),

    event_data JSONB DEFAULT '{}'::jsonb,

    ip_address INET,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_audit_player
ON audit_logs(player_uid);


CREATE INDEX idx_audit_event
ON audit_logs(event_type);


CREATE INDEX idx_audit_time
ON audit_logs(created_at);
