# Personal AI Agent by lninl

An AI agent built around one person at a time. Give it the goals, preferences, and explicit memories you choose; talk through your next step; approve any proposed task change before it happens.

**Live site:** [lninl.com](https://lninl.com/) · [中文](https://lninl.com/zh/) · [Guide](https://lninl.com/guide/personal-ai-agent/)

## First-release features

- Bilingual English/Chinese public site and workspace.
- Local-first profile, memories, tasks, and conversation history in browser IndexedDB.
- Bring your own OpenAI API key. It stays in page memory and must be re-entered after a refresh.
- Rust/Axum model gateway with input limits, rate limits, and sanitized errors. The gateway does not persist user data or keys.
- Agent task proposals require explicit approval. You can export, import, and delete local data.

There are **no accounts or cross-device sync**. The agent cannot access email/calendar, send messages, operate other accounts, or execute arbitrary commands. Selected context is sent to OpenAI when you chat; review [OpenAI's data policies](https://platform.openai.com/docs/guides/your-data) separately before using sensitive information.

## Run locally

Requires Node.js 24+, pnpm 10+, and a current Rust toolchain.

```sh
cd web
pnpm install
pnpm dev
```

In another terminal:

```sh
cd api
cargo run
```

The website runs at `http://localhost:4321`; the API listens on `127.0.0.1:8787`. For local chat, proxy `/api/*` to the Rust process or use the production Caddy configuration. Static pages and local workspace features work without the API.

## Verify

```sh
cd web
pnpm check && pnpm build && pnpm test --run && pnpm exec playwright test
cd ../api
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Deployment and rollback: [`deploy/README.md`](deploy/README.md).

---

# lninl 个人 AI Agent

这是一个围绕你而设计的 AI Agent。你主动提供目标、偏好和明确的记忆，与它讨论下一步；任何待办变更都必须经你确认。

**网站：**[lninl.com/zh/](https://lninl.com/zh/) · [产品指南](https://lninl.com/zh/guide/personal-ai-agent/)

首版提供中英双语页面与工作台、保存在当前浏览器的个人档案/记忆/待办/对话、自带 OpenAI API Key、Rust/Axum 模型网关、行动确认，以及数据导入/导出/清空。API Key 只保留在当前页面内存中，刷新后需要重新输入；网关不持久化用户资料或 Key。

首版**没有账号和跨设备同步**。Agent 不能访问邮箱、日历或其他账号，也不能执行任意命令。对话时，选定的个人背景会发送给 OpenAI；处理敏感信息前请另行了解其数据政策。

本地开发和测试命令见上方；部署及回滚步骤见 [`deploy/README.md`](deploy/README.md)。
