CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_key TEXT NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    agent_id VARCHAR(128),
    user_id VARCHAR(128) NOT NULL,
    memory_key VARCHAR(255) NOT NULL,
    memory_type VARCHAR(64) NOT NULL DEFAULT 'fact',
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
    importance DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    source_session_id VARCHAR(255),
    source_run_id VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope_key, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_owner
    ON agent_memories (tenant_id, user_id, agent_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memories_scope_updated
    ON agent_memories (scope_key, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding_hnsw
    ON agent_memories USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL AND deleted_at IS NULL;
