# Two-Clone Workflow Cheatsheet

Use this when you want to develop Nexus while also using it as a consumer.

## Clone Roles

- `Nexus-dev` = development clone (edit code, run tests, validate changes)
- `Nexus` = consumer clone (run the app you actively use)

## Recommended Daily Flow

1. Start consumer daemon from `Nexus` and capture logs:

```bash
cd ../Nexus
pnpm prod:daemon 2>&1 | tee -a /tmp/nexus-consumer.log
```

2. Work in `Nexus-dev`:

```bash
cd ../Nexus-dev
# edit code, run checks, etc.
```

3. After bringing code changes into `Nexus`, restart consumer:

```bash
cd ../Nexus
pnpm prod:restart
```

`prod:restart` sends `SIGUSR1` to the daemon, which reruns the child command (`pnpm prod`), including a fresh build.

## Build/Runtime Gotchas

- `pnpm prod:start` does **not** run a build. It runs `apps/backend/dist/index.js` directly.
- `pnpm prod:daemon` starts a background daemon once. Running it again while already running does not restart the child.
- If source changed, use `pnpm prod:restart` (daemon) or `pnpm prod` (foreground build + start).

## State Isolation (Current)

Dev and prod are isolated by default:

- `pnpm dev` / `pnpm dev:backend` uses `NEXUS_DATA_DIR=~/.nexus-dev`
- `pnpm prod:start` uses `~/.nexus` (unless `NEXUS_DATA_DIR` is explicitly set)

So running prod in `Nexus` and dev in `Nexus-dev` does not share state by default.

## When Collisions Can Still Happen

You can still collide if both clones run the same mode:

- prod + prod -> both use `~/.nexus` by default
- dev + dev -> both use `~/.nexus-dev` by default

For strict per-clone isolation (recommended when both clones run prod), set `NEXUS_DATA_DIR` explicitly:

```bash
cd ../Nexus
NEXUS_DATA_DIR=$PWD/.nexus-data pnpm prod:start
```

```bash
cd ../Nexus-dev
NEXUS_DATA_DIR=$PWD/.nexus-data pnpm dev
```

## Log Access

Useful places to inspect while debugging:

- Consumer runtime log: `/tmp/nexus-consumer.log`
- Consumer clone files: `../Nexus/*`
- Dev clone files: `../Nexus-dev/*`
