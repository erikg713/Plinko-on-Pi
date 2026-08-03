-- ============================================================================
-- Pi Network Plinko Game - Users Table Schema
-- ============================================================================
-- Purpose: Manages user accounts with Pi Network integration for web3 gaming
-- Author: Dev713
-- Version: 2.0 (Production-Ready)
-- ============================================================================

-- Drop existing objects if they exist (safe for migrations)
DROP TRIGGER IF EXISTS users_update_timestamp ON users CASCADE;
DROP FUNCTION IF EXISTS update_timestamp() CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- Main Users Table
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pi Network Integration
    pi_uid TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL CONSTRAINT username_min_length CHECK (LENGTH(username) >= 3),
    email TEXT UNIQUE,
    
    -- Web3 & Blockchain
    wallet_address TEXT UNIQUE,
    pi_balance NUMERIC(20, 8) DEFAULT 0 NOT NULL,
    
    -- Account Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    kyc_verified BOOLEAN DEFAULT false NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- Indexes for Performance Optimization
-- ============================================================================
CREATE INDEX idx_users_pi_uid 
    ON users(pi_uid);

CREATE INDEX idx_users_wallet 
    ON users(wallet_address);

CREATE INDEX idx_users_is_active 
    ON users(is_active);

CREATE INDEX idx_users_created_at 
    ON users(created_at DESC);

-- ============================================================================
-- Automatic Timestamp Update Function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger for Automatic Timestamp Updates
-- ============================================================================
CREATE TRIGGER users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- Table & Column Documentation
-- ============================================================================
COMMENT ON TABLE users IS 
    'Pi Network user accounts integrated with Plinko web3 gaming platform. 
     Manages authentication, wallet integration, and account status.';

COMMENT ON COLUMN users.id IS 
    'Unique universal identifier (UUID v4) - primary key';

COMMENT ON COLUMN users.pi_uid IS 
    'Pi Network unique identifier - immutable, used for Pi authentication';

COMMENT ON COLUMN users.username IS 
    'Display name, minimum 3 characters, required';

COMMENT ON COLUMN users.email IS 
    'User email address - optional, unique when provided';

COMMENT ON COLUMN users.wallet_address IS 
    'Pi Network blockchain wallet address - unique when provided';

COMMENT ON COLUMN users.pi_balance IS 
    'User Pi token balance (8 decimal precision), defaults to 0';

COMMENT ON COLUMN users.is_active IS 
    'Soft delete flag - false disables account access (default: true)';

COMMENT ON COLUMN users.kyc_verified IS 
    'Know Your Customer verification status for Pi Network compliance (default: false)';

COMMENT ON COLUMN users.created_at IS 
    'Account creation timestamp - automatically set, never updated';

COMMENT ON COLUMN users.updated_at IS 
    'Last modification timestamp - automatically updated on every change';
