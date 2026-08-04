from __future__ import annotations

from dataclasses import dataclass


def _validate_segment(name: str, value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{name} must not be empty")
    if ":" in normalized:
        raise ValueError(f"{name} must not contain ':'")
    return normalized


@dataclass(frozen=True, slots=True)
class MemoryScope:
    tenant_id: str
    user_id: str
    agent_id: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "tenant_id", _validate_segment("tenant_id", self.tenant_id))
        object.__setattr__(self, "user_id", _validate_segment("user_id", self.user_id))
        if self.agent_id is not None:
            object.__setattr__(self, "agent_id", _validate_segment("agent_id", self.agent_id))

    @property
    def key(self) -> str:
        agent = self.agent_id or "*"
        return f"{self.tenant_id}:{agent}:{self.user_id}"


@dataclass(frozen=True, slots=True)
class AgentIdentity:
    tenant_id: str
    agent_id: str
    user_id: str
    session_id: str

    def __post_init__(self) -> None:
        for name in ("tenant_id", "agent_id", "user_id", "session_id"):
            object.__setattr__(self, name, _validate_segment(name, getattr(self, name)))

    @property
    def session_key(self) -> str:
        return f"{self.tenant_id}:{self.agent_id}:{self.user_id}:{self.session_id}"

    def memory_scope(self, *, share_across_agents: bool = False) -> MemoryScope:
        return MemoryScope(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            agent_id=None if share_across_agents else self.agent_id,
        )
