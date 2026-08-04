"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AgentSummary, ChatMessage } from "@/lib/types";
import { initialMessages, sessions } from "@/lib/data";
import { ChatIcon, ChevronIcon, MemoryIcon, MoreIcon, PlusIcon, SendIcon, SparkIcon } from "./icons";

export function ChatWorkspace({ agent, sessionId }: { agent: AgentSummary; sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  function sendMessage() {
    const value = input.trim();
    if (!value || thinking) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: value, time: "00:16" }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "可以。下一步建议把管理态和运行态拆开实现：管理态负责草稿、版本和发布；运行态只读取不可变版本并处理会话。当前会话继续绑定 v7，新建会话使用最新生产版本。这个结论可以沉淀为项目级记忆。",
        time: "00:16",
        meta: "新增候选记忆：会话创建时绑定生产版本",
      }]);
      setThinking(false);
    }, 850);
  }

  return (
    <div className="chat-layout">
      <aside className="session-sidebar">
        <div className="session-agent"><div className="agent-icon" style={{ "--agent-accent": agent.accent } as React.CSSProperties}>{agent.initials}</div><div><strong>{agent.name}</strong><small>生产 {agent.productionVersion}</small></div><button><MoreIcon /></button></div>
        <button className="button primary full"><PlusIcon />新建会话</button>
        <p className="nav-caption">最近会话</p>
        <div className="session-list">{sessions.map((session) => <Link className={session.id === sessionId ? "active" : ""} href={`/chat/${agent.id}/${session.id}`} key={session.id}><ChatIcon /><span><strong>{session.title}</strong><small>{session.preview}</small></span><time>{session.updatedAt}</time></Link>)}</div>
        <div className="memory-summary"><div><MemoryIcon /><strong>长期记忆已开启</strong></div><p>当前作用域已保存 38 条记忆，本轮召回 4 条。</p><button>查看记忆 <ChevronIcon /></button></div>
      </aside>

      <section className="conversation">
        <header className="conversation-header"><div><h1>工作流模板版本设计</h1><p>Session 绑定 Agent {agent.productionVersion} · 创建于今天 00:02</p></div><div className="conversation-actions"><span className="online-dot">运行正常</span><button className="icon-button"><MoreIcon /></button></div></header>
        <div className="message-list">
          <div className="context-banner"><SparkIcon /><div><strong>已恢复上下文</strong><span>Session 摘要、项目约束和 4 条相关长期记忆已加入本轮上下文。</span></div><button>查看详情</button></div>
          {messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}>{message.role === "assistant" ? <div className="message-avatar" style={{ "--agent-accent": agent.accent } as React.CSSProperties}>{agent.initials}</div> : null}<div className="message-wrap"><div className="message-bubble">{message.content}</div><div className="message-meta"><time>{message.time}</time>{message.meta ? <span><MemoryIcon />{message.meta}</span> : null}</div></div></div>)}
          {thinking ? <div className="message-row assistant"><div className="message-avatar" style={{ "--agent-accent": agent.accent } as React.CSSProperties}>{agent.initials}</div><div className="message-wrap"><div className="message-bubble thinking"><i /><i /><i /></div><div className="message-meta"><span>正在读取上下文并生成回答</span></div></div></div> : null}
          <div ref={bottomRef} />
        </div>
        <footer className="composer"><div className="composer-box"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="输入消息，Shift + Enter 换行" rows={1} /><button className="send-button" onClick={sendMessage} disabled={!input.trim() || thinking}><SendIcon /></button></div><p>Agent 可能会犯错。重要结论请在发布前确认。</p></footer>
      </section>
    </div>
  );
}
