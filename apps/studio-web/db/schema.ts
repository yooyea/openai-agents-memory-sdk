import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  ...timestamps,
  lastLoginAt: text("last_login_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(), ...timestamps,
}, (table) => [uniqueIndex("oauth_accounts_provider_idx").on(table.provider, table.providerAccountId), index("oauth_accounts_user_idx").on(table.userId)]);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("auth_sessions_user_idx").on(table.userId, table.expiresAt)]);

export const oauthStates = sqliteTable("oauth_states", {
  id: text("id").primaryKey(), provider: text("provider").notNull(), returnTo: text("return_to").notNull().default("/"),
  expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("oauth_states_expiry_idx").on(table.expiresAt)]);

export const userSecrets = sqliteTable("user_secrets", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), kind: text("kind").notNull(),
  ciphertext: text("ciphertext").notNull(), iv: text("iv").notNull(), lastFour: text("last_four").notNull(), ...timestamps,
}, (table) => [uniqueIndex("user_secrets_user_kind_idx").on(table.userId, table.kind)]);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  workspaceId: text("workspace_id"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull(),
  model: text("model").notNull().default("gpt-5-mini"),
  memoryEnabled: integer("memory_enabled").notNull().default(1),
  memoryMode: text("memory_mode").notNull().default("background"),
  toolsJson: text("tools_json").notNull().default('["current_time","calculator"]'),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(0),
  ...timestamps,
});

export const agentVersions = sqliteTable("agent_versions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("versions_agent_number_idx").on(table.agentId, table.version)]);

export const agentDeployments = sqliteTable("agent_deployments", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  agentVersionId: text("agent_version_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  environment: text("environment").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [uniqueIndex("deployments_agent_env_idx").on(table.agentId, table.environment)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  agentVersionId: text("agent_version_id"),
  environment: text("environment").notNull().default("production"),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  ...timestamps,
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  runId: text("run_id"),
  ownerEmail: text("owner_email").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  memoryKey: text("memory_key"),
  content: text("content").notNull(),
  kind: text("kind").notNull().default("preference"),
  confidence: integer("confidence").notNull().default(90),
  importance: integer("importance").notNull().default(50),
  source: text("source").notNull().default("conversation"),
  sourceSessionId: text("source_session_id"),
  expiresAt: text("expires_at"),
  deletedAt: text("deleted_at"),
  ...timestamps,
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentVersionId: text("agent_version_id"),
  ownerEmail: text("owner_email").notNull(),
  status: text("status").notNull(),
  model: text("model").notNull(),
  inputText: text("input_text").notNull(),
  outputText: text("output_text"),
  error: text("error"),
  recalledCount: integer("recalled_count").notNull().default(0),
  toolCallCount: integer("tool_call_count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});

export const agentRunEvents = sqliteTable("agent_run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  sequence: integer("sequence").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("run_events_sequence_idx").on(table.runId, table.sequence)]);

export const memoryJobs = sqliteTable("memory_jobs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  runId: text("run_id").notNull(),
  agentId: text("agent_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  inputText: text("input_text").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});
