# Personal COO first loop

## Intent

Make the current local-first agent useful beyond chat for both work/projects and life affairs. It should identify which user goals need attention, create a concrete editable work product from the user's context, and carry an explicit next step back into the existing approval/check-in loop. This is the first browser-session execution loop, not a claim of autonomous background work or connected external apps.

## User flow

1. The overview shows a bounded, deterministic agenda derived from active goals, due review dates, unfinished linked tasks, and check-ins. Work and life goals share one agenda. Cards explain why a goal is surfaced, using recorded facts rather than inferred personal traits.
2. A user chooses a goal and asks the agent to prepare a deliverable. The starter asks for a specific useful artifact and next action based on that goal's domain and history. It uses the existing model configuration, bounded context, and Rust gateway.
3. The model returns ordinary advice, uncommitted task proposals, and at most one structured deliverable. The UI previews the deliverable and saves it to local browser storage only after the user confirms. The user may edit the content before saving. No external action is claimed or performed.
4. Saved deliverables link to their source goal and remain exportable/importable. From a deliverable, the user can revisit the goal for the next check-in. Existing task proposal approval remains separate.

## Contracts and limits

- Extend the model JSON envelope with optional `deliverable: {title, body}`. Reject malformed, empty, or oversized deliverables at the gateway; no HTML rendering. Keep old `text`/`proposals` responses valid.
- Schema v3 adds `deliverables` with id, goalId, title, body, createdAt, updatedAt. Migrate v1 and v2 data losslessly; validate ID uniqueness, goal references, size, dates, and import bounds. Maximum 100 deliverables, title 160 chars, body 12000 chars.
- Agenda is pure and deterministic, with a fixed card count. No invented urgency or cross-domain inference. A due review outranks an open task; paused/done goals are excluded.
- API keys and endpoint settings remain page-memory only. No server-side data persistence, background scheduler, email/calendar/project integration, or browser automation in this release. UI copy must describe these limits accurately.

## Acceptance

- Both work and life goals can produce previewable, editable, saved deliverables, and later check-ins remain linked to the same goals.
- Refresh and export/import preserve artifacts. Version-2 imports migrate; invalid artifacts reject the entire import. Rejecting a preview makes no local mutation.
- Model errors or storage failures preserve the user's draft and do not create deliverables/tasks. Existing chat approval behavior remains.
- Local and production browser suites, Rust tests, smoke checks, and unchanged `www` hash verify the release. Real provider generation remains untested without a user key.
