export type AgentStatus = "draft" | "published" | "offline";

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  model: string;
  latestVersion: string;
  productionVersion?: string;
  sessions: number;
  runsToday: number;
  memoryEnabled: boolean;
  accent: string;
  initials: string;
  updatedAt: string;
}

export interface AgentVersion {
  version: string;
  status: "production" | "staging" | "archived";
  publishedAt: string;
  summary: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
  version: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  time: string;
  meta?: string;
}
