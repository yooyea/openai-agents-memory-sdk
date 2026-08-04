import Link from "next/link";
import type { AgentSummary } from "@/lib/types";
import { ArrowIcon, MemoryIcon, MoreIcon } from "./icons";
import { StatusPill } from "./status-pill";

export function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <article className="agent-card">
      <div className="agent-card-top">
        <div className="agent-icon" style={{ "--agent-accent": agent.accent } as React.CSSProperties}>{agent.initials}</div>
        <button className="icon-button" aria-label="更多操作"><MoreIcon /></button>
      </div>
      <div className="agent-heading">
        <h3>{agent.name}</h3>
        <StatusPill status={agent.status} />
      </div>
      <p>{agent.description}</p>
      <div className="agent-meta-row">
        <span>{agent.model}</span>
        <span>{agent.productionVersion ? `生产 ${agent.productionVersion}` : `草稿 ${agent.latestVersion}`}</span>
      </div>
      <div className="agent-stats">
        <div><strong>{agent.sessions}</strong><span>会话</span></div>
        <div><strong>{agent.runsToday.toLocaleString()}</strong><span>今日运行</span></div>
        <div className={agent.memoryEnabled ? "memory-on" : ""}><MemoryIcon /><span>{agent.memoryEnabled ? "记忆已开启" : "记忆未开启"}</span></div>
      </div>
      <footer>
        <span>更新于 {agent.updatedAt}</span>
        <Link href={`/agents/${agent.id}`}>配置智能体 <ArrowIcon /></Link>
      </footer>
    </article>
  );
}
