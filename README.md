# Smartbin

Backend and admin for SmartBin. Postgres via Drizzle.

- `apps/api` — Express + TypeScript API (Cognito auth, S3 uploads, AI image check, admin endpoints)
- `packages/db` — Drizzle schema and client
- `docs/api.md` — **API reference for the mobile app and admin dashboard**
- `apps/web` — placeholder; the admin dashboard will be a React app

Mobile is a separate repo: `Smartbin-Mobile` (Expo).

```sh
docker compose up -d                    # Postgres on localhost:15432
cd packages/db && npx drizzle-kit push  # create/update tables
cd ../../apps/api && npm install
cp .env.example .env                    # fill in Cognito, S3 and OpenAI values
npm run dev                             # http://localhost:3000/v1/health
```
