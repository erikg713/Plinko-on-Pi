-- UP

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_metadata (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_metadata (key, value)
VALUES (
    'application',
    'plinko-on-pi'
)
ON CONFLICT (key) DO NOTHING;

-- DOWN

DROP TABLE IF EXISTS schema_metadata;
