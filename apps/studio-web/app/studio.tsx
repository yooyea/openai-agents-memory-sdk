"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type View = "overview" | "agents" | "sessions" | "memories" | "settings";
type Agent = {
  id: string; name: string; description: string; instructions: string; model: string;
  memory_enabled: number; status: string; version: number; created_at: string; updated_at: string;
};
type Session = {
  id: string; agent_id: string; title: string; agent_name: string; message_count: number;
  created_at: string; updated_at: string;
};
type Memory = {
  id: string; agent_id: string; agent_name: string; content: string; kind: string;
  confidence: number; source_session_id?: string; created_at: string;
};
type Version = { id: string; agent_id: string; version: number; created_at: string };
type Message = { id: string; role: "user" | "assistant" | "system"; content: string; created_at?: string };
type Dashboard = { agents: Agent[]; sessions: Session[]; memories: Memory[]; versions: Version[] };

const nav: Array<{ id: View; label: string; icon: string }> = [
  { id: "overview", label: "工作台", icon: "⌂" },
  { id: "agents", label: "智能体", icon: "◇" },
  { id: "sessions", label: "会话", icon: "◌" },
  { id: "memories", label: "长期记忆", icon: "✦" },
  { id: "settings", label: "运行设置", icon: "⚙" },
];

function relative(value: string) {
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}

async function studioAction(payload?: Record<string, unknown>) {
  const response = await fetch("/api/studio", payload ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  } : undefined);
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.error || "操作失败"));
  return data;
}

export default function Studio({ user }: { user: { name: string; email: string } }) {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Dashboard>({ agents: [], sessions: [], memories: [], versions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");
  const [agentDraft, setAgentDraft] = useState<Partial<Agent>>({});
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [memoryText, setMemoryText] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await studioAction() as unknown as Dashboard;
      setData(next);
      setSelectedAgentId((current) => current || next.agents[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selectedAgent = data.agents.find((item) => item.id === selectedAgentId) || data.agents[0];
  const selectedSession = data.sessions.find((item) => item.id === selectedSessionId);
  const selectedSessionAgent = data.agents.find((item) => item.id === selectedSession?.agent_id);

  useEffect(() => {
    if (selectedAgent) setAgentDraft(selectedAgent);
  }, [selectedAgent]);

  async function openSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setView("sessions");
    setMessages([]);
    try {
      const result = await studioAction({ action: "getMessages", sessionId });
      setMessages((result.messages || []) as Message[]);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "会话加载失败");
    }
  }

  async function createSession(agentId = selectedAgentId) {
    if (!agentId) return;
    try {
      const result = await studioAction({ action: "createSession", agentId });
      await load();
      await openSession(String(result.id));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "创建会话失败");
    }
  }

  async function saveAgent() {
    if (!selectedAgent) return;
    try {
      await studioAction({
        action: "updateAgent", id: selectedAgent.id,
        name: agentDraft.name, description: agentDraft.description,
        instructions: agentDraft.instructions, model: agentDraft.model,
        memoryEnabled: Boolean(agentDraft.memory_enabled),
      });
      await load();
      setNotice("草稿已保存");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "保存失败");
    }
  }

  async function publishAgent() {
    if (!selectedAgent) return;
    await saveAgent();
    try {
      const result = await studioAction({ action: "publishAgent", id: selectedAgent.id });
      await load();
      setNotice(`已发布不可变版本 v${result.version}`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "发布失败");
    }
  }

  async function createAgent(event: FormEvent) {
    event.preventDefault();
    if (!newAgentName.trim()) return;
    try {
      const result = await studioAction({
        action: "createAgent",
        name: newAgentName,
        description: "一个新的长期记忆智能体。",
      });
      setNewAgentOpen(false);
      setNewAgentName("");
      await load();
      setSelectedAgentId(String(result.id));
      setView("agents");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "创建失败");
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !selectedSessionId || sending) return;
    if (!apiKey) {
      setNotice("先在运行设置中填写 OpenAI API Key；密钥只保存在当前页面内存中。");
      setView("settings");
      return;
    }
    const optimistic: Message = { id: `tmp-${Date.now()}`, role: "user", content };
    setMessages((current) => [...current, optimistic]);
    setChatInput("");
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSessionId, message: content, apiKey }),
      });
      const result = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(result.error || "模型调用失败"));
      setMessages((current) => [...current, result.message as Message]);
      if (result.newMemory) setNotice("已从这轮对话提取 1 条长期记忆");
      await load();
    } catch (cause) {
      setMessages((current) => [...current, {
        id: `err-${Date.now()}`, role: "system",
        content: cause instanceof Error ? cause.message : "模型调用失败",
      }]);
    } finally {
      setSending(false);
    }
  }

  async function addMemory(event: FormEvent) {
    event.preventDefault();
    if (!memoryText.trim() || !selectedAgentId) return;
    await studioAction({ action: "createMemory", agentId: selectedAgentId, content: memoryText, kind: "manual" });
    setMemoryText("");
    await load();
    setNotice("长期记忆已添加");
  }

  async function deleteMemory(memoryId: string) {
    await studioAction({ action: "deleteMemory", id: memoryId });
    await load();
    setNotice("记忆已删除");
  }

  const metrics = useMemo(() => ({
    published: data.agents.filter((agent) => agent.status === "published").length,
    sessions: data.sessions.length,
    memories: data.memories.length,
    messages: data.sessions.reduce((sum, session) => sum + Number(session.message_count || 0), 0),
  }), [data]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="logo"><span className="logo-mark"><i /><i /><i /></span><span>Agent Memory<small>STUDIO</small></span></div>
        <nav>
          <p>WORKSPACE</p>
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <span>{item.icon}</span>{item.label}
              {item.id === "memories" && data.memories.length > 0 ? <b>{data.memories.length}</b> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="runtime-state"><i /><span><b>Runtime ready</b><small>D1 persistence online</small></span></div>
          <div className="user-card"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><b>{user.name}</b><small>{user.email}</small></span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Agent Memory</span><i>/</i><b>{nav.find((item) => item.id === view)?.label}</b></div>
          <div className="top-actions">
            <span className={apiKey ? "key-state ready" : "key-state"}><i />{apiKey ? "OpenAI 已连接" : "等待 API Key"}</span>
            <button className="ghost-button" onClick={() => setView("settings")}>运行设置</button>
            <button className="primary-button" onClick={() => setNewAgentOpen(true)}>＋ 创建智能体</button>
          </div>
        </header>

        {notice ? <div className="toast" onClick={() => setNotice("")}><span>✓</span>{notice}<button>×</button></div> : null}
        {error ? <div className="error-banner">{error}<button onClick={() => void load()}>重试</button></div> : null}

        <div className="content">
          {loading ? <div className="loading-screen"><span className="spinner" /><p>正在加载工作区…</p></div> : null}

          {!loading && view === "overview" ? (
            <Overview
              userName={user.name}
              data={data}
              metrics={metrics}
              onAgent={(id) => { setSelectedAgentId(id); setView("agents"); }}
              onSession={(id) => void openSession(id)}
              onStart={(id) => void createSession(id)}
            />
          ) : null}

          {!loading && view === "agents" ? (
            <section className="agents-layout">
              <div className="agents-list">
                <div className="panel-heading"><div><p>AGENTS</p><h2>智能体</h2></div><button onClick={() => setNewAgentOpen(true)}>＋</button></div>
                {data.agents.map((agent) => (
                  <button key={agent.id} className={selectedAgent?.id === agent.id ? "agent-list-item selected" : "agent-list-item"} onClick={() => setSelectedAgentId(agent.id)}>
                    <span className="agent-icon">{agent.name.slice(0, 1).toUpperCase()}</span>
                    <span><b>{agent.name}</b><small>{agent.model} · v{agent.version || "draft"}</small></span>
                    <i className={agent.status} />
                  </button>
                ))}
              </div>
              {selectedAgent ? (
                <div className="agent-editor">
                  <div className="editor-title">
                    <div><span className="agent-icon large">{selectedAgent.name.slice(0,1).toUpperCase()}</span><div><p>AGENT CONFIGURATION</p><h1>{agentDraft.name}</h1></div></div>
                    <div className="editor-actions"><button className="ghost-button" onClick={saveAgent}>保存草稿</button><button className="publish-button" onClick={publishAgent}>发布版本 <span>↗</span></button></div>
                  </div>
                  <div className="status-strip"><span className={selectedAgent.status}><i />{selectedAgent.status === "published" ? "已发布" : selectedAgent.status === "changed" ? "存在未发布变更" : "草稿"}</span><span>当前生产版本 <b>v{selectedAgent.version}</b></span><span>长期记忆 <b>{selectedAgent.memory_enabled ? "开启" : "关闭"}</b></span></div>
                  <div className="form-grid">
                    <label><span>名称</span><input value={agentDraft.name || ""} onChange={(e) => setAgentDraft({...agentDraft,name:e.target.value})} /></label>
                    <label><span>模型</span><input value={agentDraft.model || ""} onChange={(e) => setAgentDraft({...agentDraft,model:e.target.value})} placeholder="gpt-5-mini" /></label>
                    <label className="full"><span>简介</span><input value={agentDraft.description || ""} onChange={(e) => setAgentDraft({...agentDraft,description:e.target.value})} /></label>
                    <label className="full"><span>Instructions</span><textarea rows={9} value={agentDraft.instructions || ""} onChange={(e) => setAgentDraft({...agentDraft,instructions:e.target.value})} /></label>
                  </div>
                  <div className="memory-toggle">
                    <div><span className="memory-glyph">✦</span><span><b>跨 Session 长期记忆</b><small>自动提取明确偏好，并在后续会话中作为非可信上下文召回。</small></span></div>
                    <button className={agentDraft.memory_enabled ? "switch on" : "switch"} onClick={() => setAgentDraft({...agentDraft,memory_enabled:agentDraft.memory_enabled ? 0 : 1})}><i /></button>
                  </div>
                  <div className="version-line">
                    <div><p>VERSION HISTORY</p><h3>不可变版本</h3></div>
                    <div className="version-pills">{data.versions.filter((v) => v.agent_id === selectedAgent.id).map((version) => <span key={version.id}><b>v{version.version}</b>{relative(version.created_at)}</span>)}</div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {!loading && view === "sessions" ? (
            <section className="sessions-layout">
              <aside className="session-list">
                <div className="panel-heading"><div><p>HISTORY</p><h2>会话</h2></div><button onClick={() => void createSession()}>＋</button></div>
                {!data.sessions.length ? <div className="mini-empty">选择一个智能体开始首次会话。</div> : null}
                {data.sessions.map((session) => (
                  <button key={session.id} className={selectedSessionId === session.id ? "session-item selected" : "session-item"} onClick={() => void openSession(session.id)}>
                    <span>◌</span><span><b>{session.title}</b><small>{session.agent_name} · {relative(session.updated_at)}</small></span><em>{session.message_count}</em>
                  </button>
                ))}
              </aside>
              <div className="chat-panel">
                {selectedSession ? (
                  <>
                    <div className="chat-header"><div><span className="agent-icon">{selectedSession.agent_name.slice(0,1)}</span><span><b>{selectedSession.title}</b><small>{selectedSession.agent_name} · v{selectedSessionAgent?.version || 0}</small></span></div><span className="memory-live"><i />Memory active</span></div>
                    <div className="messages">
                      {!messages.length ? <div className="chat-welcome"><span>✦</span><h2>开始一段有记忆的对话</h2><p>试试：“记住，我更倾向使用 Go，尽量避免 Node.js。”<br />然后新建一个会话，询问后端技术方案。</p></div> : null}
                      {messages.map((message) => (
                        <div key={message.id} className={`message ${message.role}`}>
                          <span className="message-avatar">{message.role === "user" ? user.name.slice(0,1) : message.role === "assistant" ? "A" : "!"}</span>
                          <div><small>{message.role === "user" ? "你" : message.role === "assistant" ? selectedSession.agent_name : "运行错误"}</small><p>{message.content}</p></div>
                        </div>
                      ))}
                      {sending ? <div className="message assistant"><span className="message-avatar">A</span><div><small>{selectedSession.agent_name}</small><p className="typing"><i /><i /><i /></p></div></div> : null}
                    </div>
                    <form className="composer" onSubmit={sendMessage}>
                      <div className="composer-meta"><span>✦ 自动召回相关长期记忆</span><span>{selectedSessionAgent?.model}</span></div>
                      <div><textarea aria-label="消息" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }}} placeholder="输入消息，Enter 发送，Shift + Enter 换行…" rows={2} /><button disabled={sending || !chatInput.trim()} aria-label="发送">↑</button></div>
                    </form>
                  </>
                ) : (
                  <div className="session-empty"><div className="orb">✦</div><h1>选择或创建一个会话</h1><p>会话保存当前聊天历史，长期记忆在同一智能体的不同 Session 之间共享。</p><button className="primary-button" onClick={() => void createSession()}>开始新会话</button></div>
                )}
              </div>
            </section>
          ) : null}

          {!loading && view === "memories" ? (
            <section className="memory-page">
              <div className="page-heading"><div><p>LONG-TERM MEMORY</p><h1>长期记忆</h1><span>可查看、添加和删除。每条记忆都绑定智能体，并与 Session 历史分离。</span></div><select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>{data.agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></div>
              <form className="add-memory" onSubmit={addMemory}><span>✦</span><input value={memoryText} onChange={(e) => setMemoryText(e.target.value)} placeholder="手动补充一条长期事实或偏好…" /><button>添加记忆</button></form>
              <div className="memory-table">
                <div className="table-head"><span>MEMORY</span><span>TYPE</span><span>CONFIDENCE</span><span>SOURCE</span><span /></div>
                {data.memories.filter((memory) => memory.agent_id === selectedAgentId).map((memory) => (
                  <div className="memory-row" key={memory.id}><div><span className="memory-dot">✦</span><p>{memory.content}<small>{memory.agent_name} · {relative(memory.created_at)}</small></p></div><span className="kind-badge">{memory.kind}</span><span className="confidence"><i style={{width:`${memory.confidence}%`}} /><b>{memory.confidence}%</b></span><code>{memory.source_session_id ? "conversation" : "manual"}</code><button onClick={() => void deleteMemory(memory.id)} aria-label="删除记忆">×</button></div>
                ))}
                {!data.memories.some((memory) => memory.agent_id === selectedAgentId) ? <div className="table-empty">还没有长期记忆。在会话中说“记住……”即可自动提取。</div> : null}
              </div>
            </section>
          ) : null}

          {!loading && view === "settings" ? (
            <section className="settings-page">
              <div className="page-heading"><div><p>RUNTIME SETTINGS</p><h1>运行设置</h1><span>配置只影响当前浏览器会话，不写入 Agent Memory 数据库。</span></div></div>
              <div className="settings-grid">
                <article className="settings-card key-card"><div className="settings-icon">⌁</div><div><h2>OpenAI API Key</h2><p>用于调用 Responses API。Key 仅保存在当前页面内存中，刷新后自动清除。</p></div><label><span>API KEY</span><div><input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" autoComplete="off" /><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? "隐藏" : "显示"}</button></div></label><div className={apiKey ? "connection connected" : "connection"}><i />{apiKey ? "已配置，可以开始真实会话" : "尚未配置，模型调用会保持关闭"}</div></article>
                <article className="settings-card"><div className="settings-icon">DB</div><div><h2>持久化存储</h2><p>智能体、不可变版本、Session、消息与长期记忆均保存到平台数据库。</p></div><ul><li><span>Agents & Versions</span><b>Online</b></li><li><span>Sessions & Messages</span><b>Online</b></li><li><span>Long-term Memory</span><b>Online</b></li></ul></article>
                <article className="settings-card"><div className="settings-icon">↔</div><div><h2>身份与隔离</h2><p>当前工作区数据通过已认证用户身份隔离。记忆进一步按 Agent 作用域区分。</p></div><code>{user.email}</code><small>memory scope · owner / agent</small></article>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {newAgentOpen ? (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setNewAgentOpen(false); }}>
          <form className="modal" onSubmit={createAgent}><button type="button" className="modal-close" onClick={() => setNewAgentOpen(false)}>×</button><span className="modal-mark">◇</span><p>NEW AGENT</p><h2>创建智能体</h2><label><span>名称</span><input autoFocus value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="例如：产品架构助手" /></label><div><button type="button" className="ghost-button" onClick={() => setNewAgentOpen(false)}>取消</button><button className="primary-button">创建草稿</button></div></form>
        </div>
      ) : null}
    </main>
  );
}

function Overview({ userName, data, metrics, onAgent, onSession, onStart }: {
  userName: string; data: Dashboard; metrics: Record<string, number>;
  onAgent: (id: string) => void; onSession: (id: string) => void; onStart: (id: string) => void;
}) {
  return (
    <section className="overview">
      <div className="welcome"><div><p>GOOD TO SEE YOU</p><h1>早上好，{userName.split(" ")[0]}</h1><span>你的 Agent 运行态与长期记忆都已准备好。</span></div><div className="date-chip"><span>{new Date().toLocaleDateString("zh-CN",{month:"long",day:"numeric"})}</span><small>{new Date().toLocaleDateString("zh-CN",{weekday:"long"})}</small></div></div>
      <div className="metric-grid">
        <article><span className="metric-icon blue">◇</span><div><small>已发布智能体</small><b>{String(metrics.published).padStart(2,"0")}</b><em>共 {data.agents.length} 个草稿与版本</em></div></article>
        <article><span className="metric-icon purple">◌</span><div><small>持久会话</small><b>{String(metrics.sessions).padStart(2,"0")}</b><em>{metrics.messages} 条历史消息</em></div></article>
        <article><span className="metric-icon green">✦</span><div><small>长期记忆</small><b>{metrics.memories}</b><em>跨 Session 可召回</em></div></article>
        <article><span className="metric-icon amber">↗</span><div><small>不可变版本</small><b>{data.versions.length}</b><em>发布后可持续追溯</em></div></article>
      </div>
      <div className="overview-grid">
        <article className="overview-card agents-card"><div className="card-title"><div><p>YOUR AGENTS</p><h2>智能体</h2></div><span>{data.agents.length} total</span></div><div className="agent-cards">{data.agents.slice(0,3).map((agent,index) => <button key={agent.id} onClick={() => onAgent(agent.id)}><span className={`agent-art art-${index%3}`}><i>{agent.name.slice(0,1)}</i><b>v{agent.version}</b></span><span><b>{agent.name}</b><small>{agent.description}</small><em><i className={agent.status} />{agent.status === "published" ? "Production" : "Draft changed"}<u>{agent.model}</u></em></span></button>)}</div></article>
        <article className="overview-card activity-card"><div className="card-title"><div><p>RECENT ACTIVITY</p><h2>最近会话</h2></div><span>Live</span></div><div className="activity-list">{data.sessions.slice(0,5).map((session) => <button key={session.id} onClick={() => onSession(session.id)}><span className="activity-icon">◌</span><span><b>{session.title}</b><small>{session.agent_name} · {session.message_count} 条消息</small></span><time>{relative(session.updated_at)}</time></button>)}{!data.sessions.length ? <div className="activity-empty"><span>◌</span><p>还没有会话记录</p><small>从右侧智能体开始第一次对话</small></div> : null}</div></article>
      </div>
      <div className="quick-run"><div><span className="quick-mark">✦</span><span><p>QUICK RUN</p><h2>立即开始一段有记忆的会话</h2><small>选择已发布智能体，Session 历史与长期记忆会分别保存。</small></span></div><div>{data.agents.filter((agent) => agent.status === "published").slice(0,3).map((agent) => <button key={agent.id} onClick={() => onStart(agent.id)}><span>{agent.name.slice(0,1)}</span>{agent.name}<i>→</i></button>)}</div></div>
    </section>
  );
}
