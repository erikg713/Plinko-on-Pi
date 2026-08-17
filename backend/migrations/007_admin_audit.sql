-- UP

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admin_id TEXT,

    action TEXT NOT NULL,

    resource_type TEXT,

    resource_id TEXT,

    request_id TEXT,

    ip_address INET,

    user_agent TEXT,

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin
    ON admin_audit_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action
    ON admin_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_admin_audit_resource
    ON admin_audit_log(
        resource_type,
        resource_id
    );

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
    ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_details
    ON admin_audit_log USING GIN(details);

-- DOWN

DROP TABLE IF EXISTS admin_audit_log;
