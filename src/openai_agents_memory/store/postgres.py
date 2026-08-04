from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from ..embeddings import EmbeddingProvider
from ..identity import MemoryScope
from ..models import MemoryAction, MemoryOperation, MemoryRecord


def _vector_literal(values: Sequence[float]) -> str:
    return "[" + ",".join(f"{value:.10g}" for value in values) + "]"


class PostgresMemoryStore:
    def __init__(
        self,
        *,
        database_url: str,
        embedding_provider: EmbeddingProvider | None = None,
        engine: AsyncEngine | None = None,
    ) -> None:
        self._owns_engine = engine is None
        self.engine = engine or create_async_engine(database_url, pool_pre_ping=True)
        self.embedding_provider = embedding_provider

    async def search(
        self,
        *,
        scope: MemoryScope,
        query: str,
        limit: int = 8,
    ) -> Sequence[MemoryRecord]:
        params: dict[str, Any] = {"scope_key": scope.key, "limit": limit}
        order = "importance DESC, updated_at DESC"
        if self.embedding_provider is not None:
            params["embedding"] = _vector_literal(await self.embedding_provider.embed(query))
            order = "CASE WHEN embedding IS NULL THEN 1 ELSE 0 END, embedding <=> CAST(:embedding AS vector), importance DESC, updated_at DESC"
        statement = text(
            f"""
            SELECT id, scope_key, tenant_id, agent_id, user_id, memory_key, memory_type,
                   content, confidence, importance, source_session_id, source_run_id,
                   expires_at, created_at, updated_at, metadata
            FROM agent_memories
            WHERE scope_key = :scope_key
              AND deleted_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY {order}
            LIMIT :limit
            """
        )
        async with self.engine.connect() as connection:
            rows = (await connection.execute(statement, params)).mappings().all()
        return [MemoryRecord.model_validate(dict(row)) for row in rows]

    async def apply(
        self,
        *,
        scope: MemoryScope,
        operations: Sequence[MemoryOperation],
        source_session_id: str | None = None,
        source_run_id: str | None = None,
    ) -> None:
        async with self.engine.begin() as connection:
            for operation in operations:
                if operation.action is MemoryAction.NOOP or operation.memory_key is None:
                    continue
                if operation.action is MemoryAction.DELETE:
                    await connection.execute(
                        text("UPDATE agent_memories SET deleted_at=NOW(), updated_at=NOW() WHERE scope_key=:scope_key AND memory_key=:memory_key AND deleted_at IS NULL"),
                        {"scope_key": scope.key, "memory_key": operation.memory_key},
                    )
                    continue
                if operation.content is None:
                    continue
                embedding = None
                if self.embedding_provider is not None:
                    embedding = _vector_literal(await self.embedding_provider.embed(operation.content))
                await connection.execute(
                    text(
                        """
                        INSERT INTO agent_memories (
                            scope_key, tenant_id, agent_id, user_id, memory_key, memory_type,
                            content, embedding, confidence, importance, source_session_id,
                            source_run_id, expires_at, metadata
                        ) VALUES (
                            :scope_key, :tenant_id, :agent_id, :user_id, :memory_key, :memory_type,
                            :content, CAST(:embedding AS vector), :confidence, :importance,
                            :source_session_id, :source_run_id, :expires_at, CAST(:metadata AS jsonb)
                        )
                        ON CONFLICT (scope_key, memory_key) DO UPDATE SET
                            memory_type=EXCLUDED.memory_type,
                            content=EXCLUDED.content,
                            embedding=EXCLUDED.embedding,
                            confidence=EXCLUDED.confidence,
                            importance=EXCLUDED.importance,
                            source_session_id=EXCLUDED.source_session_id,
                            source_run_id=EXCLUDED.source_run_id,
                            expires_at=EXCLUDED.expires_at,
                            metadata=EXCLUDED.metadata,
                            deleted_at=NULL,
                            version=agent_memories.version+1,
                            updated_at=NOW()
                        """
                    ),
                    {
                        "scope_key": scope.key,
                        "tenant_id": scope.tenant_id,
                        "agent_id": scope.agent_id,
                        "user_id": scope.user_id,
                        "memory_key": operation.memory_key,
                        "memory_type": operation.memory_type,
                        "content": operation.content,
                        "embedding": embedding,
                        "confidence": operation.confidence,
                        "importance": operation.importance,
                        "source_session_id": source_session_id,
                        "source_run_id": source_run_id,
                        "expires_at": operation.expires_at,
                        "metadata": json.dumps(operation.metadata),
                    },
                )

    async def delete_scope(self, *, scope: MemoryScope) -> int:
        async with self.engine.begin() as connection:
            result = await connection.execute(
                text("UPDATE agent_memories SET deleted_at=NOW(), updated_at=NOW() WHERE scope_key=:scope_key AND deleted_at IS NULL"),
                {"scope_key": scope.key},
            )
        return int(result.rowcount or 0)

    async def close(self) -> None:
        if self._owns_engine:
            await self.engine.dispose()
