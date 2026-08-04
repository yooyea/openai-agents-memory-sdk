import pytest

from openai_agents_memory import AgentIdentity


def test_identity_builds_stable_keys() -> None:
    identity = AgentIdentity(
        tenant_id="tenant",
        agent_id="agent",
        user_id="user",
        session_id="session",
    )
    assert identity.session_key == "tenant:agent:user:session"
    assert identity.memory_scope().key == "tenant:agent:user"
    assert identity.memory_scope(share_across_agents=True).key == "tenant:*:user"


def test_identity_rejects_colons() -> None:
    with pytest.raises(ValueError):
        AgentIdentity(
            tenant_id="tenant:bad",
            agent_id="agent",
            user_id="user",
            session_id="session",
        )
