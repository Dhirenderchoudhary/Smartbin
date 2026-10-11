# AWS hand-off: what's a local stand-in and what replaces it

SmartBin runs fully on a laptop today. **Auth, maps, routing, photo storage, the photo check and hosting will move to AWS, and that work is done by the AWS/infra side of the team, not as part of feature work.** Each AWS service already sits behind a single swap point, so the move changes config and a few small files, not screens.

The plan, architecture and owners are in `plan-web-repo.md` (AWS account, Cognito, Location, hosting and CI/CD: Dhirender; API integrations: Karan). The Expo app (`Smartbin-Mobile`) has the same swap points and its own copy of this file.

## The swap list

| Area | Today (local) | On AWS | Swap point | Status |
|---|---|---|---|---|
| **Sign-in (web)** | `NEXT_PUBLIC_AUTH_MODE=dev`: the token is the email, any password works; `TestLogin` buttons | Amazon Cognito user pool with `USER` / `ADMIN` groups, via `aws-amplify` v6 | `apps/web/src/lib/auth.ts`: `signIn`, `signUp`, `confirmSignUp`, `resendCode`, `signOut`, `getToken` | Built. Sign-up has the emailed-code step in `AuthForm`. Set the pool and client IDs and `NEXT_PUBLIC_AUTH_MODE=cognito` |
| **Sign-in (API)** | `AUTH_MODE=dev`: bearer token = email; `DEV_ADMIN_EMAILS` are admins | Cognito JWT check, admin = `ADMIN` group | `apps/api/src/common/auth/` (`verifier.ts`, `middleware.ts`, `cognito.ts`) | Built; needs the pool ID and client IDs in env |
| **Map tiles** | OpenFreeMap (positron / dark) | Amazon Location Maps, `Monochrome` style, `political-view=IND` | `apps/web/src/lib/mapStyle.ts`, `components/map/createMap.ts` | Built; set `NEXT_PUBLIC_AWS_MAP_KEY`. Falls back to OpenFreeMap on its own if Amazon fails or takes over 8 s |
| **Walking routes** | FOSSGIS OSRM (`routing.openstreetmap.de`, fair use), then a straight line | Amazon Location Routes (pedestrian) | `apps/web/src/lib/routes.ts` (`walkingRoute`) | Built; uses the same key if it allows geo-routes |
| **Photo storage** | `STORAGE_MODE=local`: files in `apps/api/.local-uploads`, links point at the API | S3 (presigned PUT) + CloudFront | `apps/api/src/common/storage/s3.ts` vs `local.ts` | Built; set bucket and credentials |
| **Photo check** | `VISION_PROVIDER=off` (every photo passes) or `openai` | Amazon Bedrock (Nova Lite) | `apps/api/src/common/ai/vision.ts`, `bedrock.ts` | Built; switch with `VISION_PROVIDER=bedrock` |
| **Database** | Postgres in Docker on `localhost:15432` | RDS PostgreSQL | `DATABASE_URL` | Same Drizzle schema (`packages/db`) |
| **Hosting** | `localhost:3000` (API), `:3001` (web) | API on EC2 behind API Gateway; web on Amplify Hosting | env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `CORS_ORIGINS` | Not deployed |

The API refuses to start in production (`NODE_ENV=production`) with `AUTH_MODE=dev`, `STORAGE_MODE=local` or `VISION_PROVIDER=off`.

## Rules for anyone (and any AI) working in this repo

- **Don't build around the stand-ins.** Pages must only call `signIn` / `signUp` / `signOut` / `getToken` from `lib/auth.ts` and `api()` from `lib/api.ts`, never read `localStorage["smartbin.session"]` or assume the token is an email. Then the Cognito swap touches one file.
- **Keep the function signatures** of `lib/auth.ts`, `lib/mapStyle.ts` and `lib/routes.ts`. Screens depend on them, and the Expo app mirrors them.
- **Don't remove the fallbacks** (OpenFreeMap, the OSM router, the straight line). They keep the app working when an AWS key is missing, throttled or expired.
- **Local-only UI must check `LOCAL_AUTH`.** `TestLogin` and the "Testing" card on the account page render nothing once `NEXT_PUBLIC_AUTH_MODE` isn't `dev`. Anything new that only makes sense locally must do the same.
- **The API contract doesn't change** with AWS: `docs/api.md` stays the source of truth for both apps.
- If you're asked to do the AWS swap itself, follow the comments at the swap points and check with the infra owners for the real IDs, keys and URLs. Never commit secrets: `.env` files are gitignored, so add new variables to the matching `.env.example` with a placeholder.

## Env vars that switch things over

```sh
# .env at the repo root (npm run dev in apps/web loads it); see .env.example
NEXT_PUBLIC_AUTH_MODE=cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_...
NEXT_PUBLIC_COGNITO_CLIENT_ID=...
NEXT_PUBLIC_API_URL=https://<api-gateway-url>/v1
NEXT_PUBLIC_SITE_URL=https://<web-domain>
NEXT_PUBLIC_AWS_MAP_KEY=v1.public....        # Amazon Location API key (maps + routes)
NEXT_PUBLIC_AWS_REGION=ap-south-1

# apps/api/.env
AUTH_MODE=cognito
COGNITO_USER_POOL_ID=...
MOBILE_CLIENT_ID=...
ADMIN_CLIENT_ID=...
STORAGE_MODE=s3
S3_BUCKET_NAME=...
VISION_PROVIDER=bedrock
DATABASE_URL=postgres://...rds.amazonaws.com:5432/smartbin
CORS_ORIGINS=https://<web-domain>
NODE_ENV=production
```
