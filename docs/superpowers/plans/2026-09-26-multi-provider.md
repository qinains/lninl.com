# Multi-Provider Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship user-configurable OpenAI-compatible Responses and Chat Completions (including DeepSeek), and Anthropic Messages conversations without weakening the key or gateway boundary.

**Architecture:** Add provider configuration to the browser chat request, validate it in Axum, dispatch through provider-specific request/response adapters, and pin an approved HTTPS public endpoint per request. Preserve old request defaults for deployment transition.

**Tech Stack:** Astro, Svelte, TypeScript, Rust/Axum, reqwest, Playwright, Vitest, Caddy.

**Spec:** `docs/superpowers/specs/2026-09-26-multi-provider-design.md`

## Global Constraints

- Never persist API key, endpoint URL, or model in browser/server state beyond the current page session.
- Preserve the task-approval and local-data flows.
- Custom endpoints must not become an SSRF primitive or receive a key after a silent URL change.
- Preserve `www.lninl.com` and keep a rollback release.

## Review Focus

- A changed URL with an old key must clear the key: browser test.
- Private, loopback, link-local, and redirect targets must not receive requests: Rust tests.
- Anthropic text blocks may contain malformed JSON: parser test returns sanitized error.
- Old three-field API requests still use prior OpenAI defaults: validation test.
- A provider-specific invalid key and timeout must remain localized and retryable: browser/Rust tests.

---

### Task 1: Gateway contract and endpoint policy

**Files:** Modify `api/src/models.rs`, `api/src/validation.rs`, `api/src/lib.rs`, `api/tests/validation.rs`; create `api/src/endpoint.rs`, `api/tests/endpoint.rs`.

**Interfaces:** `Provider` enum; `ValidatedChat { provider, api_url, model, ... }`; `validate_endpoint(provider, url) -> Result<Url,...>`; `resolve_endpoint(url) -> Vec<SocketAddr>` with all addresses public.

- [ ] Write Rust tests for old/new request shapes, rejected fields, non-HTTPS/IP/private endpoints, and valid public URL.
- [ ] Run `cargo test` and observe failures.
- [ ] Implement parsing and endpoint policy, DNS resolution plus reqwest address pinning support.
- [ ] Run `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`; commit `feat: validate configurable provider endpoints`.

### Task 2: Protocol adapters

**Files:** Modify `api/src/upstream.rs`, `api/src/main.rs`; create `api/tests/upstream.rs` or unit tests in `upstream.rs`.

**Interfaces:** `HttpUpstream` implements existing `Upstream`; pure `build_payload(chat)` and `parse_provider_response(provider, json)` cover all three modes.

- [ ] Write failing adapter tests for Responses, Chat Completions, and Anthropic request bodies, parsed task proposals, non-JSON/missing text, and error mapping.
- [ ] Implement three provider adapters with a shared bounded parser. Use validated DNS-pinned HTTPS client, no redirects/proxy, and no upstream body logging.
- [ ] Run the full Rust checks and tests; commit `feat: support Responses and Anthropic messages`.

### Task 3: Browser provider settings

**Files:** Modify `web/src/lib/chat.ts`, `web/src/components/Conversation.svelte`, `web/src/components/Workspace.svelte`, `web/src/components/ApiKeySettings.svelte`, `web/tests/chat.test.ts`, `web/tests/conversation.spec.ts`, `README.md`.

**Interfaces:** `ProviderSettings { provider, apiUrl, model }`; `sendChat(request, key)` includes settings; `Conversation` receives current settings and a change callback; key clears on URL/provider changes.

- [ ] Add failing Vitest/Playwright tests for payload, three modes, URL/model inputs, key clearing, and reload.
- [ ] Implement controlled bilingual settings and error handling. Keep fields in page memory, with full-endpoint examples.
- [ ] Run `pnpm check && pnpm build && pnpm test --run && pnpm exec playwright test`; commit `feat: configure model provider per session`.

### Task 4: Release

**Files:** Modify `deploy/README.md`; update public feature copy only if it currently claims OpenAI exclusivity.

**Interfaces:** Existing site routes and `/api/chat` remain stable.

- [ ] Self-review, run the full local suites and secret scan, then build and transfer a new release without touching the active release.
- [ ] Atomically switch the release, verify service health, six smoke checks, production browser tests, and unchanged `www` body hash. Keep rollback ready.
- [ ] Record the release and untested real-key limitation, fast-forward/push `main`, and check CI.
