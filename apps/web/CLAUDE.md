# SmartBin web app

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn on **base-nova** (Base UI, not Radix) · maplibre-gl 6 · Recharts 3 · lucide-react. Runs on port 3001 and talks to the API in `../api` through `NEXT_PUBLIC_API_URL`.

@DESIGN.md
@FLOWS.md

**AWS:** sign-in, map tiles, walking routes and hosting are local stand-ins that the infra side of the team will swap for AWS. See `../../.claude/rules/aws-handoff.md`, and keep pages calling `lib/auth.ts`, `lib/api.ts`, `lib/mapStyle.ts` and `lib/routes.ts` rather than working around them.

## Where things are

| Path | What |
|---|---|
| `src/app/` | Routes: `page.tsx` (landing), `(auth)/` (sign in, sign up, admin sign in), `app/` (user map app), `admin/` (dashboard), `privacy/` |
| `src/components/ui/` | shadcn base-nova components, restyled to Uber Base |
| `src/components/map/` | `BinMap` (user map), `BinPanel` (bottom sheet / side panel), `NavigationPanel`, `LocationPicker` (add a bin), `createMap` (theme + tile fallback) |
| `src/components/admin/` | `AdminShell` (sidebar), `AdminMap`, `BinSpotMap`, `parts.tsx` (`AdminPage`, `Panel`, ...) |
| `src/lib/` | `api.ts` (fetch wrapper, `ApiError`), `auth.ts` (sign-in swap point), `bins.ts` (bins, distances, location), `routes.ts` (walking routes), `mapStyle.ts` (tiles), `admin.ts` (admin API types and hooks), `theme.ts`, `site.ts` |

## Commands

```sh
pnpm dev            # copies the maplibre worker to public/, then next dev -p 3001
pnpm lint
npx tsc --noEmit
pnpm build
```

## Things that bite

- **maplibre-gl needs the browser.** Map components are loaded with `next/dynamic(..., { ssr: false })`, and the worker is copied to `public/maplibre-gl-worker.mjs` by `predev` / `prebuild`.
- **Don't use `map.isStyleLoaded()`** to decide whether to add layers: it stays false until every tile arrives. Track readiness with a ref set on `"style.load"` (see `BinMap`, `AdminMap`). Re-add sources and layers after a style swap (theme change or tile fallback).
- **maplibre makes its container `position: relative`**, so size and position a wrapper `div`, not the map container.
- **Never style or scale a marker's root element.** MapLibre positions it with `transform`, so put the look on an inner element.
- **Recharts:** pass `isAnimationActive={false}`, otherwise charts are empty in screenshots and on slow phones.
- **Hydration:** `<html>` and `<body>` have `suppressHydrationWarning` because the theme script and browser extensions (Grammarly) change attributes before React loads. Don't remove it.
- `useSearchParams()` needs a `<Suspense>` boundary (see `src/app/app/page.tsx`).
- Base UI composition: `render={<Link href="…" />}` with `nativeButton={false}`, not `asChild`.

## Rules

- Follow `DESIGN.md`: tokens from `globals.css` only (no hex values in components), pill buttons, `size="xl"` for main actions on phones, sentence-case plain copy.
- Test every user screen at 320, 360 and 390 px wide, in light and dark mode. No horizontal scroll.
- **Keep the Expo app in step.** `Smartbin-Mobile` mirrors `lib/bins.ts`, `lib/routes.ts`, `lib/mapStyle.ts`, `lib/auth.ts`, the colour tokens and the screens. When you change a flow or a token here, note it for the mobile app (or change it there too).
- Tracking calls (`trackInteraction`) are best effort: never `await` them in a way that blocks the UI.
