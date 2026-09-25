# Deployment and rollback

The live server uses Caddy with `/etc/caddy/Caddyfile` importing `/etc/caddy/Caddyfile.d/*`. Before this release, `/etc/caddy/Caddyfile.d/lninl.com.caddyfile` serves both apex and `www` from `/opt/lninl.com`. The release **splits this one block**: apex serves this project from `/srv/personal-agent/current/web`; `www` retains its original `/opt/lninl.com` behavior. Do not replace the global Caddyfile or any other site file.

## Build and release layout

- Build static output locally: `cd web && pnpm install --frozen-lockfile && pnpm build`.
- Build the Rust API on the Linux server with `cd api && cargo build --release` (the local macOS binary is not deployable there).
- Version releases as `/srv/personal-agent/releases/<git-commit>/web` and `/srv/personal-agent/releases/<git-commit>/api/personal-agent-api`.
- `/srv/personal-agent/current` is a symlink to the active release. Caddy and systemd both refer to the symlink.
- Run the API as a non-login `personal-agent` system user. It binds only to `127.0.0.1:18787` and has no server-side OpenAI key. Port 8787 is occupied by an unrelated existing service on this server.

## Safe change sequence

1. Save `sha256sum /opt/lninl.com/index.html` and the current `https://www.lninl.com/` response body hash. Save a timestamped copy of `/etc/caddy/Caddyfile.d/lninl.com.caddyfile` outside the imported `.d` directory.
2. Transfer static output and API source into a new release directory. Build Rust there. Do not modify the active release while building.
3. Install `deploy/personal-agent.service` as `/etc/systemd/system/personal-agent.service`; create its system user if absent. Start it and verify `curl -fsS http://127.0.0.1:18787/api/health`.
4. Write `deploy/Caddyfile.snippet` to the existing per-site Caddy file, retaining a backup. Run `caddy validate --config /etc/caddy/Caddyfile` before reload.
5. Atomically switch `/srv/personal-agent/current` to the new release; reload the API and Caddy. Run `deploy/smoke.sh`; compare the `www` body hash with the baseline.
6. Check both app routes in a browser, including local persistence and task approval. A live OpenAI chat requires a user's own key; never store it in deployment notes.

## Rollback

Restore the backed-up per-site Caddy file, restore the previous `current` symlink if one existed, then run `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`. Stop `personal-agent.service` if there was no previous API release. Run the `www` and apex HTTP checks again. Keep the failed release for inspection; do not remove the prior release during a deployment.

## Release record

Initial release, 2026-09-25 (Asia/Shanghai):

- Product source commit: `5bba2a6`.
- Release directory: `/srv/personal-agent/releases/5bba2a6`; active symlink: `/srv/personal-agent/current`.
- Config backup: `/etc/caddy/backups/lninl.com.caddyfile.20260924T175315Z`.
- `www` body SHA-256 before and after: `cfa1d2492a430f08c6d2816a5beb5f19161cc3343271634b3095973f5f7905b6`.
- `deploy/smoke.sh`: all six checks passed. Production browser tests with a mocked model endpoint: 4/4 passed. Live `/api/chat` returned 401 without a key and 400 for invalid JSON with a dummy key; the dummy key did not appear in the Caddy access log.
- A real OpenAI call was not run because no model API key was provided. This remains a user-driven validation step.

Follow-up release, 2026-09-25 (Asia/Shanghai):

- Product source commit and active release: `eca9a07` at `/srv/personal-agent/releases/eca9a07`.
- Previous release `5bba2a6` remains available. The per-site Caddy configuration and its backup are unchanged.
- `deploy/smoke.sh`: all six checks passed; production browser tests with a mocked model endpoint: 5/5 passed. `robots.txt` now allows crawlers to read the workspace pages' `noindex` directives.
- `www` response body SHA-256 remains `cfa1d2492a430f08c6d2816a5beb5f19161cc3343271634b3095973f5f7905b6`.
- To roll back only the application release: `ln -s /srv/personal-agent/releases/5bba2a6 /srv/personal-agent/current.rollback && mv -Tf /srv/personal-agent/current.rollback /srv/personal-agent/current && systemctl restart personal-agent`. Validate `/api/health` and rerun `deploy/smoke.sh` afterward.

Continuous-agent release, 2026-09-25 (Asia/Shanghai):

- Product source commit and active release: `dfb641e` at `/srv/personal-agent/releases/dfb641e`; previous release `eca9a07` remains available for rollback.
- Built the Rust binary on the Linux server from the release source and transferred the local Astro build. The English landing-page hash matched across transfer. No Caddy configuration change was needed.
- After the atomic symlink switch and API restart, the health endpoint and all six smoke checks passed. Production Playwright tests passed 9/9, including bilingual goal/check-in persistence and mocked task approval. The live English/Chinese loop copy is present, and `www` still has SHA-256 `cfa1d2492a430f08c6d2816a5beb5f19161cc3343271634b3095973f5f7905b6`.
- A real OpenAI call remains untested without a user-supplied API key. To roll back this application release, atomically repoint `/srv/personal-agent/current` to `/srv/personal-agent/releases/eca9a07`, restart `personal-agent`, and rerun `deploy/smoke.sh`.

Do not record credentials or API keys here.
