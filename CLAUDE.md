# SmartBin

SmartBin helps people in India find the nearest public dustbin, see whether it takes wet or dry waste, walk there, report problems (full, broken, dirty, missing), and add bins that aren't on the map. Admins (city and campus teams) watch usage, a cleaning queue and settings. Built for the WeMakeDevs × AWS hackathon.

## This repo

| Path | What | Read first |
|---|---|---|
| `apps/web` | Next.js 16 web app: landing page, the user map app (`/app`) and the admin dashboard (`/admin`) | `apps/web/CLAUDE.md`, `apps/web/DESIGN.md`, `apps/web/FLOWS.md` |
| `apps/api` | Express + TypeScript API on `/v1` (auth, bins, problems, quotas, admin analytics) | `docs/api.md` |
| `packages/db` | Drizzle schema and client (Postgres) | `packages/db/src/schema.ts` |
| `docs/api.md` | **The API contract** for the web and Expo apps | |
| `plan-web-repo.md` | Original hackathon plan: AWS architecture and owners | |

The phone app is a separate repo, `Smartbin-Mobile` (Expo). It copies this web app's design and flows screen for screen, so a change to how something looks or works in `apps/web` usually needs the same change there.

**AWS:** auth, maps, routing, storage, the photo check and hosting are local stand-ins today and will be replaced with AWS by the infra side of the team. Read `.claude/rules/aws-handoff.md` before touching sign-in, maps, routes, uploads or env vars.

## Run it locally

```sh
docker compose up -d                       # Postgres on localhost:15432
pnpm install
pnpm db:push                               # create/update tables from packages/db
cp apps/api/.env.example apps/api/.env     # local mode: AUTH_MODE=dev, STORAGE_MODE=local, VISION_PROVIDER=off
cp apps/web/.env.example apps/web/.env
cd apps/api && pnpm dev                    # http://localhost:3000/v1/health
pnpm dev                                   # from the root: web on http://localhost:3001
pnpm --filter @smartbin/api seed:demo        # optional: demo bins, problems and usage
```

Local sign-in: any email and password; the token is the email. `admin@smartbin.local` is an admin (`DEV_ADMIN_EMAILS`), and the sign-in pages have one-tap test buttons.

## Rules

- **The API is the source of truth.** Business rules (15 m between bins, 20 m to report missing, 50 m to report or clear a problem, quotas, the removal threshold) live in the API and are only mirrored in the clients for messages. Change `docs/api.md` with any API change.
- **Roles are checked by the API.** `AuthGate` in the web app only keeps people off pages they can't use.
- Schema changes go in `packages/db`, then `pnpm db:push`.
- Before calling something done: `pnpm lint` and `npx tsc --noEmit` in `apps/web`; `npx tsc --noEmit` in `apps/api`.
- Never commit `.env` files or secrets. Add new variables to the matching `.env.example`.
