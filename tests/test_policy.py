from openai_agents_memory import MemoryPolicy


def test_explicit_memory_request_is_inline() -> None:
    policy = MemoryPolicy()
    assert policy.requires_inline_extraction("请记住，我偏好 Go")
    assert policy.requires_inline_extraction("Remember that I prefer Python")
    assert not policy.requires_inline_extraction("解释一下 pgvector")
