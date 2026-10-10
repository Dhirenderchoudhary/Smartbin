# Smartbin

Web app, admin dashboard and API for SmartBin. Postgres via Drizzle.

- `apps/api` — Express + TypeScript API (Cognito auth, S3 uploads, AI image check, admin endpoints)
- `packages/db` — Drizzle schema and client
- `docs/api.md` — **API reference for the mobile app and admin dashboard**
- `apps/web` — Next.js web app: landing page, the user map app and the admin dashboard. Design and flows: `apps/web/DESIGN.md`, `apps/web/FLOWS.md`
- `.claude/rules/aws-handoff.md` — what runs locally today and what AWS replaces (auth, maps, routes, storage, hosting)

Mobile is a separate repo: `Smartbin-Mobile` (Expo).

```sh
docker compose up -d                    # Postgres on localhost:15432
cd packages/db && npx drizzle-kit push  # create/update tables
cd ../../apps/api && npm install
cp .env.example .env                    # fill in Cognito, S3 and OpenAI values
npm run dev                             # http://localhost:3000/v1/health
```
