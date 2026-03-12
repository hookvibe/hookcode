# Findings

- GitHub Actions currently sets `HOOKCODE_SYSTEM_WORKER_MODE=external` and defaults the display name to `GitHub Actions Default Worker`, which is why Docker/CI deployments surface that worker label in the UI when the worker process uses those env values.
- Backend bootstrap previously called `WorkersService.ensureExternalSystemWorker(...)` in external mode, and that method created or overwrote the worker row unconditionally from env.
- `readExternalSystemWorkerConfig(...)` only needs id/token for backend binding; `HOOKCODE_SYSTEM_WORKER_NAME` and `HOOKCODE_SYSTEM_WORKER_MAX_CONCURRENCY` still matter for the bundled worker process, not for backend-side DB mutation.
- Default task routing prefers `systemManaged` workers, so binding an existing remote worker still has to mark that row as `systemManaged=true`.
- Clearing other remote `systemManaged` rows during binding avoids stale previously-claimed remote workers from winning default routing ahead of the configured worker.
- CI helper script leaves `HOOKCODE_DOCKER_INCLUDE_WORKER=false` by default, so backend-only deployments can bind an external worker entry without starting the bundled worker container.
- The split-host deployment guide had to change materially: fresh installations now need to boot backend once with `HOOKCODE_SYSTEM_WORKER_MODE=disabled`, create the remote worker entry, then switch backend env to `external`.
