CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pi_uid TEXT UNIQUE NOT NULL,
    username TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
