import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ArrowIcon, ChatIcon, MemoryIcon } from "@/components/icons";
import { agents } from "@/lib/data";
import { StatusPill } from "@/components/status-pill";

export default function ChatHomePage() {
  const availableAgents = agents.filter((agent) => agent.status === "published");
  return (
    <div className="page">
      <PageHeader eyebrow="Use" title="开始会话" description="选择一个已发布的智能体，进入生产环境持续、有记忆地使用它。" />
      <div className="chat-agent-grid">{availableAgents.map((agent) => <Link href={`/chat/${agent.id}/session-workflow`} className="chat-agent-card" key={agent.id}><div className="agent-icon large" style={{ "--agent-accent": agent.accent } as React.CSSProperties}>{agent.initials}</div><div className="chat-agent-heading"><h2>{agent.name}</h2><StatusPill status={agent.status} /></div><p>{agent.description}</p><div className="chat-agent-tags"><span><ChatIcon />{agent.sessions} 个会话</span>{agent.memoryEnabled ? <span className="memory-on"><MemoryIcon />跨会话记忆</span> : null}</div><footer><small>生产版本 {agent.productionVersion}</small><span>进入会话 <ArrowIcon /></span></footer></Link>)}</div>
    </div>
  );
}
