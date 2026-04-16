-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  plan_tier VARCHAR(50) DEFAULT 'free',
  storage_used BIGINT DEFAULT 0,
  storage_limit BIGINT DEFAULT 1073741824, -- 1GB default
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user'
);

-- Vaults Table
CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  encryption_salt VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_synced TIMESTAMP WITH TIME ZONE,
  storage_used BIGINT DEFAULT 0
);

-- Vault Files Table
CREATE TABLE IF NOT EXISTS vault_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  encrypted_content_url TEXT,
  file_hash VARCHAR(64),
  file_size BIGINT DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(vault_id, file_path)
);

-- Shared Documents Table
CREATE TABLE IF NOT EXISTS shared_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES vault_files(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  permission_type VARCHAR(50) NOT NULL, -- public_view, public_edit, private
  password_hash VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Permissions Table (for collaboration)
CREATE TABLE IF NOT EXISTS document_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shared_document_id UUID REFERENCES shared_documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Nullable for public access if needed, but usually specific users
  role VARCHAR(50) NOT NULL, -- owner, editor, commenter, viewer
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  granted_by UUID REFERENCES users(id)
);

-- File Versions Table
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES vault_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  encrypted_content_url TEXT,
  author_id UUID REFERENCES users(id),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  file_size BIGINT
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID, -- Foreign key if plans table exists, or just a string reference
  status VARCHAR(50) NOT NULL, -- active, canceled, expired, trialing
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id VARCHAR(255),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Plan backup policy controls (admin-managed)
CREATE TABLE IF NOT EXISTS plan_backup_policies (
  plan_tier VARCHAR(50) PRIMARY KEY,
  full_vault_backup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_frequencies TEXT NOT NULL DEFAULT 'manual,daily',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Per-user backup preferences, validated against plan policy
CREATE TABLE IF NOT EXISTS user_backup_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_vault_backup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  backup_frequency VARCHAR(20) NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed defaults for common plan tiers
INSERT INTO plan_backup_policies (plan_tier, full_vault_backup_enabled, allowed_frequencies)
VALUES
  ('free', FALSE, 'manual,daily'),
  ('starter', TRUE, 'manual,daily,weekly'),
  ('pro', TRUE, 'manual,hourly,daily,weekly,realtime'),
  ('teams', TRUE, 'manual,hourly,daily,weekly,realtime')
ON CONFLICT (plan_tier) DO NOTHING;

-- Vault Configuration Backups Table
CREATE TABLE IF NOT EXISTS vault_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  encrypted_config_blob TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

