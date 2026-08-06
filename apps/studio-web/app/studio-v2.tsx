"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "overview" | "agents" | "deployments" | "sessions" | "runs" | "memories" | "settings";
type Agent = {
  id: string; name: string; description: string; instructions: string; model: string; memory_enabled: number;
  memory_mode: "inline" | "background" | "disabled"; tools: string[]; status: string; version: number;
  created_at: string; updated_at: string;
};
type Version = { id: string; agent_id: string; agent_name: string; version: number; snapshot: string; created_at: string };
type Deployment = { id: string; agent_id: string; agent_name: string; agent_version_id: string; environment: string; version: number; updated_at: string };
type Session = { id: string; agent_id: string; agent_version_id: string; environment: string; title: string; agent_name: string; agent_version: number; message_count: number; created_at: string; updated_at: string };
type Memory = { id: string; agent_id: string; agent_name: string; content: string; kind: string; confidence: number; importance: number; source: string; source_session_id?: string; expires_at?: string; deleted_at?: string; created_at: string; updated_at: string };
type Run = { id: string; session_id: string; session_title: string; agent_id: string; agent_name: string; agent_version: number; status: string; model: string; input_text: string; output_text?: string; error?: string; recalled_count: number; tool_call_count: number; input_tokens: number; output_tokens: number; duration_ms: number; event_count: number; created_at: string };
type Message = { id: string; run_id?: string; role: "user" | "assistant" | "system"; content: string; created_at?: string };
type TraceEvent = { sequence: number; type: string; payload: Record<string, unknown>; created_at?: string };
type Dashboard = { workspace?: { id: string; name: string }; agents: Agent[]; versions: Version[]; deployments: Deployment[]; sessions: Session[]; memories: Memory[]; runs: Run[]; pending_jobs: number; auth?: { authenticated: boolean; enabled: boolean }; api_key?: { configured: boolean; masked: string; updatedAt: string | null } };

const empty: Dashboard = { agents: [], versions: [], deployments: [], sessions: [], memories: [], runs: [], pending_jobs: 0 };
const nav: Array<{ id: View; label: string; icon: string }> = [
  { id: "overview", label: "工作台", icon: "⌂" },
  { id: "agents", label: "智能体", icon: "◇" },
  { id: "deployments", label: "部署", icon: "↗" },
  { id: "sessions", label: "会话", icon: "◌" },
  { id: "runs", label: "运行记录", icon: "≋" },
  { id: "memories", label: "长期记忆", icon: "✦" },
  { id: "settings", label: "运行设置", icon: "⚙" },
];
const environmentLabels: Record<string, string> = { development: "开发", staging: "预发布", production: "生产" };

function relative(value?: string) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  const minutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}

const traceLabels: Record<string, string> = {
  "run.created": "运行已创建",
  "memory.recalled": "长期记忆召回完成",
  "model.stream.started": "模型开始生成",
  "model.stream.completed": "本轮生成完成",
  "tool.call.started": "开始调用工具",
  "tool.call.completed": "工具执行完成",
  "tool.call.failed": "工具执行失败",
  "memory.extracted": "长期记忆已提取",
  "memory.job_queued": "记忆提取任务已入队",
  "run.completed": "运行已完成",
  "run.failed": "运行失败",
};

function traceDescription(item: TraceEvent) {
  const payload = item.payload || {};
  if (item.type === "run.created") return `${payload.model || "model"} · v${payload.version || "-"} · ${payload.environment || "-"}`;
  if (item.type === "memory.recalled") return `召回 ${payload.count || 0} 条相关记忆`;
  if (item.type === "model.stream.started") return `第 ${Number(payload.turn || 0) + 1} 轮 · 正在接收增量输出`;
  if (item.type === "model.stream.completed") return `第 ${Number(payload.turn || 0) + 1} 轮 · ${payload.outputChars || 0} 字符`;
  if (item.type.startsWith("tool.call")) return `${payload.name || "tool"}${payload.result ? ` · ${JSON.stringify(payload.result)}` : ""}`;
  if (item.type === "memory.extracted" || item.type === "memory.job_queued") return String(payload.mode || "memory");
  if (item.type === "run.completed") return `${payload.durationMs || 0} ms · ${payload.toolCalls || 0} 次工具调用`;
  if (item.type === "run.failed") return String(payload.error || "运行失败");
  return item.type;
}

async function studioAction(payload?: Record<string, unknown>) {
  const response = await fetch("/api/studio", payload ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  } : undefined);
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.error || "操作失败"));
  return data;
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`v2-badge ${tone}`}>{children}</span>;
}

export default function StudioV2({ user, authenticated, authEnabled }: { user: { name: string; email: string }; authenticated: boolean; authEnabled: boolean }) {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Dashboard>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [agentDraft, setAgentDraft] = useState<Partial<Agent>>({});
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [newSessionEnvironment, setNewSessionEnvironment] = useState("production");
  const [deploymentChoices, setDeploymentChoices] = useState<Record<string, string>>({});
  const [workspaceName, setWorkspaceName] = useState("");
  const [processOpen, setProcessOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await studioAction() as unknown as Dashboard;
      setData(next);
      setSelectedAgentId((current) => current || next.agents[0]?.id || "");
      setWorkspaceName(String(next.workspace?.name || "Personal workspace"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败"); }
    finally { setLoading(false); }
  }, []);

  // The initial load is asynchronous and synchronizes this client view with D1.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const selectedAgent = data.agents.find((item) => item.id === selectedAgentId) || data.agents[0];
  const selectedSession = data.sessions.find((item) => item.id === selectedSessionId);
  const selectedRun = data.runs.find((item) => item.id === selectedRunId) || data.runs[0];
  // Reset the mutable editor when the selected control-plane record changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedAgent) setAgentDraft(selectedAgent); }, [selectedAgent]);
  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, trace]);

  const metrics = useMemo(() => ({
    published: data.agents.filter((agent) => agent.status === "published").length,
    deployments: data.deployments.length,
    sessions: data.sessions.length,
    runs: data.runs.length,
    memories: data.memories.filter((memory) => !memory.deleted_at).length,
  }), [data]);
  const keyConfigured = authenticated ? Boolean(data.api_key?.configured) : Boolean(apiKey);

  async function openSession(sessionId: string) {
    setSelectedSessionId(sessionId); setView("sessions"); setMessages([]); setTrace([]); setProcessOpen(false);
    try {
      const result = await studioAction({ action: "getMessages", sessionId });
      setMessages((result.messages || []) as Message[]);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "会话加载失败"); }
  }

  async function createSession(agentId = selectedAgentId) {
    if (!agentId) return;
    try {
      const result = await studioAction({ action: "createSession", agentId, environment: newSessionEnvironment });
      await load(); await openSession(String(result.id));
      setNotice(`会话已固定到 v${result.version}`);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "创建会话失败"); }
  }

  async function saveAgent() {
    if (!selectedAgent) return;
    try {
      await studioAction({ action: "updateAgent", id: selectedAgent.id, name: agentDraft.name,
        description: agentDraft.description, instructions: agentDraft.instructions, model: agentDraft.model,
        memoryEnabled: Boolean(agentDraft.memory_enabled), memoryMode: agentDraft.memory_mode,
        tools: agentDraft.tools || [] });
      await load(); setNotice("草稿已保存");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "保存失败"); }
  }

  async function publishAgent() {
    if (!selectedAgent) return;
    await saveAgent();
    try {
      const result = await studioAction({ action: "publishAgent", id: selectedAgent.id });
      await load(); setNotice(`已发布不可变版本 v${result.version}`);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "发布失败"); }
  }

  async function createAgent(event: FormEvent) {
    event.preventDefault(); if (!newAgentName.trim()) return;
    try {
      const result = await studioAction({ action: "createAgent", name: newAgentName, description: "新的长期记忆智能体。" });
      setNewAgentOpen(false); setNewAgentName(""); await load(); setSelectedAgentId(String(result.id)); setView("agents");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "创建失败"); }
  }

  async function deploy(agentId: string, environment: string) {
    const versions = data.versions.filter((version) => version.agent_id === agentId);
    const key = `${agentId}:${environment}`;
    const versionId = deploymentChoices[key] || versions[0]?.id;
    if (!versionId) { setNotice("请先发布一个版本"); return; }
    try {
      await studioAction({ action: "deployVersion", agentId, environment, versionId });
      await load(); setNotice(`${environmentLabels[environment]}环境已更新`);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "部署失败"); }
  }

  async function openRun(runId: string) {
    setSelectedRunId(runId); setView("runs");
    try {
      const result = await studioAction({ action: "getRunEvents", runId });
      setTrace((result.events || []) as TraceEvent[]);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Trace 加载失败"); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !selectedSessionId || sending) return;
    if (!keyConfigured) { setNotice(authenticated ? "先在运行设置中保存 OpenAI API Key。" : "先填写 OpenAI API Key。当前为兼容模式，密钥只保存在页面内存。"); setView("settings"); return; }
    const userMessage: Message = { id: `tmp-user-${Date.now()}`, role: "user", content };
    const streamId = `tmp-assistant-${Date.now()}`;
    setMessages((current) => [...current, userMessage, { id: streamId, role: "assistant", content: "" }]);
    setChatInput(""); setSending(true); setTrace([]); setProcessOpen(true); setNotice("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: selectedSessionId, message: content, ...(authenticated ? {} : { apiKey }) }) });
      if (!response.ok) {
        const failure = await response.json() as { error?: string };
        throw new Error(failure.error === "OPENAI_KEY_REQUIRED" ? "OpenAI API Key 无效或缺失" : failure.error || "运行失败");
      }
      const reader = response.body?.getReader(); if (!reader) throw new Error("SSE stream unavailable");
      const decoder = new TextDecoder(); let buffer = ""; let finalMessage: Message | null = null; let memoryStatus = "";
      const handle = (block: string) => {
        const lines = block.split("\n");
        const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
        const dataLine = lines.find((line) => line.startsWith("data:"))?.slice(5).trim();
        if (!dataLine) return;
        const payload = JSON.parse(dataLine) as Record<string, unknown>;
        if (eventName === "meta") setSelectedRunId(String(payload.runId || ""));
        if (eventName === "delta") setMessages((current) => current.map((item) => item.id === streamId ? { ...item, content: item.content + String(payload.delta || "") } : item));
        if (eventName === "trace") setTrace((current) => [...current, payload as unknown as TraceEvent]);
        if (eventName === "done") { finalMessage = payload.message as Message; memoryStatus = String(payload.memoryStatus || ""); }
        if (eventName === "error") throw new Error(String(payload.error || "运行失败"));
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() || "";
        for (const block of blocks) if (block.trim()) handle(block);
      }
      if (buffer.trim()) handle(buffer);
      if (finalMessage) setMessages((current) => current.map((item) => item.id === streamId ? finalMessage! : item));
      if (memoryStatus === "queued") await studioAction({ action: "processMemoryJobs" });
      await load();
      setNotice(memoryStatus === "queued" ? "回复完成；后台记忆任务已处理" : "回复完成");
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "运行失败";
      setMessages((current) => current.map((item) => item.id === streamId ? { ...item, role: "system", content: text } : item));
    } finally { setSending(false); }
  }

  async function addMemory(event: FormEvent) {
    event.preventDefault(); if (!memoryText.trim() || !selectedAgentId) return;
    await studioAction({ action: "createMemory", agentId: selectedAgentId, content: memoryText, kind: "manual" });
    setMemoryText(""); await load(); setNotice("长期记忆已添加");
  }

  async function memoryAction(action: "deleteMemory" | "restoreMemory", memoryId: string) {
    await studioAction({ action, id: memoryId }); await load(); setNotice(action === "deleteMemory" ? "记忆已软删除" : "记忆已恢复");
  }

  async function saveWorkspace() {
    await studioAction({ action: "updateWorkspace", name: workspaceName }); await load(); setNotice("Workspace 已更新");
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return;
    try {
      const response = await fetch("/api/account/api-key", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }) });
      const result = await response.json() as { error?: string; configured?: boolean; masked?: string; updatedAt?: string | null };
      if (!response.ok) throw new Error(result.error || "API Key 保存失败");
      setApiKey(""); setShowKey(false); await load(); setNotice("API Key 已加密保存");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "API Key 保存失败"); }
  }

  async function deleteApiKey() {
    try {
      const response = await fetch("/api/account/api-key", { method: "DELETE" });
      if (!response.ok) throw new Error("API Key 删除失败");
      setApiKey(""); await load(); setNotice("已删除持久化 API Key");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "API Key 删除失败"); }
  }

  async function logout() {
    await fetch("/api/oauth/logout", { method: "POST" });
    window.location.assign("/");
  }

  function toggleTool(tool: string) {
    const tools = agentDraft.tools || [];
    setAgentDraft({ ...agentDraft, tools: tools.includes(tool) ? tools.filter((item) => item !== tool) : [...tools, tool] });
  }

  return (
    <main className="app-shell v2-shell">
      <aside className="sidebar">
        <div className="logo"><span className="logo-mark"><i /><i /><i /></span><span>Agent Memory<small>STUDIO</small></span></div>
        <nav><p>CONTROL + RUNTIME</p>{nav.map((item) => (
          <button key={item.id} aria-label={item.label} title={item.label} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}
            {item.id === "runs" && data.runs.length ? <b>{data.runs.length}</b> : null}</button>
        ))}</nav>
        <div className="sidebar-bottom"><div className="runtime-state"><i /><span><b>Runtime online</b><small>D1 · SSE · Responses</small></span></div>
          <div className="user-card"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><b>{user.name}</b><small>{user.email}</small></span>{authenticated ? <button className="logout-button" onClick={() => void logout()}>退出</button> : null}</div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div className="breadcrumb"><span>{data.workspace?.name || "Workspace"}</span><i>/</i><b>{nav.find((item) => item.id === view)?.label}</b></div>
          <div className="top-actions"><span className={keyConfigured ? "key-state ready" : "key-state"}><i />{keyConfigured ? "OpenAI 已连接" : "等待 API Key"}</span>
            <button className="ghost-button" onClick={() => setView("settings")}>运行设置</button><button className="primary-button" onClick={() => setNewAgentOpen(true)}>＋ 创建智能体</button></div></header>
        {notice ? <div className="toast" onClick={() => setNotice("")}><span>✓</span>{notice}<button>×</button></div> : null}
        {error ? <div className="error-banner">{error}<button onClick={() => void load()}>重试</button></div> : null}
        <div className="content">
          {!authEnabled ? <div className="auth-pending"><b>OAuth 待安全启用</b><span>当前保持兼容访问。安全录入新的 GitHub / Google Client Secret 并重新部署后，将自动启用账号隔离与加密密钥持久化。</span></div> : null}
          {loading ? <div className="loading-screen"><span className="spinner" /><p>正在加载控制面与运行面…</p></div> : null}

          {!loading && view === "overview" ? <section>
            <div className="welcome"><div><p>AGENT STUDIO / COMPLETE LOOP</p><h1>从草稿到生产运行</h1><span>发布不可变版本，部署到环境，再创建固定版本的会话。</span></div><div className="date-chip"><span>{metrics.runs}</span><small>RECORDED RUNS</small></div></div>
            <div className="metric-grid v2-metrics">
              {[["◇","已发布 Agent",metrics.published,"blue"],["↗","环境部署",metrics.deployments,"purple"],["◌","固定版本会话",metrics.sessions,"green"],["≋","运行记录",metrics.runs,"amber"],["✦","有效记忆",metrics.memories,"green"]].map(([icon,label,value,tone]) =>
                <article key={String(label)}><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><b>{value}</b><em>持久化数据</em></div></article>) }
            </div>
            <div className="overview-grid">
              <article className="overview-card"><div className="card-title"><div><p>PRODUCTION AGENTS</p><h2>生产智能体</h2></div><span>{data.agents.length} AGENTS</span></div>
                <div className="agent-cards">{data.agents.slice(0,3).map((agent,index) => <button key={agent.id} onClick={() => { setSelectedAgentId(agent.id); setView("agents"); }}><span className={`agent-art art-${index}`}><i>{agent.name.slice(0,1)}</i><b>v{agent.version}</b></span><span><b>{agent.name}</b><small>{agent.description}</small><em><i className={agent.status} />{agent.status}<u>{agent.model}</u></em></span></button>)}</div></article>
              <article className="overview-card activity-card"><div className="card-title"><div><p>LATEST RUNS</p><h2>最近运行</h2></div><span>TRACE</span></div><div className="activity-list">{data.runs.slice(0,5).map((run) => <button key={run.id} onClick={() => void openRun(run.id)}><span className="activity-icon">≋</span><span><b>{run.agent_name} · v{run.agent_version}</b><small>{run.status} · {run.duration_ms} ms · {run.event_count} events</small></span><time>{relative(run.created_at)}</time></button>)}</div></article>
            </div>
            <div className="quick-run"><div><span className="quick-mark">▶</span><div><p>CONTROL → RUNTIME</p><h2>完整闭环已接通</h2><small>Draft → Version → Deployment → Session → Run → Memory</small></div></div><div><button onClick={() => setView("deployments")}><span>↗</span>管理部署</button><button onClick={() => setView("runs")}><span>≋</span>查看 Trace</button></div></div>
          </section> : null}

          {!loading && view === "agents" ? <section className="agents-layout">
            <div className="agents-list"><div className="panel-heading"><div><p>CONTROL PLANE</p><h2>智能体</h2></div><button onClick={() => setNewAgentOpen(true)}>＋</button></div>{data.agents.map((agent) => <button key={agent.id} className={selectedAgent?.id === agent.id ? "agent-list-item selected" : "agent-list-item"} onClick={() => setSelectedAgentId(agent.id)}><span className="agent-icon">{agent.name.slice(0,1)}</span><span><b>{agent.name}</b><small>{agent.model} · v{agent.version || "draft"}</small></span><i className={agent.status} /></button>)}</div>
            {selectedAgent ? <div className="agent-editor"><div className="editor-title"><div><span className="agent-icon large">{selectedAgent.name.slice(0,1)}</span><div><p>MUTABLE DRAFT</p><h1>{agentDraft.name}</h1></div></div><div className="editor-actions"><button className="ghost-button" onClick={() => void saveAgent()}>保存草稿</button><button className="publish-button" onClick={() => void publishAgent()}>发布版本 ↗</button></div></div>
              <div className="status-strip"><span className={selectedAgent.status}><i />{selectedAgent.status}</span><span>最新版本 <b>v{selectedAgent.version}</b></span><span>提取策略 <b>{agentDraft.memory_mode}</b></span><span>工具 <b>{(agentDraft.tools || []).length}</b></span></div>
              <div className="form-grid"><label><span>名称</span><input value={agentDraft.name || ""} onChange={(e) => setAgentDraft({...agentDraft,name:e.target.value})} /></label><label><span>模型</span><input value={agentDraft.model || ""} onChange={(e) => setAgentDraft({...agentDraft,model:e.target.value})} /></label><label className="full"><span>简介</span><input value={agentDraft.description || ""} onChange={(e) => setAgentDraft({...agentDraft,description:e.target.value})} /></label><label className="full"><span>Instructions</span><textarea rows={7} value={agentDraft.instructions || ""} onChange={(e) => setAgentDraft({...agentDraft,instructions:e.target.value})} /></label></div>
              <div className="v2-config-grid"><div className="memory-toggle"><div><span className="memory-glyph">✦</span><span><b>跨 Session 长期记忆</b><small>召回内容始终作为不可信事实注入。</small></span></div><button className={agentDraft.memory_enabled ? "switch on" : "switch"} onClick={() => setAgentDraft({...agentDraft,memory_enabled:agentDraft.memory_enabled ? 0 : 1})}><i /></button></div>
                <label className="v2-select"><span>提取策略</span><select value={agentDraft.memory_mode || "background"} onChange={(e) => setAgentDraft({...agentDraft,memory_mode:e.target.value as Agent["memory_mode"]})}><option value="inline">INLINE · 同步</option><option value="background">BACKGROUND · 任务</option><option value="disabled">DISABLED · 关闭</option></select></label></div>
              <div className="v2-tools"><span>内置工具</span>{["current_time","calculator"].map((tool) => <button key={tool} className={(agentDraft.tools || []).includes(tool) ? "selected" : ""} onClick={() => toggleTool(tool)}>{(agentDraft.tools || []).includes(tool) ? "✓ " : ""}{tool}</button>)}</div>
              <div className="version-line"><div><p>IMMUTABLE SNAPSHOTS</p><h3>版本历史</h3></div><div className="version-pills">{data.versions.filter((item) => item.agent_id === selectedAgent.id).map((version) => <span key={version.id}><b>v{version.version}</b>{relative(version.created_at)}</span>)}</div></div>
            </div> : null}
          </section> : null}

          {!loading && view === "deployments" ? <section><div className="page-heading"><div><p>CONTROL PLANE</p><h1>环境部署</h1><span>发布创建版本。部署只更新环境指针。回滚时选择旧版本。</span></div></div>
            <div className="deployment-grid">{data.agents.filter((agent) => agent.version > 0).map((agent) => <article className="deployment-agent" key={agent.id}><div className="deployment-title"><span className="agent-icon large">{agent.name.slice(0,1)}</span><div><h2>{agent.name}</h2><small>{data.versions.filter((v) => v.agent_id === agent.id).length} 个不可变版本</small></div></div>
              <div className="environment-list">{["development","staging","production"].map((environment) => { const current = data.deployments.find((item) => item.agent_id === agent.id && item.environment === environment); const key = `${agent.id}:${environment}`; const versions = data.versions.filter((item) => item.agent_id === agent.id); return <div className="environment-row" key={environment}><Badge tone={environment}>{environmentLabels[environment]}</Badge><span>{current ? `当前 v${current.version}` : "未部署"}</span><select value={deploymentChoices[key] || current?.agent_version_id || versions[0]?.id || ""} onChange={(e) => setDeploymentChoices({...deploymentChoices,[key]:e.target.value})}>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version} · {relative(version.created_at)}</option>)}</select><button className="primary-button" onClick={() => void deploy(agent.id, environment)}>{current ? "更新 / 回滚" : "部署"}</button></div>; })}</div></article>)}</div>
          </section> : null}

          {!loading && view === "sessions" ? <section className="sessions-layout">
            <aside className="session-list"><div className="panel-heading"><div><p>PINNED VERSION</p><h2>会话</h2></div><button onClick={() => void createSession()}>＋</button></div><div className="session-create-controls"><select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>{data.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><select value={newSessionEnvironment} onChange={(e) => setNewSessionEnvironment(e.target.value)}>{Object.entries(environmentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>{data.sessions.map((session) => <button key={session.id} className={selectedSessionId === session.id ? "session-item selected" : "session-item"} onClick={() => void openSession(session.id)}><span>◌</span><span><b>{session.title}</b><small>{session.agent_name} · v{session.agent_version} · {environmentLabels[session.environment]}</small></span><em>{session.message_count}</em></button>)}</aside>
            <div className="chat-panel">{selectedSession ? <>
              <div className="chat-header"><button className="mobile-back" type="button" aria-label="返回会话列表" onClick={() => { setSelectedSessionId(""); setMessages([]); setTrace([]); }}>‹</button><div><span className="agent-icon">{selectedSession.agent_name.slice(0,1)}</span><span><b>{selectedSession.title}</b><small>{selectedSession.agent_name} · 固定 v{selectedSession.agent_version} · {environmentLabels[selectedSession.environment]}</small></span></div><span className="memory-live"><i />实时流 + Memory</span></div>
              {(sending || trace.length > 0) ? <section className={processOpen ? "live-process open" : "live-process"}>
                <button type="button" className="live-process-toggle" onClick={() => setProcessOpen(!processOpen)}><span><i className={sending ? "pulse" : ""} />运行过程（可审计）</span><small>{sending ? "执行中" : `${trace.length} 个事件`} · 不展示模型私有推理</small><b>{processOpen ? "收起" : "展开"}</b></button>
                {processOpen ? <div className="live-process-list">{trace.map((item) => <div className={`live-process-item ${item.type.includes("failed") ? "failed" : ""}`} key={`${item.sequence}-${item.type}`}><span>{item.sequence}</span><div><b>{traceLabels[item.type] || item.type}</b><small>{traceDescription(item)}</small></div></div>)}{sending ? <div className="live-process-item active"><span>·</span><div><b>正在执行</b><small>事件和回答会持续到达</small></div></div> : null}</div> : null}
              </section> : null}
              <div className="messages" ref={messagesRef}>{!messages.length ? <div className="chat-welcome"><span>✦</span><h2>开始一次可追踪运行</h2><p>回答会从 OpenAI Responses 实时到达。运行过程展示记忆、模型和工具步骤。</p></div> : null}{messages.map((message) => <div key={message.id} className={`message ${message.role}`}><span className="message-avatar">{message.role === "user" ? user.name.slice(0,1) : message.role === "assistant" ? "A" : "!"}</span><div><small>{message.role === "user" ? "你" : message.role === "assistant" ? selectedSession.agent_name : "运行错误"}{message.run_id ? ` · ${message.run_id.slice(-8)}` : ""}</small><p>{message.content || (sending ? <span className="typing"><i /><i /><i /></span> : "")}</p></div></div>)}</div>
              <form className="composer" onSubmit={sendMessage}><div className="composer-meta"><span>✦ 自动召回 · 固定 AgentVersion</span><span>{sending ? "OpenAI 实时生成中" : `v${selectedSession.agent_version}`}</span></div><div><textarea aria-label="消息" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }}} placeholder="输入消息，Enter 发送…" rows={2} /><button disabled={sending || !chatInput.trim()} aria-label="发送">↑</button></div></form>
            </> : <div className="session-empty"><div className="orb">◌</div><h1>选择或创建会话</h1><p>创建时，系统读取目标环境的 Deployment，并固定一个 AgentVersion。</p><button className="primary-button" onClick={() => void createSession()}>创建固定版本会话</button></div>}</div>
          </section> : null}

          {!loading && view === "runs" ? <section><div className="page-heading"><div><p>RUNTIME PLANE</p><h1>运行记录与 Trace</h1><span>每次运行记录版本、记忆召回、工具调用、Token 和耗时。</span></div></div><div className="runs-layout"><div className="run-list">{data.runs.map((run) => <button key={run.id} className={selectedRun?.id === run.id ? "run-card selected" : "run-card"} onClick={() => void openRun(run.id)}><span className={`run-status ${run.status}`} /><div><b>{run.agent_name} · v{run.agent_version}</b><p>{run.input_text}</p><small>{run.duration_ms} ms · {run.recalled_count} memories · {run.tool_call_count} tools · {run.event_count} events</small></div><time>{relative(run.created_at)}</time></button>)}</div><div className="trace-panel">{selectedRun ? <><div className="trace-summary"><div><p>RUN</p><h2>{selectedRun.id}</h2></div><Badge tone={selectedRun.status}>{selectedRun.status}</Badge></div><div className="trace-metrics"><span><b>{selectedRun.input_tokens + selectedRun.output_tokens}</b> tokens</span><span><b>{selectedRun.duration_ms}</b> ms</span><span><b>{selectedRun.recalled_count}</b> memories</span><span><b>{selectedRun.tool_call_count}</b> tools</span></div><div className="trace-timeline">{trace.map((item) => <div key={`${item.sequence}-${item.type}`} className="trace-event"><span>{item.sequence}</span><div><b>{item.type}</b><code>{JSON.stringify(item.payload)}</code></div></div>)}</div></> : <div className="table-empty">还没有运行记录</div>}</div></div></section> : null}

          {!loading && view === "memories" ? <section><div className="page-heading"><div><p>MEMORY GOVERNANCE</p><h1>长期记忆审查</h1><span>记忆支持来源、置信度、重要性、过期和软删除。</span></div><select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>{data.agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></div><form className="add-memory" onSubmit={addMemory}><span>✦</span><input value={memoryText} onChange={(e) => setMemoryText(e.target.value)} placeholder="手动补充一条长期事实…" /><button>添加记忆</button></form><div className="memory-table"><div className="table-head v2-memory-head"><span>MEMORY</span><span>TYPE</span><span>IMPORTANCE</span><span>SOURCE</span><span>STATE</span></div>{data.memories.filter((memory) => memory.agent_id === selectedAgentId).map((memory) => <div className={`memory-row v2-memory-row ${memory.deleted_at ? "deleted" : ""}`} key={memory.id}><div><span className="memory-dot">✦</span><p>{memory.content}<small>{memory.confidence}% confidence · {relative(memory.updated_at)}</small></p></div><span className="kind-badge">{memory.kind}</span><span className="confidence"><i style={{width:`${memory.importance}%`}} /><b>{memory.importance}</b></span><code>{memory.source}</code><button onClick={() => void memoryAction(memory.deleted_at ? "restoreMemory" : "deleteMemory", memory.id)}>{memory.deleted_at ? "恢复" : "删除"}</button></div>)}</div></section> : null}

          {!loading && view === "settings" ? <section><div className="page-heading"><div><p>RUNTIME SETTINGS</p><h1>运行设置</h1><span>{authenticated ? "API Key 按用户加密保存，运行时仅在服务端解密。" : "当前为兼容模式：API Key 只保存在页面内存。"}</span></div></div><div className="settings-grid"><article className="settings-card key-card"><div className="settings-icon">KEY</div><h2>OpenAI API Key</h2><p>{authenticated ? "使用 AES-256-GCM 加密后写入 D1。密钥明文不会返回浏览器。" : "OAuth 尚未安全启用，因此不持久化密钥。"}</p>{data.api_key?.configured ? <code>{data.api_key.masked}</code> : null}<label><span>{data.api_key?.configured ? "替换 API KEY" : "API KEY"}</span><div><input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." /><button onClick={() => setShowKey(!showKey)}>{showKey ? "隐藏" : "显示"}</button></div></label>{authenticated ? <div className="key-actions"><button className="primary-button" disabled={!apiKey.trim()} onClick={() => void saveApiKey()}>加密保存</button>{data.api_key?.configured ? <button className="ghost-button" onClick={() => void deleteApiKey()}>删除密钥</button> : null}</div> : null}<div className={keyConfigured ? "connection connected" : "connection"}><i />{keyConfigured ? (authenticated ? `已持久化 ${data.api_key?.masked || ""}` : "当前页面已配置") : "等待配置"}</div></article><article className="settings-card"><div className="settings-icon">WSP</div><h2>Workspace</h2><p>所有 Agent、版本、会话和记忆都属于当前 Workspace。</p><label><span>名称</span><div><input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} /><button onClick={() => void saveWorkspace()}>保存</button></div></label></article><article className="settings-card"><div className="settings-icon">API</div><h2>运行能力</h2><ul><li>Account isolation <b>{authenticated ? "ONLINE" : "PENDING"}</b></li><li>Encrypted API key <b>{authenticated ? "ONLINE" : "PENDING"}</b></li><li>D1 persistence <b>ONLINE</b></li><li>SSE events <b>ONLINE</b></li><li>Memory jobs <b>{data.pending_jobs ? `${data.pending_jobs} PENDING` : "ONLINE"}</b></li></ul></article></div></section> : null}
        </div>
      </section>

      {newAgentOpen ? <div className="modal-backdrop"><form className="modal" onSubmit={createAgent}><button type="button" className="modal-close" onClick={() => setNewAgentOpen(false)}>×</button><div className="modal-mark">◇</div><p>CONTROL PLANE</p><h2>创建智能体草稿</h2><label><span>名称</span><input autoFocus value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="例如：Product Copilot" /></label><div><button type="button" className="ghost-button" onClick={() => setNewAgentOpen(false)}>取消</button><button className="primary-button">创建草稿</button></div></form></div> : null}
    </main>
  );
}
