import { AgentEditor } from "@/components/agent-editor";
import { PageHeader } from "@/components/page-header";
import type { AgentSummary } from "@/lib/types";

const newAgent: AgentSummary = {
  id: "new-agent",
  name: "未命名智能体",
  description: "描述这个智能体准备解决的问题。",
  status: "draft",
  model: "GPT-5 mini",
  latestVersion: "draft",
  sessions: 0,
  runsToday: 0,
  memoryEnabled: true,
  accent: "#6f4df5",
  initials: "NA",
  updatedAt: "刚刚",
};

export default function NewAgentPage() {
  return (
    <div className="page editor-page">
      <PageHeader eyebrow="Agents / New" title="创建智能体" description="先完成基础配置，再进入调试和发布。" />
      <AgentEditor agent={newAgent} />
    </div>
  );
}
