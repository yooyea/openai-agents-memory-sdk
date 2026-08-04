import { ChatWorkspace } from "@/components/chat-workspace";
import { getAgent } from "@/lib/data";

export default async function ConversationPage({ params }: { params: Promise<{ agentId: string; sessionId: string }> }) {
  const { agentId, sessionId } = await params;
  return <ChatWorkspace agent={getAgent(agentId)} sessionId={sessionId} />;
}
