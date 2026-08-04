import Link from "next/link";
import { AgentEditor } from "@/components/agent-editor";
import { PageHeader } from "@/components/page-header";
import { ChatIcon, PlayIcon } from "@/components/icons";
import { getAgent } from "@/lib/data";

export default async function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = getAgent(agentId);

  return (
    <div className="page editor-page">
      <PageHeader
        eyebrow="Agents / Configure"
        title={agent.name}
        description={`${agent.description} · 更新于 ${agent.updatedAt}`}
        actions={<><Link href={`/chat/${agent.id}/session-workflow`} className="button secondary"><ChatIcon />生产会话</Link><button className="button dark"><PlayIcon />调试</button></>}
      />
      <AgentEditor agent={agent} />
    </div>
  );
}
