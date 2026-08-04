import Link from "next/link";
import { AgentCard } from "@/components/agent-card";
import { PageHeader } from "@/components/page-header";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { agents } from "@/lib/data";

export default function AgentsPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Build"
        title="智能体"
        description="创建、配置、调试和发布你的智能体。已发布版本可直接进入会话页面使用。"
        actions={<Link className="button primary" href="/agents/new"><PlusIcon />创建智能体</Link>}
      />
      <div className="toolbar">
        <label className="search-field"><SearchIcon /><input aria-label="搜索智能体" placeholder="搜索智能体名称或描述" /></label>
        <div className="segmented"><button className="active">全部 {agents.length}</button><button>运行中</button><button>草稿</button><button>已下线</button></div>
      </div>
      <div className="agent-grid">{agents.map((agent) => <AgentCard agent={agent} key={agent.id} />)}</div>
    </div>
  );
}
