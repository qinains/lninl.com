# User-configured model providers

## Intent

Let a user connect the existing Personal Agent conversation to an OpenAI-compatible Responses or Chat Completions endpoint, or an Anthropic Messages endpoint. The user supplies the full HTTPS API URL, model ID, and API key. Keep all three in page memory only. The first release's OpenAI URL and model remain defaults, and the surrounding personal-data and approval flows do not change.

## Protocols and interaction

- Provider selector has three modes: `OpenAI-compatible Responses`, `OpenAI-compatible Chat Completions`, and `Anthropic Messages`. Show an editable full endpoint URL (not just a base URL), model ID, and password-style API key. Switching provider restores its example endpoint/model (Anthropic requires an explicit model) and clears the key. Editing the URL also clears the key so it cannot silently be sent to a changed destination.
- For Responses, send `POST` with bearer authorization, `model`, `store:false`, conversation turns, personal context, system instructions, and JSON-object output format. Read text from `output[*].content[*].text`, accepting `output_text` only as a compatibility fallback.
- For Chat Completions, send `POST` with bearer authorization, system and conversation messages, model, and `response_format:{type:"json_object"}`. Read `choices[0].message.content`. DeepSeek is an example endpoint; users may replace the URL and model for other compatible services.
- For Anthropic, send `POST /v1/messages`-shape JSON with `x-api-key`, `anthropic-version: 2023-06-01`, `model`, `max_tokens`, `system`, and `messages`. Read text blocks from `content[*]`. Both adapters parse the existing `{text,proposals}` JSON envelope and return uncommitted task proposals. A non-JSON reply produces a localized retryable error, never an automatic task mutation.
- The UI states that the selected personal context and API key go to the chosen endpoint when a message is sent. It does not claim that lninl controls a third-party endpoint's retention. No key, URL, or model is persisted in IndexedDB, browser storage, URLs, analytics, or server logs. Conversation history remains in the browser.

## Gateway boundary

- Keep `POST /api/chat`, request-body limit, input bounds, rate limits, and sanitized errors. Extend the validated request with `provider`, `apiUrl`, and `model`; accept the old three-field shape with previous OpenAI defaults during deployment transition.
- A user URL is never fetched without validation: HTTPS only, port 443, DNS hostname (no IP literal or localhost-like name), no credentials, query, or fragment, provider-appropriate path suffix, and bounded length. Resolve the hostname per request, reject any non-public address, pin the validated addresses in the HTTP client, disable environment proxies and redirects. A DNS or TLS failure returns a sanitized gateway error.
- The server does not use a server-side provider key. It forwards the session key only to the validated endpoint and does not return upstream error bodies. It accepts no custom headers or arbitrary HTTP methods.

## Verification

- Rust tests cover exact request validation, endpoint allow/deny cases, public-IP classification, protocol-specific JSON/header preparation, response parsing, malformed outputs, and sanitized errors. Browser tests cover provider switching, URL/model edits, key clearing, request payloads, approval, and reload behavior.
- Run the full web/Rust suites, deploy a new reversible release without changing `www`, smoke-test live routes and both configurations with mocked upstream/browser traffic. Real provider calls remain unverified without user-provided keys.

Official protocol references: https://developers.openai.com/api/docs/guides/text , https://developers.openai.com/api/docs/guides/structured-outputs , https://api-docs.deepseek.com/api/create-chat-completion/ , https://platform.claude.com/docs/en/api/overview , https://platform.claude.com/docs/en/api/messages/create .
