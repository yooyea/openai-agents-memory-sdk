import { AuthenticationError, openAIKeyStatus, resolveRequestIdentity } from "../_auth";
import { ensureSchema, id, jsonError, parseJson, workspaceFor } from "../_lib";

type AgentRow = {
  id: string; owner_email: string; workspace_id?: string; name: string; description: string;
  instructions: string; model: string; memory_enabled: number; memory_mode: string;
  tools_json: string; status: string; version: number; created_at: string; updated_at: string;
};

const environments = new Set(["development", "staging", "production"]);

function agentPayload(agent: AgentRow) {
  return {
    ...agent,
    tools: parseJson<string[]>(agent.tools_json, []),
  };
}

function memoryCandidate(input: string) {
  const text = input.trim();
  const explicit = text.match(/(?:请)?记住[，,:：\s]*(.+?)[。.!！]?$/i);
  if (explicit?.[1] && explicit[1].length >= 3) {
    return { content: explicit[1].trim(), kind: "explicit", confidence: 100, importance: 90 };
  }
  const sentence = text.split(/[。！？!?\n]+/).map((item) => item.trim()).find((item) =>
    /^(我|我的|本人).*(喜欢|偏好|倾向|习惯|讨厌|不喜欢|正在|从事|目标|希望)|\b(i prefer|i like|i dislike|my .+ is|remember that)\b/i.test(item)
  );
  if (sentence && sentence.length >= 5 && sentence.length <= 220) {
    return { content: sentence, kind: "preference", confidence: 88, importance: 70 };
  }
  return null;
}

async function seed(owner: string, workspaceId: string) {
  const db = await ensureSchema();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM agents WHERE owner_email = ?")
    .bind(owner).first<{ count: number }>();
  if (Number(count?.count || 0) > 0) return;
  const agentId = id("agt");
  const versionId = id("ver");
  const draft = {
    id: agentId,
    name: "Technical Assistant",
    description: "能够跨会话记住技术偏好与项目背景的个人技术助手。",
    instructions: "你是一个简洁、可靠的技术助手。优先结合相关长期记忆回答。当前要求与记忆冲突时，以当前要求为准。",
    model: "gpt-5-mini",
    memory_enabled: 1,
    memory_mode: "background",
    tools: ["current_time", "calculator"],
    version: 1,
  };
  await db.batch([
    db.prepare(`INSERT INTO agents
      (id, owner_email, workspace_id, name, description, instructions, model, memory_enabled, memory_mode, tools_json, status, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1)`)
      .bind(agentId, owner, workspaceId, draft.name, draft.description, draft.instructions, draft.model, 1, draft.memory_mode, JSON.stringify(draft.tools)),
    db.prepare("INSERT INTO agent_versions (id, agent_id, owner_email, version, snapshot) VALUES (?, ?, ?, 1, ?)")
      .bind(versionId, agentId, owner, JSON.stringify(draft)),
    db.prepare(`INSERT INTO agent_deployments
      (id, agent_id, agent_version_id, owner_email, environment) VALUES (?, ?, ?, ?, 'production')`)
      .bind(id("dep"), agentId, versionId, owner),
  ]);
}

async function backfillSessions(owner: string) {
  const db = await ensureSchema();
  await db.prepare(`UPDATE sessions SET agent_version_id = COALESCE(
      (SELECT d.agent_version_id FROM agent_deployments d
        WHERE d.agent_id = sessions.agent_id AND d.owner_email = sessions.owner_email
          AND d.environment = sessions.environment LIMIT 1),
      (SELECT av.id FROM agent_versions av
        WHERE av.agent_id = sessions.agent_id AND av.owner_email = sessions.owner_email
        ORDER BY av.version DESC LIMIT 1)
    ) WHERE owner_email = ? AND agent_version_id IS NULL`).bind(owner).run();
}

async function backfillProductionDeployments(owner: string) {
  const db = await ensureSchema();
  const candidates = (await db.prepare(`SELECT a.id AS agent_id,
      (SELECT av.id FROM agent_versions av WHERE av.agent_id = a.id AND av.owner_email = a.owner_email
        ORDER BY av.version DESC LIMIT 1) AS version_id
    FROM agents a
    WHERE a.owner_email = ? AND a.status IN ('published', 'changed')
      AND NOT EXISTS (SELECT 1 FROM agent_deployments d
        WHERE d.agent_id = a.id AND d.owner_email = a.owner_email AND d.environment = 'production')`)
    .bind(owner).all<{ agent_id: string; version_id: string | null }>()).results
    .filter((row) => row.version_id);
  if (!candidates.length) return;
  await db.batch(candidates.map((row) => db.prepare(`INSERT INTO agent_deployments
    (id, agent_id, agent_version_id, owner_email, environment) VALUES (?, ?, ?, ?, 'production')`)
    .bind(id("dep"), row.agent_id, row.version_id, owner)));
}

async function dashboard(owner: string) {
  const db = await ensureSchema();
  const workspace = await workspaceFor(owner);
  await seed(owner, String(workspace.id));
  await backfillProductionDeployments(owner);
  await backfillSessions(owner);
  const agents = (await db.prepare("SELECT * FROM agents WHERE owner_email = ? ORDER BY updated_at DESC")
    .bind(owner).all<AgentRow>()).results.map(agentPayload);
  const versions = (await db.prepare(`SELECT av.id, av.agent_id, av.version, av.snapshot, av.created_at,
      a.name AS agent_name FROM agent_versions av JOIN agents a ON a.id = av.agent_id
      WHERE av.owner_email = ? ORDER BY av.created_at DESC`).bind(owner).all()).results;
  const deployments = (await db.prepare(`SELECT d.*, a.name AS agent_name, av.version
      FROM agent_deployments d JOIN agents a ON a.id = d.agent_id
      JOIN agent_versions av ON av.id = d.agent_version_id
      WHERE d.owner_email = ? ORDER BY d.environment, a.name`).bind(owner).all()).results;
  const sessions = (await db.prepare(`SELECT s.*, a.name AS agent_name, av.version AS agent_version,
      (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count
      FROM sessions s JOIN agents a ON a.id = s.agent_id
      LEFT JOIN agent_versions av ON av.id = s.agent_version_id
      WHERE s.owner_email = ? ORDER BY s.updated_at DESC`).bind(owner).all()).results;
  const memories = (await db.prepare(`SELECT m.*, a.name AS agent_name
      FROM memories m JOIN agents a ON a.id = m.agent_id
      WHERE m.owner_email = ? ORDER BY m.updated_at DESC LIMIT 200`).bind(owner).all()).results;
  const runs = (await db.prepare(`SELECT r.*, a.name AS agent_name, s.title AS session_title, av.version AS agent_version,
      (SELECT COUNT(*) FROM agent_run_events e WHERE e.run_id = r.id) AS event_count
      FROM agent_runs r JOIN agents a ON a.id = r.agent_id JOIN sessions s ON s.id = r.session_id
      LEFT JOIN agent_versions av ON av.id = r.agent_version_id
      WHERE r.owner_email = ? ORDER BY r.created_at DESC LIMIT 100`).bind(owner).all()).results;
  const pending = await db.prepare("SELECT COUNT(*) AS count FROM memory_jobs WHERE owner_email = ? AND status = 'pending'")
    .bind(owner).first<{ count: number }>();
  return { workspace, agents, versions, deployments, sessions, memories, runs, pending_jobs: Number(pending?.count || 0) };
}

export async function GET(request: Request) {
  try {
    const identity = await resolveRequestIdentity(request);
    const result = await dashboard(identity.user.email);
    return Response.json({
      ...result,
      auth: { authenticated: identity.authenticated, enabled: identity.authEnabled },
      api_key: identity.authenticated ? await openAIKeyStatus(identity.user.id) : { configured: false, masked: "", updatedAt: null },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, error instanceof AuthenticationError ? 401 : 500); }
}

export async function POST(request: Request) {
  try {
    const owner = (await resolveRequestIdentity(request)).user.email;
    const db = await ensureSchema();
    const workspace = await workspaceFor(owner);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "createAgent") {
      const agentId = id("agt");
      const tools = Array.isArray(body.tools) ? body.tools.map(String) : ["current_time", "calculator"];
      await db.prepare(`INSERT INTO agents
        (id, owner_email, workspace_id, name, description, instructions, model, memory_enabled, memory_mode, tools_json, status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0)`)
        .bind(
          agentId, owner, String(workspace.id), String(body.name || "Untitled agent").trim(),
          String(body.description || "").trim(), String(body.instructions || "你是一个可靠、简洁的助手。").trim(),
          String(body.model || "gpt-5-mini").trim(), body.memoryEnabled === false ? 0 : 1,
          String(body.memoryMode || "background"), JSON.stringify(tools),
        ).run();
      return Response.json({ ok: true, id: agentId });
    }

    if (action === "updateAgent") {
      const tools = Array.isArray(body.tools) ? body.tools.map(String) : [];
      await db.prepare(`UPDATE agents SET name = ?, description = ?, instructions = ?, model = ?,
        memory_enabled = ?, memory_mode = ?, tools_json = ?,
        status = CASE WHEN status = 'published' THEN 'changed' ELSE status END,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?`)
        .bind(
          String(body.name || "").trim(), String(body.description || "").trim(),
          String(body.instructions || "").trim(), String(body.model || "gpt-5-mini").trim(),
          body.memoryEnabled === false ? 0 : 1, String(body.memoryMode || "background"),
          JSON.stringify(tools), String(body.id || ""), owner,
        ).run();
      return Response.json({ ok: true });
    }

    if (action === "archiveAgent") {
      await db.prepare("UPDATE agents SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?")
        .bind(String(body.id || ""), owner).run();
      return Response.json({ ok: true });
    }

    if (action === "publishAgent") {
      const agentId = String(body.id || "");
      const agent = await db.prepare("SELECT * FROM agents WHERE id = ? AND owner_email = ?")
        .bind(agentId, owner).first<AgentRow>();
      if (!agent) return jsonError(new Error("Agent not found"), 404);
      const latest = await db.prepare("SELECT MAX(version) AS version FROM agent_versions WHERE agent_id = ? AND owner_email = ?")
        .bind(agentId, owner).first<{ version: number | null }>();
      const nextVersion = Number(latest?.version || 0) + 1;
      const versionId = id("ver");
      const snapshot = {
        id: agent.id, name: agent.name, description: agent.description, instructions: agent.instructions,
        model: agent.model, memory_enabled: agent.memory_enabled, memory_mode: agent.memory_mode,
        tools: parseJson<string[]>(agent.tools_json, []), version: nextVersion,
      };
      await db.batch([
        db.prepare("INSERT INTO agent_versions (id, agent_id, owner_email, version, snapshot) VALUES (?, ?, ?, ?, ?)")
          .bind(versionId, agentId, owner, nextVersion, JSON.stringify(snapshot)),
        db.prepare("UPDATE agents SET version = ?, status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?")
          .bind(nextVersion, agentId, owner),
      ]);
      return Response.json({ ok: true, version: nextVersion, versionId });
    }

    if (action === "deployVersion") {
      const agentId = String(body.agentId || "");
      const versionId = String(body.versionId || "");
      const environment = String(body.environment || "production");
      if (!environments.has(environment)) return jsonError(new Error("Invalid environment"), 400);
      const version = await db.prepare("SELECT id FROM agent_versions WHERE id = ? AND agent_id = ? AND owner_email = ?")
        .bind(versionId, agentId, owner).first();
      if (!version) return jsonError(new Error("Agent version not found"), 404);
      await db.prepare(`INSERT INTO agent_deployments
        (id, agent_id, agent_version_id, owner_email, environment) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(agent_id, environment) DO UPDATE SET agent_version_id = excluded.agent_version_id,
          status = 'active', updated_at = CURRENT_TIMESTAMP`)
        .bind(id("dep"), agentId, versionId, owner, environment).run();
      return Response.json({ ok: true });
    }

    if (action === "createSession") {
      const agentId = String(body.agentId || "");
      const environment = String(body.environment || "production");
      if (!environments.has(environment)) return jsonError(new Error("Invalid environment"), 400);
      const agent = await db.prepare("SELECT id, name FROM agents WHERE id = ? AND owner_email = ? AND status != 'archived'")
        .bind(agentId, owner).first<{ id: string; name: string }>();
      if (!agent) return jsonError(new Error("Agent not found"), 404);
      const version = await db.prepare(`SELECT av.id, av.version FROM agent_deployments d
        JOIN agent_versions av ON av.id = d.agent_version_id
        WHERE d.agent_id = ? AND d.owner_email = ? AND d.environment = ? LIMIT 1`)
        .bind(agentId, owner, environment).first<{ id: string; version: number }>();
      if (!version) return jsonError(new Error("Publish and deploy the agent before creating a session"), 409);
      const sessionId = id("ses");
      const title = String(body.title || `与 ${agent.name} 的新会话`).trim();
      await db.prepare("INSERT INTO sessions (id, agent_id, agent_version_id, environment, owner_email, title) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(sessionId, agentId, version.id, environment, owner, title).run();
      return Response.json({ ok: true, id: sessionId, version: version.version });
    }

    if (action === "getMessages") {
      const messages = (await db.prepare(`SELECT id, run_id, role, content, created_at FROM messages
        WHERE session_id = ? AND owner_email = ? ORDER BY created_at ASC`)
        .bind(String(body.sessionId || ""), owner).all()).results;
      return Response.json({ messages });
    }

    if (action === "getRunEvents") {
      const events = (await db.prepare(`SELECT sequence, type, payload, created_at FROM agent_run_events
        WHERE run_id = ? AND owner_email = ? ORDER BY sequence ASC`)
        .bind(String(body.runId || ""), owner).all<{ sequence: number; type: string; payload: string; created_at: string }>()).results
        .map((event) => ({ ...event, payload: parseJson(event.payload, {}) }));
      return Response.json({ events });
    }

    if (action === "createMemory") {
      const content = String(body.content || "").trim();
      if (!content) return jsonError(new Error("Memory content is required"), 400);
      await db.prepare(`INSERT INTO memories
        (id, agent_id, owner_email, memory_key, content, kind, confidence, importance, source, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`)
        .bind(id("mem"), String(body.agentId || ""), owner, normalizeKey(content), content,
          String(body.kind || "manual"), Number(body.confidence || 100), Number(body.importance || 80),
          body.expiresAt ? String(body.expiresAt) : null).run();
      return Response.json({ ok: true });
    }

    if (action === "updateMemory") {
      await db.prepare(`UPDATE memories SET content = ?, memory_key = ?, kind = ?, importance = ?, expires_at = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?`)
        .bind(String(body.content || "").trim(), normalizeKey(String(body.content || "")), String(body.kind || "manual"),
          Number(body.importance || 80), body.expiresAt ? String(body.expiresAt) : null, String(body.id || ""), owner).run();
      return Response.json({ ok: true });
    }

    if (action === "deleteMemory") {
      await db.prepare("UPDATE memories SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?")
        .bind(String(body.id || ""), owner).run();
      return Response.json({ ok: true });
    }

    if (action === "restoreMemory") {
      await db.prepare("UPDATE memories SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?")
        .bind(String(body.id || ""), owner).run();
      return Response.json({ ok: true });
    }

    if (action === "processMemoryJobs") {
      const jobs = (await db.prepare(`SELECT * FROM memory_jobs WHERE owner_email = ? AND status = 'pending'
        ORDER BY created_at ASC LIMIT 20`).bind(owner).all<Record<string, unknown>>()).results;
      let created = 0;
      for (const job of jobs) {
        const candidate = memoryCandidate(String(job.input_text || ""));
        if (candidate) {
          const key = normalizeKey(candidate.content);
          const existing = await db.prepare(`SELECT id FROM memories WHERE agent_id = ? AND owner_email = ?
            AND memory_key = ? AND deleted_at IS NULL`).bind(String(job.agent_id), owner, key).first<{ id: string }>();
          if (existing) {
            await db.prepare(`UPDATE memories SET content = ?, confidence = ?, importance = ?, source_session_id = ?,
              updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(candidate.content, candidate.confidence, candidate.importance, String(job.session_id), existing.id).run();
          } else {
            await db.prepare(`INSERT INTO memories
              (id, agent_id, owner_email, memory_key, content, kind, confidence, importance, source, source_session_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'conversation', ?)`)
              .bind(id("mem"), String(job.agent_id), owner, key, candidate.content, candidate.kind,
                candidate.confidence, candidate.importance, String(job.session_id)).run();
            created++;
          }
        }
        await db.prepare("UPDATE memory_jobs SET status = 'completed', attempts = attempts + 1, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?")
          .bind(String(job.id), owner).run();
      }
      return Response.json({ ok: true, processed: jobs.length, created });
    }

    if (action === "updateWorkspace") {
      await db.prepare("UPDATE workspaces SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_email = ?")
        .bind(String(body.name || "Personal workspace").trim(), String(workspace.id), owner).run();
      return Response.json({ ok: true });
    }

    return jsonError(new Error("Unsupported action"), 400);
  } catch (error) { return jsonError(error); }
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").slice(0, 180);
}
