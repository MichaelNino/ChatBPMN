-- ChatBPMN Database Schema

CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    bpmn_xml    TEXT NOT NULL,       -- Raw BPMN 2.0 XML
    svg         TEXT,                -- Rendered SVG string
    embedding   BLOB,                -- Float32 vector (RAG)
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id         TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_session  ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created  ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_created ON workflows(created_at);
