# Personal COO First Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a work/life agenda and user-approved, goal-linked work products through the existing BYOK model gateway.

**Architecture:** Pure browser agenda selection and schema-v3 deliverable storage; optional structured deliverable in all three gateway protocols; a Svelte action surface reuses provider settings and approval semantics.

**Tech Stack:** Astro, Svelte 5, TypeScript, Vitest, Playwright, Rust/Axum.

**Spec:** `docs/superpowers/specs/2026-09-26-personal-coo-first-loop-design.md`

## Global Constraints

- No unattended/background execution, external account connector, or provider credential persistence in this milestone.
- No task or deliverable mutation before explicit user confirmation.
- Preserve version-1 and version-2 imports and the existing Caddy `www` site.

## Review Focus

- Version-2 browser data loads and migrates without losing goals, tasks, or check-ins.
- Unknown goal or oversized deliverable rejects import and model output.
- A rejected preview or failed save leaves local state unchanged and source text available.
- Work and life goals follow the same execution path; paused/done goals do not appear in the agenda.
- Old model responses lacking a deliverable continue to work.

---

### Task 1: Context agenda and schema

**Files:** `web/src/lib/domain.ts`, `web/src/lib/storage.ts`, `web/src/lib/continuity.ts`, `web/tests/storage.test.ts`, `web/tests/continuity.test.ts`.

**Interfaces:** `agenda(data,today)` returns up to four `{goal,reason}` cards; `Deliverable` becomes part of `AgentData` v3.

- [ ] Add failing tests for ranking work/life goals, excluding inactive goals, version-2 migration, artifact persistence, invalid artifact import.
- [ ] Run focused Vitest and verify failure.
- [ ] Implement v3 storage and pure agenda; retain v1 migration through v2.
- [ ] Run focused and full Vitest; commit schema/agenda.

### Task 2: Structured model output

**Files:** `api/src/models.rs`, `api/src/upstream.rs`, `api/tests/upstream.rs`, `web/src/lib/chat.ts`, `web/tests/chat.test.ts`.

**Interfaces:** Optional `deliverable:{title,body}` in `ChatResponse` and `ChatResult`.

- [ ] Add failing Rust and Vitest tests for valid/absent/malformed/oversized work products.
- [ ] Run tests to verify expected failures.
- [ ] Extend prompt, bounded parse, and browser result validation without changing provider protocols.
- [ ] Run Rust fmt/clippy/tests and web tests; commit contract.

### Task 3: Work/life execution surface

**Files:** `web/src/components/Workspace.svelte`, `web/src/components/Conversation.svelte`, new `web/src/components/Deliverables.svelte`, `web/tests/conversation.spec.ts`, `web/tests/workspace.spec.ts`, public copy.

**Interfaces:** Agenda starter selects a goal and a domain-specific deliverable prompt; preview/edit/save/reject stay browser-local; saved deliverables are listed and editable.

- [ ] Add failing Playwright tests for work and life generation, preview approval/rejection, refresh, and import/export.
- [ ] Run focused Playwright and verify failure.
- [ ] Implement the components and copy; no external-action claims.
- [ ] Run Astro check/build, Vitest, Playwright; commit UI.

### Task 4: Release

**Files:** `README.md`, `deploy/README.md`.

- [ ] Self-review and run complete local verification.
- [ ] Build and transfer a new reversible release, switch only apex, run smoke and production browser tests, confirm `www` hash.
- [ ] Record the release and real-key limitation; merge/push main; confirm CI.
