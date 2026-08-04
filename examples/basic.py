from __future__ import annotations

import asyncio
import os

from agents import Agent

from openai_agents_memory import (
    AgentIdentity,
    ExtractionMode,
    MemoryPolicy,
    MemoryRunContext,
    MemoryRunner,
    OpenAIAgentMemoryExtractor,
    OpenAIEmbeddingProvider,
    PostgresMemoryStore,
    SQLAlchemySessionFactory,
)


async def main() -> None:
    database_url = os.environ["DATABASE_URL"]

    store = PostgresMemoryStore(
        database_url=database_url,
        embedding_provider=OpenAIEmbeddingProvider(),
    )
    sessions = SQLAlchemySessionFactory(
        database_url=database_url,
        create_tables=True,
        enable_compaction=True,
    )
    runner = MemoryRunner(
        store=store,
        extractor=OpenAIAgentMemoryExtractor(
            model=os.getenv("MEMORY_EXTRACTION_MODEL", "gpt-5-mini")
        ),
        session_factory=sessions,
        memory_policy=MemoryPolicy(extraction_mode=ExtractionMode.INLINE),
    )
    agent = Agent[MemoryRunContext](
        name="Technical assistant",
        model="gpt-5-mini",
        instructions="你是一个简洁、可靠的技术助手。",
    )

    first = await runner.run(
        agent=agent,
        input="记住，我更倾向使用 Go，尽量避免 Node.js。",
        identity=AgentIdentity(
            tenant_id="demo",
            agent_id="technical-assistant",
            user_id="user-001",
            session_id="session-a",
        ),
    )
    print(first.final_output)

    second = await runner.run(
        agent=agent,
        input="结合我的偏好，推荐一个后端技术方案。",
        identity=AgentIdentity(
            tenant_id="demo",
            agent_id="technical-assistant",
            user_id="user-001",
            session_id="session-b",
        ),
    )
    print(second.final_output)

    await store.close()
    await sessions.close()


if __name__ == "__main__":
    asyncio.run(main())
