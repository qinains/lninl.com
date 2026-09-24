# Personal AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a bilingual, indexable Personal AI Agent site and a local-first workspace on `lninl.com` without changing the existing `www.lninl.com` site.

**Architecture:** Astro pre-renders public pages; Svelte/TypeScript runs the browser-only workspace and persists user data in IndexedDB. Rust/Axum validates and forwards chat requests to OpenAI, returning text and uncommitted task proposals. Caddy serves static files and proxies `/api/*` to the Rust process.

**Tech Stack:** Astro, Svelte, TypeScript, Vitest, Playwright, Rust/Axum, Tokio, Reqwest, Serde, Caddy.

**Spec:** `docs/superpowers/specs/2026-09-25-personal-ai-agent-design.md`

## Global Constraints

- Public English routes: `/` and `/guide/personal-ai-agent/`; public Chinese routes: `/zh/` and `/zh/guide/personal-ai-agent/`.
- Private workspace routes: `/app/` and `/zh/app/`; both must have `noindex`.
- User data resides only in browser IndexedDB; API keys reside only in current-page memory and never in storage, URLs, analytics, server logs, or error bodies.
- Task and memory mutations require an explicit user action. Model output is untrusted proposal data.
- Only the configured OpenAI upstream is allowed; never accept a caller-selected upstream URL.
- Preserve `www.lninl.com` and do not commit operational credentials.
- Make each task's test fail first, then pass, and commit the tested change.

## Review Focus

1. A malformed or future-version import must leave existing IndexedDB data unchanged (Task 2 test).
2. A model proposal naming a nonexistent task must be rejected without mutation (Task 3 test).
3. A missing or invalid API key must produce a useful error without exposing the key (Task 4 and Task 6 tests).
4. A model timeout or malformed response must leave the conversation and tasks usable (Task 4 and Task 6 tests).
5. A direct crawler request to each language URL must receive actual localized HTML and correct canonical/`hreflang` metadata (Task 1 test).

## File map and interfaces

- `web/astro.config.mjs`, `web/package.json`, `web/src/pages/**`, `web/src/styles/global.css`: static public and app-shell routes and shared responsive styling.
- `web/src/content/{en,zh}.ts`: localized public and workspace strings; `getCopy(locale: Locale): Copy`.
- `web/src/lib/domain.ts`: `Profile`, `Memory`, `Task`, `ConversationTurn`, `AgentData`, `TaskProposal`, and `SCHEMA_VERSION`.
- `web/src/lib/storage.ts`: `loadData(): Promise<AgentData>`, `saveData(data): Promise<void>`, `parseImport(text): AgentData`, `exportData(data): string`, `clearData(): Promise<void>`.
- `web/src/lib/proposals.ts`: `validateProposal(value, data): TaskProposal`, `applyProposal(data, proposal): AgentData`.
- `web/src/lib/chat.ts`: `sendChat(request, key, signal): Promise<ChatResult>`; no key persistence.
- `web/src/components/Workspace.svelte`: orchestrates onboarding, conversation, local data, and approvals; smaller components live beside it.
- `api/src/{main,models,validation,upstream}.rs`: Axum router, typed JSON, input limits, and OpenAI adapter.
- `deploy/`: deployment notes and service/Caddy snippets, not a replacement for unknown live config.

### Task 1: Bilingual, indexable static site

**Files:** Create `web/package.json`, `web/astro.config.mjs`, `web/tsconfig.json`, `web/src/content/en.ts`, `web/src/content/zh.ts`, `web/src/layouts/Site.astro`, `web/src/styles/global.css`, `web/src/pages/index.astro`, `web/src/pages/zh/index.astro`, `web/src/pages/guide/personal-ai-agent/index.astro`, `web/src/pages/zh/guide/personal-ai-agent/index.astro`, `web/src/pages/app/index.astro`, `web/src/pages/zh/app/index.astro`, `web/public/robots.txt`, `web/tests/seo.test.ts`.

**Interfaces:** Produces `getCopy(locale: 'en' | 'zh')` and pre-rendered app shells for Task 5. Page metadata uses explicit equivalent URLs, not automatic translation of slugs.

- [ ] **Step 1: Write the failing static-output test.** In `web/tests/seo.test.ts`, read `dist/index.html`, `dist/zh/index.html`, both guide pages, and both app shells; assert each public page contains localized `Personal AI Agent`/`个人 AI Agent` text, one canonical, both `hreflang` values, and a language switch. Assert app shells contain `noindex`; assert `dist/sitemap-index.xml` or `dist/sitemap.xml` lists all four public pages but not the app shells.

  ```ts
  const html = readFileSync('dist/zh/index.html', 'utf8');
  expect(html).toContain('个人 AI Agent');
  expect(html).toMatch(/rel="canonical" href="https:\/\/lninl\.com\/zh\/"/);
  expect(html).toContain('hreflang="en"');
  expect(html).toContain('hreflang="zh"');
  ```
- [ ] **Step 2: Verify red.** Run `cd web && pnpm test --run tests/seo.test.ts`; expected failure: missing package/build or output files.
- [ ] **Step 3: Add Astro and Svelte integration, typed localized copy, shared layout, four content pages, two app shells, sitemap integration, and robots file.** Public copy must describe only implemented first-release abilities. Build first, then have the test inspect `dist`. Use absolute `https://lninl.com` canonical and alternate URLs.

  ```ts
  // web/src/content/en.ts
  export const en = { locale: 'en', title: 'Personal AI Agent | lninl', hero: 'An AI agent built around you' } as const;
  // web/src/content/zh.ts exports the same keys with locale: 'zh'.
  ```
- [ ] **Step 4: Verify green.** Run `cd web && pnpm build && pnpm test --run tests/seo.test.ts`; inspect `dist/index.html` and `dist/zh/index.html` with `rg` to confirm text is in initial HTML, not only JS.
- [ ] **Step 5: Commit.** `git add web && git commit -m "feat: add bilingual static product site"`.

### Task 2: Versioned local data and safe import/export

**Files:** Create `web/src/lib/domain.ts`, `web/src/lib/storage.ts`, `web/tests/storage.test.ts`; modify `web/package.json` for Vitest and `fake-indexeddb`.

**Interfaces:** `AgentData` contains `schemaVersion`, `profile`, `memories`, `tasks`, and `conversation`; IDs are stable strings, timestamps ISO-8601. `loadData`, `saveData`, `clearData`, `parseImport`, and `exportData` have the signatures in the file map.

- [ ] **Step 1: Write failing tests.** Use `fake-indexeddb/auto`; assert `saveData`/`loadData` round-trip a filled `AgentData`, `exportData`/`parseImport` round-trip it, `parseImport('{')` throws, a future `schemaVersion` throws, and a failed import leaves previously stored data untouched because parsing precedes `saveData`.

  ```ts
  await saveData(fixture);
  expect(await loadData()).toEqual(fixture);
  expect(() => parseImport('{')).toThrow();
  expect(() => parseImport(JSON.stringify({ ...fixture, schemaVersion: 999 }))).toThrow();
  expect(await loadData()).toEqual(fixture);
  ```
- [ ] **Step 2: Verify red.** Run `cd web && pnpm test --run tests/storage.test.ts`; expected failure: exports absent.
- [ ] **Step 3: Implement a single IndexedDB record under database `personal-agent`, schema-validated JSON import, and deterministic JSON export.** Reject duplicate IDs, invalid timestamps, oversized imports, and unknown future schema versions. Do not put an API-key property in `AgentData`.

  ```ts
  export const SCHEMA_VERSION = 1;
  export function parseImport(text: string): AgentData {
    if (new TextEncoder().encode(text).length > 2_000_000) throw new Error('Import too large');
    return validateAgentData(JSON.parse(text));
  }
  ```
- [ ] **Step 4: Verify green.** Run `cd web && pnpm test --run tests/storage.test.ts`.
- [ ] **Step 5: Commit.** `git add web/src/lib web/tests/storage.test.ts web/package.json web/pnpm-lock.yaml && git commit -m "feat: persist and export local agent data"`.

### Task 3: Strict task proposals and explicit approval

**Files:** Create `web/src/lib/proposals.ts`, `web/tests/proposals.test.ts`; modify `web/src/lib/domain.ts`.

**Interfaces:** `TaskProposal` is a discriminated union of `create`, `update`, `complete`, and `delete`, with a stable proposal ID. `validateProposal(value: unknown, data: AgentData): TaskProposal` throws on unknown fields, invalid IDs, or invalid state. `applyProposal(data: AgentData, proposal: TaskProposal): AgentData` returns new data without mutating input.

- [ ] **Step 1: Write failing tests.** Assert each action's exact resulting task list, no mutation of the input object, rejection of a nonexistent task, duplicate task ID, empty title, and unsupported action. Explicitly assert validation alone leaves data unchanged.

  ```ts
  expect(() => validateProposal({ kind: 'delete', taskId: 'missing', id: 'p1' }, fixture)).toThrow();
  const proposal = validateProposal({ kind: 'complete', taskId: 't1', id: 'p2' }, fixture);
  expect(applyProposal(fixture, proposal).tasks.find(t => t.id === 't1')?.completed).toBe(true);
  expect(fixture.tasks.find(t => t.id === 't1')?.completed).toBe(false);
  ```
- [ ] **Step 2: Verify red.** Run `cd web && pnpm test --run tests/proposals.test.ts`; expected failure: missing functions.
- [ ] **Step 3: Implement the typed validator and pure action application.** Keep the approval decision outside this module; no model output may call `saveData` directly.

  ```ts
  // The complete branch inside applyProposal's exhaustive switch:
  return { ...data, tasks: data.tasks.map(task =>
    task.id === proposal.taskId ? { ...task, completed: true } : task) };
  ```
- [ ] **Step 4: Verify green.** Run `cd web && pnpm test --run tests/proposals.test.ts`.
- [ ] **Step 5: Commit.** `git add web/src/lib/domain.ts web/src/lib/proposals.ts web/tests/proposals.test.ts && git commit -m "feat: validate agent task proposals"`.

### Task 4: Rust chat boundary and upstream adapter

**Files:** Create `api/Cargo.toml`, `api/src/main.rs`, `api/src/models.rs`, `api/src/validation.rs`, `api/src/upstream.rs`, `api/tests/chat.rs`, `api/tests/validation.rs`.

**Interfaces:** `POST /api/chat` accepts `{message, context, conversation}` and an API key in `Authorization: Bearer ...`; returns `{text, proposals}`. `GET /api/health` returns `{status:"ok"}`. The adapter is injected through an `Upstream` trait so tests can simulate success, invalid key, timeout, and malformed replies without network access.

- [ ] **Step 1: Write failing router tests.** Test health `200`; chat missing key `401`; oversized body `413`; valid mock upstream `200` with text and proposal; upstream invalid key `401`; timeout `504`; malformed reply `502`. Assert response bodies never contain a submitted sentinel key.

  ```rust
  let response = router(mock_upstream()).oneshot(
      Request::builder().method("POST").uri("/api/chat")
          .header("content-type", "application/json")
          .body(Body::from(r#"{"message":"hi","context":{},"conversation":[]}"#)).unwrap()
  ).await.unwrap();
  assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
  ```
- [ ] **Step 2: Verify red.** Run `cd api && cargo test`; expected failure: package or router missing.
- [ ] **Step 3: Implement Axum routes, Serde request/response types, bounded body and context validation, a per-IP request/concurrency limit, fixed configured OpenAI URL/model, Reqwest timeout, and sanitized error mapping.** Never log authorization headers or request bodies. Return proposals as data; the server never applies them.

  ```rust
  #[derive(serde::Serialize)]
  struct ChatResponse { text: String, proposals: Vec<serde_json::Value> }
  const MAX_BODY_BYTES: usize = 64 * 1024;
  ```

  Accept `X-Forwarded-For` only when the TCP peer is the loopback Caddy proxy; otherwise use the peer IP for rate limiting.
- [ ] **Step 4: Verify green.** Run `cd api && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.
- [ ] **Step 5: Commit.** `git add api && git commit -m "feat: add bounded Rust model gateway"`.

### Task 5: Local-first workspace

**Files:** Create `web/src/components/{Workspace,Onboarding,ProfileEditor,MemoryList,TaskList,DataSettings}.svelte`, `web/tests/workspace.spec.ts`; modify both app-shell pages and localized copy modules.

**Interfaces:** `Workspace` receives `locale: Locale`; it loads `AgentData` through Task 2 functions. Task edits by humans save immediately; AI task proposals are rendered but saved only through Task 3 after confirmation.

- [ ] **Step 1: Write failing Playwright flows.** A new visitor sees onboarding; after entering profile/goals, reload retains them; a memory can be added/edited/deleted; a task can be added/completed; export creates versioned JSON; invalid import shows an error and preserves current data; clear requires confirmation. Run each flow in English and Chinese.

  ```ts
  await page.goto('/zh/app/');
  await expect(page.getByRole('heading', { name: /创建.*Agent/ })).toBeVisible();
  await page.getByLabel('我的目标').fill('每周写一篇文章');
  await page.getByRole('button', { name: '保存' }).click();
  await page.reload();
  await expect(page.getByText('每周写一篇文章')).toBeVisible();
  ```
- [ ] **Step 2: Verify red.** Run `cd web && pnpm exec playwright test tests/workspace.spec.ts`; expected failure: workspace controls absent.
- [ ] **Step 3: Implement responsive, keyboard-accessible Svelte components, localized error/empty states, and IndexedDB persistence.** Put app-shell `noindex` in initial HTML. Add an import preview and explicit replace confirmation.

  ```svelte
  <script lang="ts">
    import { onMount } from 'svelte';
    import { loadData } from '../lib/storage';
    import type { AgentData } from '../lib/domain';
    export let locale: 'en' | 'zh';
    let data: AgentData | null = null;
    onMount(async () => { data = await loadData(); });
  </script>
  <main aria-label={locale === 'zh' ? '个人工作台' : 'Personal workspace'}></main>
  ```
- [ ] **Step 4: Verify green.** Run `cd web && pnpm exec playwright test tests/workspace.spec.ts` and `pnpm check`.
- [ ] **Step 5: Commit.** `git add web && git commit -m "feat: add local personal agent workspace"`.

### Task 6: Conversation, model failures, and approval UI

**Files:** Create `web/src/lib/chat.ts`, `web/src/components/{Conversation,ProposalCard,ApiKeySettings}.svelte`, `web/tests/chat.test.ts`, `web/tests/conversation.spec.ts`; modify `Workspace.svelte` and localized copy.

**Interfaces:** `sendChat(request: ChatRequest, key: string, signal?: AbortSignal): Promise<ChatResult>` calls `/api/chat`. API key is a Svelte in-memory variable, never passed to `saveData`. `ProposalCard` emits approve/reject; only approve invokes `applyProposal` then `saveData`.

- [ ] **Step 1: Write failing unit and browser tests.** Assert request headers contain the key but serialized `AgentData` does not; missing key blocks send; invalid key shows localized guidance without echoing it; timeout supports retry; malformed proposal is ignored with an error; rejecting a valid proposal makes no task change; approving applies exactly one change. Reload must retain conversation but require the key again.

  ```ts
  expect(JSON.stringify(fixture)).not.toContain('sk-test-secret');
  await page.route('**/api/chat', route => route.fulfill({ status: 401, body: '{"error":"invalid_key"}' }));
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/invalid API key/i)).toBeVisible();
  await expect(page.getByText('sk-test-secret')).toHaveCount(0);
  ```
- [ ] **Step 2: Verify red.** Run `cd web && pnpm test --run tests/chat.test.ts && pnpm exec playwright test tests/conversation.spec.ts`; expected failure: chat controls and API client absent.
- [ ] **Step 3: Implement bounded context selection, conversation UI, abort/retry, explicit approval cards, and accessible pending/error states.** Mock `/api/chat` in Playwright; keep secret text out of logs and rendered errors.

  ```ts
  export async function sendChat(request: ChatRequest, key: string, signal?: AbortSignal): Promise<ChatResult> {
    const response = await fetch('/api/chat', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new ChatError(response.status);
    return validateChatResult(await response.json());
  }
  ```
- [ ] **Step 4: Verify green.** Run `cd web && pnpm test --run && pnpm exec playwright test && pnpm check && pnpm build`; run `cd api && cargo test`.
- [ ] **Step 5: Commit.** `git add web && git commit -m "feat: connect agent conversation and approvals"`.

### Task 7: Repository docs, deployment, and production verification

**Files:** Create `README.md`, `deploy/README.md`, `deploy/personal-agent.service`, `deploy/Caddyfile.snippet`, `.gitignore`, `.github/workflows/ci.yml`; modify `web/public/robots.txt` only if actual route output requires it.

**Interfaces:** Static output is `web/dist`; Rust binary is `api/target/release/personal-agent-api`; Axum listens on loopback for Caddy. CI runs the same local checks as Tasks 1-6.

- [ ] **Step 1: Write deployment smoke script and CI checks.** Script must verify `https://lninl.com/`, `/zh/`, both guides, `/api/health`, and `https://www.lninl.com/`, and report status/expected page marker. CI runs `pnpm check`, `pnpm test --run`, `pnpm build`, Playwright, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test`.

  ```sh
  curl -fsS https://lninl.com/ | rg 'Personal AI Agent'
  curl -fsS https://lninl.com/zh/ | rg '个人 AI Agent'
  curl -fsS https://lninl.com/api/health | rg '"status":"ok"'
  curl -fsSI https://www.lninl.com/ | rg '^HTTP/'
  ```
- [ ] **Step 2: Verify local red/green.** Run the CI-equivalent commands, correcting only failures in the corresponding task's code, then rerun all. The production smoke script is not expected to pass until deployment.
- [ ] **Step 3: Document local setup and privacy model in English and Chinese.** Add a Caddy snippet with apex-only site block and `/api/*` proxy, and a systemd unit bound to loopback. Do not assume the snippet can replace the live Caddyfile.

  ```caddyfile
  lninl.com {
      handle /api/* { reverse_proxy 127.0.0.1:8787 }
      handle { root * /srv/personal-agent/current/web; file_server }
  }
  ```
- [ ] **Step 4: Establish server access and deploy reversibly.** Current `ssh lninl.com` fails with public-key authentication; obtain the correct account/key location from the user rather than guessing or scanning unrelated credentials. On access, inspect active Caddyfile and services, back up config, upload static output and Rust binary to versioned release paths, validate Caddy, reload services, and keep the prior release for rollback.
- [ ] **Step 5: Run production smoke and user-flow checks.** Verify apex TLS, English/Chinese initial HTML and metadata, `/api/health`, key entry and chat with a user-supplied key, task approval, and unchanged `www` behavior. If any fails, restore the previous Caddy config/release and document the failure.
- [ ] **Step 6: Commit and push.** `git add README.md deploy .gitignore .github web api && git commit -m "docs: document and verify deployment" && git push origin main`.

## Final verification

- [ ] Run `git diff --check` and the full web/API test suites from a clean checkout.
- [ ] Confirm the deployed version matches the pushed commit and contains no API key or operational secret.
- [ ] Record the exact release paths, Caddy config backup, smoke result, and rollback command in `deploy/README.md` without recording credentials.
