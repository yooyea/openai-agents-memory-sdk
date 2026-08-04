import type { AgentStatus } from "@/lib/types";

const copy: Record<AgentStatus, string> = {
  draft: "草稿",
  published: "运行中",
  offline: "已下线",
};

export function StatusPill({ status }: { status: AgentStatus }) {
  return <span className={`status-pill ${status}`}><i />{copy[status]}</span>;
}
