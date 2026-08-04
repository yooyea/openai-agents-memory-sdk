import type { AgentSummary, AgentVersion, ChatMessage, SessionSummary } from "./types";

export const agents: AgentSummary[] = [
  {
    id: "product-copilot",
    name: "产品需求助手",
    description: "协助澄清需求、沉淀决策，并持续记住项目约束与用户偏好。",
    status: "published",
    model: "GPT-5 mini",
    latestVersion: "v8",
    productionVersion: "v7",
    sessions: 286,
    runsToday: 1248,
    memoryEnabled: true,
    accent: "#7c5cff",
    initials: "PR",
    updatedAt: "8 分钟前",
  },
  {
    id: "oncall-analyst",
    name: "Oncall 分析助手",
    description: "从工单与讨论中定位根因，生成复盘摘要和后续行动项。",
    status: "published",
    model: "GPT-5 mini",
    latestVersion: "v5",
    productionVersion: "v5",
    sessions: 173,
    runsToday: 642,
    memoryEnabled: true,
    accent: "#00a87a",
    initials: "OA",
    updatedAt: "34 分钟前",
  },
  {
    id: "architecture-reviewer",
    name: "架构评审助手",
    description: "结合团队架构原则，对技术方案进行结构化评审。",
    status: "draft",
    model: "GPT-5 mini",
    latestVersion: "v2",
    sessions: 18,
    runsToday: 36,
    memoryEnabled: false,
    accent: "#ec7d36",
    initials: "AR",
    updatedAt: "2 小时前",
  },
  {
    id: "meeting-notes",
    name: "会议纪要助手",
    description: "提取会议结论、争议点、责任人与截止时间。",
    status: "offline",
    model: "GPT-5 mini",
    latestVersion: "v3",
    productionVersion: "v2",
    sessions: 91,
    runsToday: 0,
    memoryEnabled: true,
    accent: "#3d77f3",
    initials: "MN",
    updatedAt: "3 天前",
  },
];

export const versions: AgentVersion[] = [
  { version: "v8", status: "staging", publishedAt: "今天 23:46", summary: "优化需求冲突识别与记忆更新策略" },
  { version: "v7", status: "production", publishedAt: "7 月 31 日", summary: "增加项目级记忆与会话版本绑定" },
  { version: "v6", status: "archived", publishedAt: "7 月 22 日", summary: "调整工具调用策略" },
];

export const sessions: SessionSummary[] = [
  {
    id: "session-workflow",
    title: "工作流模板版本设计",
    updatedAt: "刚刚",
    preview: "存量需求继续绑定创建时的模板版本……",
    version: "v7",
  },
  {
    id: "session-memory",
    title: "长期记忆边界讨论",
    updatedAt: "昨天",
    preview: "Session History 与 User Memory 必须分开……",
    version: "v7",
  },
  {
    id: "session-api",
    title: "运行态 API 设计",
    updatedAt: "周一",
    preview: "新建会话时绑定当前生产版本……",
    version: "v6",
  },
];

export const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content: "晚上好。我已经加载了这个项目的架构约束、已确认决策和你偏好的输出方式。今天准备继续讨论哪一部分？",
    time: "00:02",
    meta: "召回 4 条长期记忆 · Agent v7",
  },
  {
    id: "m2",
    role: "user",
    content: "继续完善智能体平台。发布新版本后，已经存在的会话应该怎么处理？",
    time: "00:04",
  },
  {
    id: "m3",
    role: "assistant",
    content:
      "建议让会话在创建时绑定不可变的 Agent Version。发布 v8 后，已有会话继续使用 v7，新会话默认使用 v8。这样 Prompt、Tool 和 Memory 策略不会在聊天中途发生变化，也便于复现问题。第一版不做自动升级，只提供“新建会话使用最新版”。",
    time: "00:04",
    meta: "基于项目记忆：版本不可变、存量数据不受新版本影响",
  },
];

export function getAgent(agentId: string): AgentSummary {
  return agents.find((agent) => agent.id === agentId) ?? agents[0];
}
