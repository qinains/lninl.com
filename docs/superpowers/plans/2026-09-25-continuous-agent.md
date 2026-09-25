# Continuous Personal Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a bilingual, local-first goal/action/check-in loop without losing version-1 user data.

**Architecture:** Extend the single validated IndexedDB record to schema v2. Keep domain logic in TypeScript, render the loop in Svelte, pass bounded check-in context through the existing Axum chat API, and accurately update Astro public pages.

**Tech Stack:** Astro 7, Svelte 5, TypeScript, IndexedDB, Vitest, Playwright, Rust/Axum, Caddy.

**Spec:** `docs/superpowers/specs/2026-09-25-continuous-agent-design.md`

## Global Constraints

- Preserve `https://www.lninl.com` unchanged and keep English/Chinese pages directly indexable.
- Keep user data only in browser IndexedDB and the API key only in page memory.
- Never auto-apply model suggestions; all changes require user action.
- Import old data losslessly; invalid input must not overwrite current data.

## Review Focus

- Version-1 goals and tasks survive migration without changed text or state: storage unit test.
- A malformed or oversized version-2 import cannot replace valid data: storage unit/browser test.
- A check-in linked to a missing goal is rejected before persistence: domain unit test.
- Storage failure during check-in leaves the typed input available: browser test.
- New context never exceeds gateway limits or smuggles instructions: chat unit/Rust tests.

---

### Task 1: Versioned personal timeline data

**Files:** Modify `web/src/lib/domain.ts`, `web/src/lib/storage.ts`, `web/src/lib/proposals.ts`, `web/src/components/ProfileEditor.svelte`, `web/src/components/TaskList.svelte`, `web/src/components/MemoryList.svelte`; create `web/src/lib/continuity.ts`; test `web/tests/storage.test.ts`, `web/tests/continuity.test.ts`.

**Interfaces:** `Goal`, `CheckIn`, `AgentData` v2; `migrateAgentData(value: unknown): AgentData`; `checkIn(data, input, now): AgentData`; `nextDueGoal(data, now): Goal | null`. Keep `validateAgentData` strict for version 2 and `parseImport` accepting v1/v2.

- [ ] Write tests with a literal v1 fixture covering profile goals, memories, tasks and conversation, and v2 roundtrip; expect `migrateAgentData` to preserve values and assign IDs.
- [ ] Run `pnpm test --run` in `web` and observe the new tests fail.
- [ ] Add v2 types and migration at storage boundary. Add strict shape/reference/date validation and update all v1 constructors/callers. Keep legacy tasks unlinked (`goalId: null`).
- [ ] Add pure check-in creation and due-goal selection. Test nonexistent goal, empty outcome, overlong input, and past/future due dates.
- [ ] Run `pnpm test --run && pnpm check`, fix errors, commit `feat: model durable goals and check-ins`.

### Task 2: Bilingual continuous-service workspace

**Files:** Create `web/src/components/GoalList.svelte`, `web/src/components/CheckInForm.svelte`; modify `web/src/components/Workspace.svelte`, `web/src/components/TaskList.svelte`, `web/src/components/MemoryList.svelte`, `web/src/components/workspace.css`; test `web/tests/workspace.spec.ts`.

**Interfaces:** Components consume `AgentData`, `locale`, `onSave` and emit no writes except via validated `onSave`. `GoalList` owns editing and status transitions; `CheckInForm` saves the guided review.

- [ ] Add Playwright coverage for create goal -> create linked task -> check in -> reload -> progress dashboard in both locales; add failed-save retention test.
- [ ] Run `pnpm exec playwright test` to see missing UI fail.
- [ ] Replace static goals panel with progress/next-review cards. Add goal form, per-goal history, review form and optional next task. Expose domain labels and clear local-only copy.
- [ ] Run browser tests, `pnpm check`, and keyboard/mobile inspection; commit `feat: add personal progress and check-in workflow`.

### Task 3: Bounded goal-aware conversation

**Files:** Modify `web/src/lib/chat.ts`, `web/src/components/Conversation.svelte`, `api/src/upstream.rs`, `api/src/validation.rs` only if size/schema requires it; test `web/tests/chat.test.ts`, `web/tests/conversation.spec.ts`, `api/tests/validation.rs` if changed.

**Interfaces:** `createChatRequest(data, message, goalId?)` selects the active goal, bounded related check-ins, and bounded cross-domain context. A review starter preselects a goal but does not mutate user state.

- [ ] Test that relevant check-ins reach the request, unrelated data is bounded, and text is treated as context rather than an instruction. Test the review starter under Playwright.
- [ ] Run target tests to observe failure.
- [ ] Implement selection and a goal-specific review control. Update upstream prompt to describe past outcomes and avoid claiming actions happened.
- [ ] Run web/Rust tests and commit `feat: ground conversations in goal history`.

### Task 4: Honest public positioning and deployment

**Files:** Modify `web/src/content/en.ts`, `web/src/content/zh.ts`, `web/src/components/Landing.astro`, `web/src/components/Guide.astro`, `README.md`, `web/tests/seo.test.ts`, `web/tests/workspace.spec.ts` as needed; append deployment record in `deploy/README.md`.

**Interfaces:** Existing route URLs and SEO metadata stay stable; copy states actual capabilities and deferrals.

- [ ] Add SEO tests for bilingual continuous-service text in generated HTML and ensure no promise of sync or autonomous integrations.
- [ ] Run SEO test to fail, then update copy and tests. Run `pnpm check && pnpm build && pnpm test --run && pnpm exec playwright test`; run `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.
- [ ] Self-review diff, validate v1 migration in a fresh browser profile, build a release, back up Caddy/service state, deploy to new `/srv/personal-agent/releases/<sha>` and atomically switch `current` after health checks. Preserve prior release for rollback.
- [ ] Run `deploy/smoke.sh`, check live browser workflow and www content integrity, commit deployment notes, fast-forward/push `main`, and verify CI.
