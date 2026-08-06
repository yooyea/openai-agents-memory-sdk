export type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
};

export async function database(): Promise<D1DatabaseLike> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Persistent database is unavailable.");
  return env.DB as unknown as D1DatabaseLike;
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

async function addMissingColumns(
  db: D1DatabaseLike,
  table: string,
  definitions: Record<string, string>,
) {
  const columns = (await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results;
  const existing = new Set(columns.map((column) => column.name));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!existing.has(name)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}

export async function ensureSchema() {
  const db = await database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      return_to TEXT NOT NULL DEFAULT '/',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_secrets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      last_four TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      workspace_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'gpt-5-mini',
      memory_enabled INTEGER NOT NULL DEFAULT 1,
      memory_mode TEXT NOT NULL DEFAULT 'background',
      tools_json TEXT NOT NULL DEFAULT '["current_time","calculator"]',
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_versions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_deployments (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_version_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      environment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_version_id TEXT,
      environment TEXT NOT NULL DEFAULT 'production',
      owner_email TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_id TEXT,
      owner_email TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      memory_key TEXT,
      content TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'preference',
      confidence INTEGER NOT NULL DEFAULT 90,
      importance INTEGER NOT NULL DEFAULT 50,
      source TEXT NOT NULL DEFAULT 'conversation',
      source_session_id TEXT,
      expires_at TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_version_id TEXT,
      owner_email TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      input_text TEXT NOT NULL,
      output_text TEXT,
      error TEXT,
      recalled_count INTEGER NOT NULL DEFAULT 0,
      tool_call_count INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS memory_jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      input_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
  ]);

  await addMissingColumns(db, "agents", {
    workspace_id: "TEXT",
    memory_mode: "TEXT NOT NULL DEFAULT 'background'",
    tools_json: "TEXT NOT NULL DEFAULT '[\"current_time\",\"calculator\"]'",
  });
  await addMissingColumns(db, "sessions", {
    agent_version_id: "TEXT",
    environment: "TEXT NOT NULL DEFAULT 'production'",
  });
  await addMissingColumns(db, "messages", { run_id: "TEXT" });
  await addMissingColumns(db, "memories", {
    memory_key: "TEXT",
    importance: "INTEGER NOT NULL DEFAULT 50",
    source: "TEXT NOT NULL DEFAULT 'conversation'",
    expires_at: "TEXT",
    deleted_at: "TEXT",
  });

  await db.batch([
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS oauth_accounts_provider_idx ON oauth_accounts(provider, provider_account_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx ON oauth_accounts(user_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_idx ON auth_sessions(token_hash)"),
    db.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id, expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS user_secrets_user_kind_idx ON user_secrets(user_id, kind)"),
    db.prepare("CREATE INDEX IF NOT EXISTS agents_owner_idx ON agents(owner_email, updated_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS versions_agent_number_idx ON agent_versions(agent_id, version)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS deployments_agent_env_idx ON agent_deployments(agent_id, environment)"),
    db.prepare("CREATE INDEX IF NOT EXISTS sessions_owner_idx ON sessions(owner_email, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS memories_scope_idx ON memories(owner_email, agent_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS runs_owner_idx ON agent_runs(owner_email, created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS run_events_sequence_idx ON agent_run_events(run_id, sequence)"),
    db.prepare("CREATE INDEX IF NOT EXISTS memory_jobs_status_idx ON memory_jobs(owner_email, status, created_at)"),
  ]);
  return db;
}

export async function workspaceFor(owner: string) {
  const db = await ensureSchema();
  let workspace = await db.prepare("SELECT * FROM workspaces WHERE owner_email = ?").bind(owner).first<Record<string, unknown>>();
  if (!workspace) {
    const workspaceId = id("wsp");
    await db.prepare("INSERT INTO workspaces (id, owner_email, name) VALUES (?, ?, ?)")
      .bind(workspaceId, owner, "Personal workspace").run();
    workspace = await db.prepare("SELECT * FROM workspaces WHERE id = ?").bind(workspaceId).first<Record<string, unknown>>();
  }
  return workspace!;
}

export function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status });
}
