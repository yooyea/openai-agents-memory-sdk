from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ExtractionMode(str, Enum):
    INLINE = "inline"
    BACKGROUND = "background"
    DISABLED = "disabled"


@dataclass(frozen=True, slots=True)
class MemoryPolicy:
    extraction_mode: ExtractionMode = ExtractionMode.BACKGROUND
    share_across_agents: bool = False
    min_confidence: float = 0.75
    allow_sensitive_memory: bool = False
    explicit_memory_markers: tuple[str, ...] = (
        "记住",
        "以后都",
        "固定偏好",
        "remember",
        "from now on",
        "my preference is",
    )

    def requires_inline_extraction(self, user_input: str) -> bool:
        normalized = user_input.casefold()
        return any(marker.casefold() in normalized for marker in self.explicit_memory_markers)


@dataclass(frozen=True, slots=True)
class ContextPolicy:
    max_memory_items: int = 8
    max_memory_chars: int = 6_000
    memory_heading: str = "Relevant user memory"
