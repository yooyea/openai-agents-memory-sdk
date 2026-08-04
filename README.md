# Agent Studio Monorepo

一个轻量、可自托管的智能体创建与会话平台。

用户可以创建、编辑、调试和发布智能体，并通过内置会话页面在生产环境中持续、有记忆地使用已发布版本。

## 架构与延续上下文

后续开发开始前请先阅读：

- [Agent Studio Monorepo 架构说明](docs/architecture.md)

该文档记录了当前实现状态、目标架构、模块边界、领域模型、运行链路、关键架构决策和后续实施顺序。架构发生变化时应同步更新，避免后续开发脱离既定上下文。

当前仓库包含两个部分：

```text
openai-agents-memory-sdk/
├── apps/
│   └── studio-web/              # 智能体管理与生产会话站点
├── src/openai_agents_memory/    # OpenAI Agents SDK 长期记忆扩展
├── tests/                       # Memory SDK 单元测试
├── migrations/                  # PostgreSQL + pgvector 表结构
└── examples/                    # SDK 最小示例
```

## 产品闭环

```text
创建智能体
→ 编辑 Prompt / 模型 / Tool / Memory
→ 调试草稿
→ 发布不可变版本
→ 部署为生产版本
→ 用户进入会话页面
→ 创建或恢复 Session
→ 召回跨 Session 长期记忆
→ 持续聊天
```

## Studio Web

站点当前是一个可交互的前端产品原型，覆盖：

- 工作台与运行概览
- 智能体列表
- 智能体创建与编辑
- Prompt、模型、MCP、Memory 和版本配置
- 生产智能体选择页
- 历史会话与聊天页面
- Session 恢复和长期记忆反馈展示
- 响应式桌面与移动端布局

### 启动站点

```bash
npm install
npm run dev:web
```

访问 `http://localhost:3000`。

站点当前使用本地 Mock 数据。后续会分别接入：

- `control-api`：Agent 草稿、版本、发布与部署
- `runtime-api`：Session、流式消息、Tool Call、Memory 与 Run
- `agent-memory-sdk`：长期记忆提取、召回与上下文注入

## OpenAI Agents Memory SDK

基于 **OpenAI Agents SDK** 的轻量长期记忆扩展。

项目不 Fork OpenAI Agents SDK。OpenAI Agents SDK 继续负责 Agent Loop、Tool、Handoff、Streaming、Session 与 Compaction；本项目补齐：

- `tenant_id / agent_id / user_id / session_id` 身份与隔离模型
- 跨 Session 的长期用户记忆
- 记忆提取、更新、删除与召回
- PostgreSQL + pgvector 存储
- 记忆上下文注入
- 同步与后台提取策略
- 面向业务的一体化 `MemoryRunner`

### 设计原则

1. **不 Fork**：只使用 OpenAI Agents SDK 公开扩展点。
2. **Session 与 Memory 分离**：Session 保存当前对话历史，Memory 保存跨会话稳定事实。
3. **存储可替换**：核心依赖 `MemoryStore` 协议，PostgreSQL 只是默认实现。
4. **记忆是非可信上下文**：注入模型时明确声明其不是指令。
5. **默认少记**：不保存密码、令牌、身份证件、财务账户等敏感信息。
6. **可删除、可过期、可追溯**：记忆带来源、置信度和过期时间。

### SDK 架构

```text
Business Application
        |
        v
MemoryRunner
  |-- SessionFactory ------> OpenAI Agents SDK SQLAlchemySession
  |-- MemoryStore ---------> PostgreSQL + pgvector
  |-- MemoryExtractor -----> Structured-output Agent
  |-- ContextInjector -----> RunConfig.call_model_input_filter
  `-- JobPublisher --------> Redis Streams / Queue（可选）
        |
        v
OpenAI Agents SDK Runner
```

### SDK 快速开始

```bash
docker compose up -d
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
psql "$DATABASE_URL" -f migrations/001_init.sql
python examples/basic.py
```

### Session 与 Memory 的边界

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

## 当前阶段

已经完成：

- Memory SDK 核心接口和 PostgreSQL 实现
- Memory 提取、召回与 Context 注入骨架
- Agent Studio Web 可交互产品原型
- Python 与 Web CI 配置

下一阶段：

- 重构为标准 `packages/ + apps/` 目录
- 实现 Control API
- 实现 Runtime API 与 SSE
- 用真实 Session 和 Memory 数据替换 Mock
- 增加调试 Run Trace、Tool Call 与 Memory 审核

## License

MIT
