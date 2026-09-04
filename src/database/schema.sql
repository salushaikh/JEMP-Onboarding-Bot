-- JOBLESS EMPIRE (JEMP)
-- SHARED POSTGRESQL DATABASE SCHEMA (SYSTEM OF RECORD)
-- CANONICAL MEMBERSHIP, ONBOARDING, RESUME, TIMELINE & OUTBOX ARCHITECTURE

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Atomic Sequence for permanent, sequential, concurrency-safe JEMP# IDs
CREATE SEQUENCE IF NOT EXISTS jemp_member_seq START 1 INCREMENT 1;

-- 1. Applications Registry
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(64) PRIMARY KEY, -- e.g. APP#0042
    applicant_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_normalized_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    expiration_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_email_hash ON applications(email_normalized_hash);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- 2. Members Registry
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jemp_id VARCHAR(32) UNIQUE, -- e.g. JEMP#001
    discord_user_id VARCHAR(64) UNIQUE,
    application_id VARCHAR(64) REFERENCES applications(id),
    name VARCHAR(255) NOT NULL,
    email_normalized_hash VARCHAR(64) NOT NULL,
    timezone VARCHAR(64),
    membership_status VARCHAR(32) NOT NULL DEFAULT 'APPLIED',
    current_resume_id UUID,
    rules_version_accepted VARCHAR(32),
    rules_accepted_at TIMESTAMP WITH TIME ZONE,
    safety_acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_members_jemp_id ON members(jemp_id);
CREATE INDEX IF NOT EXISTS idx_members_discord_user_id ON members(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(membership_status);
CREATE INDEX IF NOT EXISTS idx_members_email_hash ON members(email_normalized_hash);

-- 3. Membership Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS membership_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    previous_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    reason TEXT,
    actor VARCHAR(128) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_membership_history_member ON membership_status_history(member_id);

-- 4. Persistent Onboarding Sessions
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id VARCHAR(64) NOT NULL UNIQUE,
    application_id VARCHAR(64) REFERENCES applications(id),
    member_id UUID REFERENCES members(id),
    current_step VARCHAR(64) NOT NULL DEFAULT 'EMAIL_REQUIRED',
    staged_name VARCHAR(255),
    staged_timezone VARCHAR(64),
    rules_accepted BOOLEAN DEFAULT FALSE,
    safety_acknowledged BOOLEAN DEFAULT FALSE,
    attempts_count INT DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_discord ON onboarding_sessions(discord_user_id);

-- 5. Resume Files & Versioning
CREATE TABLE IF NOT EXISTS resume_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    application_id VARCHAR(64) NOT NULL REFERENCES applications(id),
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    storage_provider VARCHAR(32) NOT NULL DEFAULT 'local',
    storage_key VARCHAR(512) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'CURRENT', -- 'CURRENT', 'ARCHIVED', 'REMOVED'
    data_base64 TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_resume_files_member ON resume_files(member_id);
CREATE INDEX IF NOT EXISTS idx_resume_files_status ON resume_files(member_id, status);

-- 6. Timeline Proof-of-Work Events (Idempotent)
CREATE TABLE IF NOT EXISTS timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(64) NOT NULL DEFAULT 'onboarding',
    source_event_id VARCHAR(255) NOT NULL UNIQUE, -- idempotency key e.g. onboarding:{member_id}:{event}
    event_type VARCHAR(64) NOT NULL,
    member_id UUID REFERENCES members(id),
    jemp_id VARCHAR(32),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_source_event ON timeline_events(source_event_id);
CREATE INDEX IF NOT EXISTS idx_timeline_member_id ON timeline_events(member_id);

-- 7. Cross-Bot Outbox Events
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(64) NOT NULL,
    aggregate_type VARCHAR(32) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);

-- 8. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(128) NOT NULL,
    target VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'onboarding_bot',
    relevant_ids JSONB DEFAULT '{}',
    safe_metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- 9. Key-Value Settings & Channel Bindings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
