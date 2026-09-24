# Personal AI Agent: first-release design

## Purpose and success criteria

Build a public, bilingual Personal AI Agent product at `https://lninl.com` while preserving the existing `https://www.lninl.com` site. A visitor can create a useful agent around their own profile, converse with it, and approve proposed task changes. Public pages should explain the product accurately and be indexable for the English term "Personal AI Agent" and corresponding Chinese queries. The public GitHub repository should make the product and its scope understandable.

The first release succeeds when a new visitor can complete the entire flow without an account: set up a profile, enter their own OpenAI API key, receive a model response using their context, approve a proposed task change, reload and recover their local data, and export/import that data. English and Chinese public pages must be directly readable in the returned HTML. The existing `www` site must remain operational.

## Scope

### Public site

- `/` is the English landing page; `/zh/` is its Chinese counterpart. Both provide the product definition, honest feature description, concrete use cases, privacy and permission explanation, FAQ, and an application entry point.
- An English guide at `/guide/personal-ai-agent/` and a Chinese counterpart at `/zh/guide/personal-ai-agent/` explain what a personal AI agent is, how this product differs from a generic chatbot, and what its first release can and cannot do.
- Each language version has its own title, description, canonical URL, `hreflang` links, and real internal navigation. Generate `sitemap.xml` and `robots.txt`. Do not index the personal workspace.
- The GitHub README describes the product in English and Chinese, with setup instructions and an explicit first-release feature list.

### Personal workspace

- `/app/` is the English workspace; `/zh/app/` is the Chinese workspace. The UI includes onboarding, conversation, profile/preferences/goals, explicit memories, tasks, settings, and data export/import/delete.
- Profile, goals, memories, tasks, and conversation history are stored only in browser IndexedDB. Use a versioned data format and validate imports before replacing current data. Export is a local JSON download; importing requires confirmation and never silently merges conflicting data.
- The user supplies an OpenAI API key. Keep it only in the running browser session's memory; do not put it in IndexedDB, local storage, URLs, analytics, or server-side persistence. Refreshing the page requires entering it again.
- The agent can propose creating, editing, completing, or deleting a task. Show the exact change and require explicit user approval before applying it. Reject proposals that refer to nonexistent tasks or fail schema validation. The model cannot directly mutate browser state.
- Users can inspect, edit, and delete individual memories. The first release does not silently extract or save new memories from chat; the user explicitly adds or approves them.

## Technical design

- Astro generates the public pages as static HTML. Svelte and TypeScript implement the interactive workspace. Static build output is served by Caddy.
- A separate Rust/Axum process serves `/api/*` behind Caddy. The first release has one model endpoint, `POST /api/chat`, plus a health endpoint. Axum validates input size and shape, forwards the request to OpenAI, and returns assistant text plus typed, uncommitted action proposals. No user database or authentication service is introduced.
- The browser selects the relevant profile, goals, memories, tasks, and recent conversation turns for each request. Put finite limits on each input and on total context size. Axum validates again; browser-provided context is never treated as privileged server instructions.
- The API key is sent over HTTPS to the Axum endpoint for each model call, then forwarded to OpenAI. The application does not persist or log the key or model request body. Do not include it in error responses. Limit request size, concurrency, and requests per source IP to protect the server. Configure allowed model identifiers and upstream URL on the server rather than accepting an arbitrary user-supplied upstream URL.
- Failures such as missing/invalid key, upstream timeout, rate limit, offline state, and malformed model output produce explicit, localized, retryable UI errors. A failed request cannot mutate local profile, memories, or tasks.
- No user content is sent to analytics. Public-page analytics, if added later, require a separate decision.

## Deployment and operations

- Keep the apex domain and `www` as separate Caddy site blocks. Serve Astro output on `lninl.com` and reverse-proxy only `/api/*` to the Rust service. Do not change the existing `www.lninl.com` routing.
- Before deployment, inspect the live Caddy configuration, running processes, OS, and deployment paths. Back up the active configuration, validate the proposed Caddy change, and use a reversible service deployment. Keep keys and operational credentials out of Git.
- Verify apex HTTPS, bilingual routes, API health, and a full workspace flow after deploy. Recheck `www.lninl.com` before and after. Document the rollback procedure in the deployment notes.

## Verification

- Unit tests cover local data validation/migrations, import/export, context selection, and task proposal validation/application.
- Rust tests cover request validation, key non-persistence, upstream error mapping, timeouts, and malformed model responses using a mock upstream.
- Browser tests cover onboarding, language navigation, memory editing, task approval/rejection, persistence after reload, export/import, and missing/invalid API key errors.
- Build-time checks inspect the generated HTML for language-specific content, titles, canonical and `hreflang` links, sitemap entries, and `noindex` on workspace routes.
- Production smoke tests cover both apex and `www` URLs, TLS, and the health endpoint. A live model call requires a user-supplied key and is not part of unattended deployment checks.

## Explicit non-goals for the first release

No accounts, cross-device sync, server-side user data storage, email/calendar integrations, autonomous external actions, arbitrary shell/browser execution, paid plans, or broad provider support. These require later designs for authorization, privacy, and operational controls.
