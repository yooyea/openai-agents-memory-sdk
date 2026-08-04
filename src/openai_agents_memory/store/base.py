from __future__ import annotations

from typing import Protocol, Sequence

from ..identity import MemoryScope
from ..models import MemoryOperation, MemoryRecord


class MemoryStore(Protocol):
    async def search(
        self,
        *,
        scope: MemoryScope,
        query: str,
        limit: int = 8,
    ) -> Sequence[MemoryRecord]: ...

    async def apply(
        self,
        *,
        scope: MemoryScope,
        operations: Sequence[MemoryOperation],
        source_session_id: str | None = None,
        source_run_id: str | None = None,
    ) -> None: ...

    async def delete_scope(self, *, scope: MemoryScope) -> int: ...

    async def close(self) -> None: ...
