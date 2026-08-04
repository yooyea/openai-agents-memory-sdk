from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MemoryAction(str, Enum):
    UPSERT = "upsert"
    DELETE = "delete"
    NOOP = "noop"


class MemoryOperation(BaseModel):
    action: MemoryAction
    memory_key: str | None = None
    memory_type: str = "fact"
    content: str | None = None
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    expires_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("memory_key")
    @classmethod
    def validate_memory_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("memory_key must not be blank")
        return normalized

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class MemoryExtractionBatch(BaseModel):
    operations: list[MemoryOperation] = Field(default_factory=list)


class MemoryRecord(BaseModel):
    id: UUID
    scope_key: str
    tenant_id: str
    agent_id: str | None
    user_id: str
    memory_key: str
    memory_type: str
    content: str
    confidence: float
    importance: float
    source_session_id: str | None
    source_run_id: str | None
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryExtractionJob(BaseModel):
    tenant_id: str
    agent_id: str
    user_id: str
    session_id: str
    run_id: str | None = None
    user_input: str
    assistant_output: str
