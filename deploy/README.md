# Deployment and rollback

The live server uses Caddy with `/etc/caddy/Caddyfile` importing `/etc/caddy/Caddyfile.d/*`. Before this release, `/etc/caddy/Caddyfile.d/lninl.com.caddyfile` serves both apex and `www` from `/opt/lninl.com`. The release **splits this one block**: apex serves this project from `/srv/personal-agent/current/web`; `www` retains its original `/opt/lninl.com` behavior. Do not replace the global Caddyfile or any other site file.

## Build and release layout

- Build static output locally: `cd web && pnpm install --frozen-lockfile && pnpm build`.
- Build the Rust API on the Linux server with `cd api && cargo build --release` (the local macOS binary is not deployable there).
- Version releases as `/srv/personal-agent/releases/<git-commit>/web` and `/srv/personal-agent/releases/<git-commit>/api/personal-agent-api`.
- `/srv/personal-agent/current` is a symlink to the active release. Caddy and systemd both refer to the symlink.
- Run the API as a non-login `personal-agent` system user. It binds only to `127.0.0.1:8787` and has no server-side OpenAI key.

## Safe change sequence

1. Save `sha256sum /opt/lninl.com/index.html` and the current `https://www.lninl.com/` response body hash. Save a timestamped copy of `/etc/caddy/Caddyfile.d/lninl.com.caddyfile` outside the imported `.d` directory.
2. Transfer static output and API source into a new release directory. Build Rust there. Do not modify the active release while building.
3. Install `deploy/personal-agent.service` as `/etc/systemd/system/personal-agent.service`; create its system user if absent. Start it and verify `curl -fsS http://127.0.0.1:8787/api/health`.
4. Write `deploy/Caddyfile.snippet` to the existing per-site Caddy file, retaining a backup. Run `caddy validate --config /etc/caddy/Caddyfile` before reload.
5. Atomically switch `/srv/personal-agent/current` to the new release; reload the API and Caddy. Run `deploy/smoke.sh`; compare the `www` body hash with the baseline.
6. Check both app routes in a browser, including local persistence and task approval. A live OpenAI chat requires a user's own key; never store it in deployment notes.

## Rollback

Restore the backed-up per-site Caddy file, restore the previous `current` symlink if one existed, then run `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`. Stop `personal-agent.service` if there was no previous API release. Run the `www` and apex HTTP checks again. Keep the failed release for inspection; do not remove the prior release during a deployment.

## Release record

After deployment, record the deployed Git commit, release directory, config-backup path, `www` before/after hashes, and smoke-test outcome here. Do not record credentials or API keys.
