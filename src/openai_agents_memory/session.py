from __future__ import annotations

from typing import Any

from agents.extensions.memory import SQLAlchemySession
from agents.memory import OpenAIResponsesCompactionSession
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from .identity import AgentIdentity


class SQLAlchemySessionFactory:
    def __init__(
        self,
        *,
        database_url: str,
        create_tables: bool = False,
        enable_compaction: bool = True,
        engine: AsyncEngine | None = None,
    ) -> None:
        self._owns_engine = engine is None
        self.engine = engine or create_async_engine(database_url, pool_pre_ping=True)
        self.create_tables = create_tables
        self.enable_compaction = enable_compaction

    def create(self, identity: AgentIdentity) -> Any:
        underlying = SQLAlchemySession(
            identity.session_key,
            engine=self.engine,
            create_tables=self.create_tables,
        )
        if not self.enable_compaction:
            return underlying
        return OpenAIResponsesCompactionSession(
            session_id=identity.session_key,
            underlying_session=underlying,
        )

    async def close(self) -> None:
        if self._owns_engine:
            await self.engine.dispose()
