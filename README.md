# Personal AI Agent by lninl

An AI agent built around one person at a time. Set a goal, act, check in on the outcome, and use that history to choose a better next step. Approve any proposed task change before it happens.

**Live site:** [lninl.com](https://lninl.com/) · [中文](https://lninl.com/zh/) · [Guide](https://lninl.com/guide/personal-ai-agent/)

## First-release features

- Bilingual English/Chinese public site and workspace.
- Local-first profile, domain-labeled memories, durable goals, check-ins, tasks, and conversation history in browser IndexedDB. Existing version-1 data migrates on load and import.
- Bring your own API key and configure an OpenAI-compatible Responses or Chat Completions endpoint (including DeepSeek), or Anthropic Messages. The full API URL, model ID, and key stay in page memory and must be re-entered after a refresh.
- Rust/Axum model gateway with input limits, rate limits, and sanitized errors. The gateway does not persist user data or keys.
- A progress dashboard surfaces active and due-for-review goals when the workspace is open; goal-specific conversation uses bounded recent check-ins. Agent task proposals require explicit approval. You can export, import, and delete local data.
- A shared work/life agenda can start a goal-specific draft brief or plan. Model-generated deliverables are previewed and editable; only user-confirmed drafts are saved locally, linked to the goal, and available to later conversations.

There are **no accounts, background reminders, or cross-device sync**. The agent cannot access email/calendar, send messages, operate other accounts, or execute arbitrary commands. Selected context is sent to your chosen API endpoint when you chat; review that provider's data policy separately before using sensitive information.

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

这是一个围绕你而设计的 AI Agent：设定目标、采取行动、记录回顾，让下一步建议参考真实进展；任何待办变更都必须经你确认。

**网站：**[lninl.com/zh/](https://lninl.com/zh/) · [产品指南](https://lninl.com/zh/guide/personal-ai-agent/)

当前版本提供中英双语页面与工作台、保存在当前浏览器的个人档案/领域记忆/目标/回顾/待办/对话、同时覆盖工作与生活目标的推进议程、可审阅编辑的目标关联成果，以及可自填完整 API URL 和模型 ID 的 OpenAI 兼容 Responses、Chat Completions（含 DeepSeek）及 Anthropic Messages 接入。旧版数据会自动迁移。API 配置和 Key 只保留在当前页面内存中，刷新后需要重新输入；网关不持久化用户资料或 Key。

目前**没有账号、后台提醒或跨设备同步**。Agent 不能访问邮箱、日历或其他账号，也不能执行任意命令。对话时，选定的个人背景会发送给你选择的 API 地址；处理敏感信息前请另行了解该服务商的数据政策。

本地开发和测试命令见上方；部署及回滚步骤见 [`deploy/README.md`](deploy/README.md)。
