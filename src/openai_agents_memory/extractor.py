from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Protocol

from agents import Agent, Runner

from .identity import MemoryScope
from .models import MemoryExtractionBatch, MemoryRecord


class MemoryExtractor(Protocol):
    async def extract(
        self,
        *,
        scope: MemoryScope,
        user_input: str,
        assistant_output: str,
        existing_memories: Sequence[MemoryRecord],
    ) -> MemoryExtractionBatch: ...


class OpenAIAgentMemoryExtractor:
    def __init__(self, *, model: str = "gpt-5-mini") -> None:
        self._agent = Agent(
            name="Long-term memory extractor",
            model=model,
            output_type=MemoryExtractionBatch,
            instructions=(
                "Extract only durable, user-specific facts useful in future sessions. "
                "Return upsert, delete, or noop operations. Prefer stable dotted keys. "
                "Update existing keys instead of creating duplicates. Never store passwords, "
                "tokens, private keys, payment credentials, government identifiers, raw medical "
                "records, or model speculation. Forget requests should emit delete. Temporary "
                "task parameters and ordinary questions should emit noop."
            ),
        )

    async def extract(
        self,
        *,
        scope: MemoryScope,
        user_input: str,
        assistant_output: str,
        existing_memories: Sequence[MemoryRecord],
    ) -> MemoryExtractionBatch:
        payload = {
            "scope": scope.key,
            "existing_memories": [
                {
                    "memory_key": item.memory_key,
                    "content": item.content,
                    "confidence": item.confidence,
                }
                for item in existing_memories
            ],
            "conversation_turn": {"user": user_input, "assistant": assistant_output},
        }
        result = await Runner.run(self._agent, json.dumps(payload, ensure_ascii=False))
        output = result.final_output
        if isinstance(output, MemoryExtractionBatch):
            return output
        return MemoryExtractionBatch.model_validate(output)
