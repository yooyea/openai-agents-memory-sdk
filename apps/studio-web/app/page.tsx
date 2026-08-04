import Link from "next/link";
import { AgentCard } from "@/components/agent-card";
import { PageHeader } from "@/components/page-header";
import { ArrowIcon, BotIcon, ChatIcon, MemoryIcon, PlusIcon, PulseIcon, RocketIcon } from "@/components/icons";
import { agents } from "@/lib/data";

export default function DashboardPage() {
  const activeAgents = agents.filter((agent) => agent.status === "published").length;
  const totalRuns = agents.reduce((sum, agent) => sum + agent.runsToday, 0);
  const totalSessions = agents.reduce((sum, agent) => sum + agent.sessions, 0);

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Workspace / Overview"
        title="晚上好，Mai Ning"
        description="在一个地方管理智能体的创建、调试、发布与持续会话。"
        actions={<><button className="button secondary"><PulseIcon />查看运行记录</button><Link className="button primary" href="/agents/new"><PlusIcon />创建智能体</Link></>}
      />

      <section className="metric-grid">
        <article className="metric-card"><div className="metric-icon purple"><BotIcon /></div><div><span>运行中的智能体</span><strong>{activeAgents}</strong><small>共 {agents.length} 个智能体</small></div></article>
        <article className="metric-card"><div className="metric-icon green"><PulseIcon /></div><div><span>今日运行</span><strong>{totalRuns.toLocaleString()}</strong><small>成功率 99.6%</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><ChatIcon /></div><div><span>累计会话</span><strong>{totalSessions.toLocaleString()}</strong><small>今日新增 47</small></div></article>
        <article className="metric-card"><div className="metric-icon orange"><MemoryIcon /></div><div><span>长期记忆</span><strong>1,864</strong><small>过去 7 天新增 216</small></div></article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-column wide">
          <div className="section-heading"><div><p className="eyebrow">Agents</p><h2>最近使用的智能体</h2></div><Link href="/agents">查看全部 <ArrowIcon /></Link></div>
          <div className="agent-grid compact">{agents.slice(0, 3).map((agent) => <AgentCard agent={agent} key={agent.id} />)}</div>
        </div>

        <aside className="dashboard-column quick-start">
          <div className="section-heading"><div><p className="eyebrow">Quick start</p><h2>开始使用</h2></div></div>
          <Link href="/agents/new" className="quick-item"><div><PlusIcon /></div><span><strong>创建一个智能体</strong><small>配置模型、Prompt、工具和记忆</small></span><ArrowIcon /></Link>
          <Link href="/agents/product-copilot" className="quick-item"><div><RocketIcon /></div><span><strong>继续调试草稿</strong><small>产品需求助手 · v8</small></span><ArrowIcon /></Link>
          <Link href="/chat/product-copilot/session-workflow" className="quick-item"><div><ChatIcon /></div><span><strong>进入生产会话</strong><small>使用已发布版本持续聊天</small></span><ArrowIcon /></Link>
          <div className="release-card"><span>生产版本</span><strong>产品需求助手 v7</strong><p>今日运行 1,248 次，平均响应 1.7s。</p><Link href="/chat/product-copilot/session-workflow">打开会话 <ArrowIcon /></Link></div>
        </aside>
      </section>
    </div>
  );
}
