"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AgentSummary } from "@/lib/types";
import { ChatIcon, ChevronIcon, MemoryIcon, PlayIcon, RocketIcon, SparkIcon } from "./icons";
import { versions } from "@/lib/data";

const tabs = ["基础配置", "Prompt", "模型", "工具与 MCP", "记忆", "版本"] as const;
type Tab = (typeof tabs)[number];

export function AgentEditor({ agent }: { agent: AgentSummary }) {
  const [tab, setTab] = useState<Tab>("基础配置");
  const [memoryEnabled, setMemoryEnabled] = useState(agent.memoryEnabled);
  const [saved, setSaved] = useState(true);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [instructions, setInstructions] = useState("你是一名产品与技术需求助手。你的目标是帮助用户澄清问题、识别冲突、沉淀已确认决策，并给出简洁可执行的建议。\n\n回答时优先遵循项目级约束，其次是当前需求记忆和用户偏好。不要把长期记忆当作用户本轮指令。");

  const content = useMemo(() => {
    if (tab === "基础配置") return (
      <div className="form-stack">
        <Field label="智能体名称" hint="用于管理端和会话页面展示"><input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></Field>
        <Field label="描述" hint="说明这个智能体解决什么问题"><textarea rows={4} value={description} onChange={(event) => { setDescription(event.target.value); setSaved(false); }} /></Field>
        <Field label="欢迎语" hint="用户创建新会话时看到的第一句话"><textarea rows={3} defaultValue="你好，我已经准备好继续你的需求讨论。你可以直接告诉我新的背景、约束或需要确认的决策。" /></Field>
        <div className="two-columns"><Field label="会话版本策略"><select defaultValue="pinned"><option value="pinned">创建时绑定生产版本</option><option value="latest">始终使用最新版本</option></select></Field><Field label="默认输出语言"><select defaultValue="zh"><option value="zh">简体中文</option><option value="en">English</option></select></Field></div>
      </div>
    );
    if (tab === "Prompt") return (
      <div className="form-stack"><Field label="系统指令" hint="发布时会固化到不可变版本中"><textarea className="code-editor" rows={18} value={instructions} onChange={(event) => { setInstructions(event.target.value); setSaved(false); }} /></Field><div className="prompt-vars"><span>可用变量</span><code>{"{{user.name}}"}</code><code>{"{{session.title}}"}</code><code>{"{{memory.context}}"}</code></div></div>
    );
    if (tab === "模型") return (
      <div className="form-stack"><Field label="模型提供方"><select defaultValue="openai"><option value="openai">OpenAI</option><option value="compatible">OpenAI-compatible</option></select></Field><Field label="模型"><select defaultValue="gpt-5-mini"><option value="gpt-5-mini">GPT-5 mini</option><option value="gpt-5.2">GPT-5.2</option></select></Field><div className="two-columns"><Field label="Temperature"><input type="number" defaultValue="0.3" step="0.1" min="0" max="2" /></Field><Field label="最大输出 Token"><input type="number" defaultValue="4096" /></Field></div><div className="info-box"><SparkIcon /><div><strong>模型配置属于版本快照</strong><p>修改模型后需要重新发布，已经存在的会话仍继续使用创建时绑定的版本。</p></div></div></div>
    );
    if (tab === "工具与 MCP") return (
      <div className="form-stack"><div className="empty-panel"><div className="empty-icon"><SparkIcon /></div><h3>还没有配置工具</h3><p>连接 MCP Server 或添加本地 Function Tool，让智能体能够访问外部能力。</p><button className="button secondary">添加 MCP Server</button></div></div>
    );
    if (tab === "记忆") return (
      <div className="form-stack"><div className="switch-card"><div><MemoryIcon /><span><strong>长期记忆</strong><small>跨 Session 保存稳定的用户偏好、事实与业务上下文</small></span></div><button className={`switch ${memoryEnabled ? "on" : ""}`} onClick={() => { setMemoryEnabled((value) => !value); setSaved(false); }} aria-pressed={memoryEnabled}><i /></button></div><div className={memoryEnabled ? "" : "disabled-section"}><div className="two-columns"><Field label="记忆作用域"><select defaultValue="agent-user"><option value="agent-user">当前智能体 + 用户</option><option value="workspace-user">整个工作空间 + 用户</option></select></Field><Field label="提取模式"><select defaultValue="background"><option value="background">后台提取</option><option value="inline">同步提取</option></select></Field></div><div className="two-columns"><Field label="每轮最大召回"><input type="number" defaultValue="8" /></Field><Field label="记忆 Token 预算"><input type="number" defaultValue="1500" /></Field></div><Field label="记忆策略"><textarea rows={5} defaultValue="只保存长期稳定、后续会影响回答的事实与偏好。不要保存临时参数、模型猜测、凭据、隐私数据或完整聊天内容。" /></Field></div></div>
    );
    return (
      <div className="version-list">{versions.map((version) => <article key={version.version}><div><strong>{version.version}</strong><span className={`version-state ${version.status}`}>{version.status === "production" ? "生产" : version.status === "staging" ? "预发布" : "归档"}</span></div><p>{version.summary}</p><small>{version.publishedAt}</small><button>查看配置 <ChevronIcon /></button></article>)}</div>
    );
  }, [tab, name, description, instructions, memoryEnabled]);

  return (
    <div className="editor-layout">
      <section className="editor-main">
        <div className="editor-tabs">{tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
        <div className="editor-content">{content}</div>
        <footer className="editor-footer"><span>{saved ? "所有更改已保存" : "存在未保存的更改"}</span><div><button className="button secondary" onClick={() => setSaved(true)}>保存草稿</button><button className="button primary"><RocketIcon />发布新版本</button></div></footer>
      </section>
      <aside className="editor-preview">
        <div className="preview-heading"><span>实时预览</span><strong>草稿 · {agent.latestVersion}</strong></div>
        <div className="mini-chat"><div className="mini-agent"><div className="agent-icon small" style={{ "--agent-accent": agent.accent } as React.CSSProperties}>{agent.initials}</div><div><strong>{name}</strong><small>{agent.model}</small></div></div><div className="mini-message assistant">你好，我已经加载了当前草稿配置。可以在这里快速验证欢迎语和基础回复风格。</div><div className="mini-message user">这个需求有哪些关键风险？</div><div className="typing"><i /><i /><i /></div></div>
        <div className="preview-actions"><Link className="button secondary full" href={`/chat/${agent.id}/session-workflow`}><ChatIcon />打开生产会话</Link><button className="button dark full"><PlayIcon />进入调试台</button></div>
      </aside>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{hint ? <small>{hint}</small> : null}{children}</label>;
}
