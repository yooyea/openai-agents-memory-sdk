# Agent Studio Web

智能体创建、配置、调试、发布与生产会话站点。

## 本地启动

```bash
npm install
npm run dev:web
```

访问 `http://localhost:3000`。

当前为可交互的前端产品原型，使用本地 Mock 数据。后续接入：

- `control-api`：智能体草稿、版本、发布和部署
- `runtime-api`：会话、流式消息、Tool Call、Memory 与 Run
- `packages/agent-memory-sdk`：长期记忆提取、召回与上下文注入
