import { database, ensureSchema, id } from "./_lib";

export type OAuthProvider = "github" | "google";
export type AuthUser = { id: string; email: string; name: string; avatarUrl: string | null; provider?: string };

const SESSION_COOKIE = "ams_session";
const STATE_COOKIE = "ams_oauth_state";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export class AuthenticationError extends Error {
  status = 401;
}

type HeaderReader = { get(name: string): string | null };

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function sqlTime(date: Date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function cookieValue(headers: HeaderReader, name: string) {
  const cookie = headers.get("cookie") || "";
  for (const item of cookie.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function sessionCookie(value: string, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function stateCookie(value: string, maxAge = 600) {
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() { return sessionCookie("", 0); }
export function clearStateCookie() { return stateCookie("", 0); }

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return (env || {}) as unknown as Record<string, unknown>;
}

export async function providerStatus(origin?: string) {
  const env = await runtimeEnv();
  const baseUrl = String(env.OAUTH_BASE_URL || origin || "").replace(/\/$/, "");
  return {
    baseUrl,
    github: {
      configured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      callbackUrl: baseUrl ? `${baseUrl}/api/oauth/github/callback` : "",
    },
    google: {
      configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      callbackUrl: baseUrl ? `${baseUrl}/api/oauth/google/callback` : "",
    },
  };
}

export async function providerConfiguration(provider: OAuthProvider, origin: string) {
  const env = await runtimeEnv();
  const status = await providerStatus(origin);
  const prefix = provider.toUpperCase();
  const clientId = String(env[`${prefix}_CLIENT_ID`] || "");
  const clientSecret = String(env[`${prefix}_CLIENT_SECRET`] || "");
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth is not configured`);
  return { clientId, clientSecret, baseUrl: status.baseUrl || origin, redirectUri: status[provider].callbackUrl };
}

export async function getCurrentUser(headers: HeaderReader): Promise<AuthUser | null> {
  const token = cookieValue(headers, SESSION_COOKIE);
  if (!token) return null;
  const db = await ensureSchema();
  const tokenHash = await hashToken(token);
  const row = await db.prepare(`SELECT u.id, u.email, u.name, u.avatar_url, oa.provider
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    LEFT JOIN oauth_accounts oa ON oa.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
    ORDER BY oa.updated_at DESC LIMIT 1`).bind(tokenHash).first<Record<string, unknown>>();
  if (!row) return null;
  await db.prepare("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?").bind(tokenHash).run();
  return { id: String(row.id), email: String(row.email), name: String(row.name), avatarUrl: row.avatar_url ? String(row.avatar_url) : null, provider: row.provider ? String(row.provider) : undefined };
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  return user;
}

export async function resolveRequestIdentity(request: Request) {
  const user = await getCurrentUser(request.headers);
  const status = await providerStatus(new URL(request.url).origin);
  const authEnabled = status.github.configured || status.google.configured;
  if (user) return { user, authenticated: true, authEnabled };
  if (authEnabled) throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  return {
    user: { id: "usr_legacy", email: "local@agent-memory.studio", name: "Local builder", avatarUrl: null } satisfies AuthUser,
    authenticated: false,
    authEnabled: false,
  };
}

export async function createOAuthState(provider: OAuthProvider, returnTo: string) {
  const db = await ensureSchema();
  const state = randomToken();
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  await db.prepare("DELETE FROM oauth_states WHERE expires_at <= CURRENT_TIMESTAMP").run();
  await db.prepare("INSERT INTO oauth_states (id, provider, return_to, expires_at) VALUES (?, ?, ?, ?)")
    .bind(state, provider, safeReturnTo, sqlTime(new Date(Date.now() + 10 * 60 * 1000))).run();
  return { state, cookie: stateCookie(state) };
}

export async function consumeOAuthState(headers: HeaderReader, provider: OAuthProvider, receivedState: string) {
  const cookieState = cookieValue(headers, STATE_COOKIE);
  if (!receivedState || !cookieState || receivedState !== cookieState) throw new Error("OAuth state mismatch");
  const db = await ensureSchema();
  const row = await db.prepare("SELECT return_to FROM oauth_states WHERE id = ? AND provider = ? AND expires_at > CURRENT_TIMESTAMP")
    .bind(receivedState, provider).first<{ return_to: string }>();
  await db.prepare("DELETE FROM oauth_states WHERE id = ?").bind(receivedState).run();
  if (!row) throw new Error("OAuth state expired");
  return row.return_to;
}

export async function upsertOAuthUser(profile: { provider: OAuthProvider; accountId: string; email: string; name: string; avatarUrl?: string | null }) {
  const db = await ensureSchema();
  const email = profile.email.trim().toLowerCase();
  if (!email) throw new Error("OAuth provider did not return a verified email address");
  let user = await db.prepare(`SELECT u.* FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id
    WHERE oa.provider = ? AND oa.provider_account_id = ? LIMIT 1`).bind(profile.provider, profile.accountId).first<Record<string, unknown>>();
  if (!user) user = await db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").bind(email).first<Record<string, unknown>>();
  const userId = user ? String(user.id) : id("usr");
  if (user) {
    await db.prepare("UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(email, profile.name || email, profile.avatarUrl || null, userId).run();
  } else {
    await db.prepare("INSERT INTO users (id, email, name, avatar_url) VALUES (?, ?, ?, ?)")
      .bind(userId, email, profile.name || email, profile.avatarUrl || null).run();
  }
  await db.prepare(`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id)
    VALUES (?, ?, ?, ?) ON CONFLICT(provider, provider_account_id) DO UPDATE SET
      user_id = excluded.user_id, updated_at = CURRENT_TIMESTAMP`)
    .bind(id("oac"), userId, profile.provider, profile.accountId).run();
  return { id: userId, email, name: profile.name || email, avatarUrl: profile.avatarUrl || null, provider: profile.provider } satisfies AuthUser;
}

export async function createAuthSession(userId: string) {
  const db = await ensureSchema();
  const token = randomToken();
  const tokenHash = await hashToken(token);
  await db.prepare("DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
  await db.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id("aus"), userId, tokenHash, sqlTime(new Date(Date.now() + SESSION_SECONDS * 1000))).run();
  return sessionCookie(token);
}

export async function revokeAuthSession(headers: HeaderReader) {
  const token = cookieValue(headers, SESSION_COOKIE);
  if (!token) return;
  const db = await ensureSchema();
  await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
}

async function encryptionKey() {
  const env = await runtimeEnv();
  const encoded = String(env.API_KEY_ENCRYPTION_KEY || "");
  if (!encoded) throw new Error("API_KEY_ENCRYPTION_KEY is not configured");
  const raw = base64ToBytes(encoded);
  if (raw.length !== 32) throw new Error("API_KEY_ENCRYPTION_KEY must be 32 bytes encoded as base64");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function saveOpenAIKey(userId: string, apiKey: string) {
  const value = apiKey.trim();
  if (!/^sk-[A-Za-z0-9_-]{12,}$/.test(value)) throw new Error("OpenAI API Key format is invalid");
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const additionalData = new TextEncoder().encode(`${userId}:openai_api_key`);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, await encryptionKey(), new TextEncoder().encode(value));
  const db = await ensureSchema();
  await db.prepare(`INSERT INTO user_secrets (id, user_id, kind, ciphertext, iv, last_four)
    VALUES (?, ?, 'openai_api_key', ?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET
      ciphertext = excluded.ciphertext, iv = excluded.iv, last_four = excluded.last_four, updated_at = CURRENT_TIMESTAMP`)
    .bind(id("sec"), userId, bytesToBase64(new Uint8Array(encrypted)), bytesToBase64(iv), value.slice(-4)).run();
}

export async function loadOpenAIKey(userId: string) {
  const db = await ensureSchema();
  const secret = await db.prepare("SELECT ciphertext, iv FROM user_secrets WHERE user_id = ? AND kind = 'openai_api_key'")
    .bind(userId).first<{ ciphertext: string; iv: string }>();
  if (!secret) return "";
  const additionalData = new TextEncoder().encode(`${userId}:openai_api_key`);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(secret.iv), additionalData }, await encryptionKey(), base64ToBytes(secret.ciphertext));
  return new TextDecoder().decode(decrypted);
}

export async function openAIKeyStatus(userId: string) {
  const db = await ensureSchema();
  const secret = await db.prepare("SELECT last_four, updated_at FROM user_secrets WHERE user_id = ? AND kind = 'openai_api_key'")
    .bind(userId).first<{ last_four: string; updated_at: string }>();
  return secret ? { configured: true, masked: `sk-••••••••${secret.last_four}`, updatedAt: secret.updated_at } : { configured: false, masked: "", updatedAt: null };
}

export async function deleteOpenAIKey(userId: string) {
  const db = await database();
  await db.prepare("DELETE FROM user_secrets WHERE user_id = ? AND kind = 'openai_api_key'").bind(userId).run();
}

export function oauthErrorRedirect(baseUrl: string, code: string) {
  const url = new URL("/", baseUrl);
  url.searchParams.set("auth_error", code);
  return url;
}
