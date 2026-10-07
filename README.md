# Smartbin

Next.js + tRPC monorepo. Postgres via Drizzle.

- `apps/web` — Next.js app. tRPC is served at `/api/trpc`
- `packages/api` — tRPC router
- `packages/db` — Drizzle schema and client

Mobile is a separate repo: `Smartbin-Mobile` (Expo).

```sh
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:push
pnpm dev
```

App runs at http://localhost:3000.

Production is a Next.js server (`pnpm build && pnpm start`) with `DATABASE_URL` pointing at Postgres.
