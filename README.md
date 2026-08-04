# OpenAI Agents Memory SDK

基于 **OpenAI Agents SDK** 的轻量长期记忆扩展。

项目不 Fork OpenAI Agents SDK，也不引入完整 Agent 平台。OpenAI Agents SDK 继续负责 Agent Loop、Tool、Handoff、Streaming、Session 与 Compaction；本项目只补齐：

- `tenant_id / agent_id / user_id / session_id` 身份与隔离模型
- 跨 Session 的长期用户记忆
- 记忆提取、更新、删除与召回
- PostgreSQL + pgvector 存储
- 记忆上下文注入
- 同步与后台提取策略
- 面向业务的一体化 `MemoryRunner`

> 当前状态：MVP 骨架。接口和数据模型已就位，适合继续补集成测试、Redis Streams Publisher 和生产治理。

## 设计原则

1. **不 Fork**：只使用 OpenAI Agents SDK 公开扩展点。
2. **Session 与 Memory 分离**：Session 保存当前对话历史，Memory 保存跨会话稳定事实。
3. **存储可替换**：核心依赖 `MemoryStore` 协议，PostgreSQL 只是默认实现。
4. **记忆是非可信上下文**：注入模型时明确声明其不是指令。
5. **默认少记**：不保存密码、令牌、身份证件、财务账户等敏感信息。
6. **可删除、可过期、可追溯**：记忆带来源、置信度和过期时间。

## 架构

```text
Business Application
        |
        v
MemoryRunner
  |-- SessionFactory ------> OpenAI Agents SDK SQLAlchemySession
  |-- MemoryStore ---------> PostgreSQL + pgvector
  |-- MemoryExtractor -----> OpenAI Agents SDK structured-output Agent
  |-- ContextInjector -----> RunConfig.call_model_input_filter
  `-- JobPublisher --------> Redis Streams / Queue（可选）
        |
        v
OpenAI Agents SDK Runner
```

## 快速开始

### 1. 启动 PostgreSQL

```bash
docker compose up -d
```

### 2. 安装

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 3. 初始化记忆表

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

OpenAI Agents SDK 的 Session 表可以由 `SQLAlchemySession(create_tables=True)` 首次自动创建。

### 4. 配置环境变量

```bash
cp .env.example .env
export OPENAI_API_KEY="..."
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/agent_memory"
```

### 5. 运行示例

```bash
python examples/basic.py
```

## 最小使用方式

```python
from agents import Agent

from openai_agents_memory import (
    AgentIdentity,
    ContextPolicy,
    ExtractionMode,
    MemoryPolicy,
    MemoryRunner,
    OpenAIAgentMemoryExtractor,
    OpenAIEmbeddingProvider,
    PostgresMemoryStore,
    SQLAlchemySessionFactory,
)

identity = AgentIdentity(
    tenant_id="tenant-001",
    agent_id="assistant",
    user_id="user-001",
    session_id="session-001",
)

store = PostgresMemoryStore(
    database_url="postgresql+asyncpg://postgres:postgres@localhost:5432/agent_memory",
    embedding_provider=OpenAIEmbeddingProvider(),
)

runner = MemoryRunner(
    store=store,
    extractor=OpenAIAgentMemoryExtractor(model="gpt-5-mini"),
    session_factory=SQLAlchemySessionFactory(
        database_url="postgresql+asyncpg://postgres:postgres@localhost:5432/agent_memory",
        create_tables=True,
        enable_compaction=True,
    ),
    memory_policy=MemoryPolicy(extraction_mode=ExtractionMode.INLINE),
    context_policy=ContextPolicy(max_memory_items=8),
)

agent = Agent(
    name="assistant",
    model="gpt-5-mini",
    instructions="你是一个简洁、可靠的技术助手。",
)

result = await runner.run(
    agent=agent,
    input="记住，我更倾向使用 Go，尽量避免 Node.js。",
    identity=identity,
)
print(result.final_output)
```

在另一个 `session_id` 中继续使用同一 `user_id`，相关长期记忆会被检索并注入。

## Session 与 Memory 的边界

```text
tenant_id
└── user_id
    ├── Long-term Memory
    ├── session_id A
    │   └── OpenAI Agents SDK Session History
    └── session_id B
        └── OpenAI Agents SDK Session History
```

Session Key：

```text
{tenant_id}:{agent_id}:{user_id}:{session_id}
```

Memory Scope：

```text
{tenant_id}:{agent_id}:{user_id}
```

如需多个 Agent 共享用户记忆，可以在构造 `MemoryScope` 时忽略 `agent_id`。

## 后台记忆提取

生产环境建议默认使用 `ExtractionMode.BACKGROUND`，由 `MemoryJobPublisher` 发布到 Redis Streams、Kafka 或任务队列。

用户明确表达“记住”“以后都”“固定偏好”时，`MemoryRunner` 会自动改为同步提取，保证下一轮立即可用。

## 当前边界

MVP 暂不包含：

- 管理控制台
- Agent 发布与版本管理
- Workflow/Team 编排
- RAG/Knowledge Base
- Redis Streams 的具体实现
- PII 分类器和人工审核控制台
- 数据库迁移框架

这些能力应留在业务平台或独立扩展包，不进入轻量核心。

## 官方基础能力

本项目基于 OpenAI Agents SDK 已提供的 Session、SQLAlchemy Session、Responses Compaction、运行 Context、动态 Instructions 和 `call_model_input_filter` 扩展点构建。

## License

MIT
