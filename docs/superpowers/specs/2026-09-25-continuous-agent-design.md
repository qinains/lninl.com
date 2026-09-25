# Continuous Personal Agent: second-release design

## Intent

Turn the existing personal-context chatbot into a local-first service loop: a person sets a goal, takes an action, reports an outcome, and uses that outcome to choose the next action. The article at https://mp.weixin.qq.com/s/f9kagGj4NVDLtSI9jR9JWQ motivates long-lived, cross-domain personal context and continuous service rather than one-off answers. This release makes that distinction real without pretending to offer accounts, autonomous execution, or external integrations.

## Experience

- A bilingual progress dashboard shows active goals, their domain and current stage, an upcoming review date, and the next linked task. It gives a clear entry point to check in on each goal. A missed review is a prompt, never an automated action.
- Goals are durable records, not only strings in a profile. Each has a title, domain (`work`, `learning`, `life`, `other`), stage, status, creation/update times, and optional next review date. A user can create, edit, pause, resume, and finish a goal.
- A check-in records what happened, what changed, and the next step. It optionally creates a task linked to the goal and schedules the next review. The user confirms all fields before save. Saved check-ins are readable later and appear in model context so a subsequent conversation can build on them.
- Explicit memories gain a domain label. Cross-domain context remains available, but the UI explains exactly what is sent when chatting. Neither chat output nor a check-in silently edits profile or memories. The existing task approval flow remains.
- Chat provides a goal-specific review starter that includes the selected goal and recent check-ins in the request. The assistant may suggest next task actions using the existing approval mechanism; it cannot claim to have done work.
- Public English and Chinese pages describe a continuous goal/action/review loop accurately and differentiate it from a generic chatbot. Keep first-release URLs, canonical/hreflang, and workspace noindex intact.

## Data and boundaries

- Preserve browser-only IndexedDB and BYOK API-key-in-memory architecture. No server user storage, account, background scheduler, notifications, or tool integrations in this release.
- Introduce schema version 2. Migrate valid version-1 data on read/import: turn each profile goal string into a goal record; preserve profile, memories, tasks, and conversation. Missing new fields receive explicit defaults. Save the migrated result only after full validation. Export version 2; accept both version 1 and 2 imports. A failed migration leaves the stored value untouched and reports an error.
- Bound goals and check-ins, validate IDs, dates and references, and reject malformed imports. Linked tasks may have a null goal ID so old tasks remain valid. Deleting a goal leaves its check-ins as history and unlinks its tasks, or use archiving rather than deletion; this release uses status changes, not hard deletion.
- Select bounded recent check-ins and relevant goals for a model request. Treat all browser-supplied context as data, not instructions. The server maintains its existing request-size and rate limits; increase only if tests show the new bounded shape requires it.
- Persist check-ins and task changes atomically within the single validated AgentData record. On storage failure, retain editable form input and show a localized error.

## Verification and release

- Unit tests prove v1 migration/import, invalid references, check-in creation and due dates, bounded model context, and export roundtrip.
- Browser tests cover bilingual goal creation, check-in, reload, chat review starter and approval, plus existing import and error flows.
- Update public copy, README, and SEO assertions. Run the full web/Rust suites and production smoke. Deploy with a new release directory and reversible symlink, preserving `www.lninl.com`; verify live data migration using a test browser profile, not a real user's stored data.

## Deferred

Accounts/sync, automatic activity ingestion, reminders, specialized health/finance agents, and external actions need their own privacy and authorization design. Do not imply these exist in marketing copy.
