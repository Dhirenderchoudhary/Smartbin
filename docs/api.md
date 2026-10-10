# SmartBin API reference

For the mobile app (Expo) and the admin dashboard (React). All routes live under **`/v1`** and use JSON.

- **Local:** `http://localhost:3000/v1` (port comes from `PORT` in `apps/api/.env`)
- **Deployed:** not yet. The URL will be shared once the API is on AWS.

---

## Quick reference

**Users**

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service status (no login) |
| GET | `/me` | Current user's profile |
| GET | `/me/quota` | Monthly limits and usage |
| GET | `/dustbins/upload-url` | Get a link to upload a photo |
| GET | `/dustbins/nearby` | Bins near a location |
| POST | `/dustbins` | Register a bin |
| POST | `/dustbins/:id/report-missing` | Report a bin as missing |

**Admins**

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/ping` | Check admin access |
| GET | `/admin/stats` | Dashboard numbers |
| GET | `/admin/stats/timeseries` | Daily counts for charts |
| GET | `/admin/bins` | Bin table with filters and pages |
| GET | `/admin/bins/map` | All bins for the map |
| GET | `/admin/bins/:id` | One bin with its history |
| PATCH | `/admin/bins/:id` | Edit a bin or reset its reports |
| DELETE | `/admin/bins/:id` | Delete a bin |
| GET | `/admin/events` | Activity feed |
| GET | `/admin/users` | User table |

---

## How bins work

- A bin is **ACTIVE** as soon as it's registered. There is no verified or unverified state.
- Registering needs a photo that the AI recognises as a dustbin, and **no other bin within 15 m**.
- Reporting a bin missing needs the user to be **within 20 m** of it.
- After **3 missing reports**, the bin is **removed**. If it is actually still there, someone registers it again. Admins keep its full history.
- **Monthly limits per user:** 10 registrations and 15 missing reports. They reset on the 1st of each month.

---

## Login

Every route except `/health` needs a Cognito **access token**. Don't send the ID token.

```
Authorization: Bearer <accessToken>
```

| Setting | Value |
|---|---|
| Region | `ap-south-1` |
| User pool ID | `ap-south-1_o0dl59fXW` |
| App client ID | `5dd4sa7rv9ssukopc78iud9oeb` (no client secret) |

Sign in by email and password. With Amplify, get the token from `fetchAuthSession()` and use `tokens.accessToken.toString()`. The API creates the user's database record on their first request.

**Admins** are Cognito users in the **`ADMIN`** group. To make someone an admin, ask Karan or run:

```sh
aws cognito-idp admin-add-user-to-group --user-pool-id ap-south-1_o0dl59fXW \
  --username <email> --group-name ADMIN --region ap-south-1
```

The user must **sign out and back in** afterwards, because group membership is only read from a new token.

---

## Response format

Every response uses one of two shapes.

**Success**
```json
{ "success": true, "statusCode": 200, "message": "Success", "data": { } }
```

**Error**
```json
{ "success": false, "error": { "code": "DUPLICATE_NEARBY", "message": "A dustbin already exists within 15 meters of this location.", "details": { "existingBinId": "…" } } }
```

`error.message` is written so it can be shown to users as is. Use `error.code` to decide what to do in the UI. `details` only appears on some errors.

**Paginated lists** (admin) put this inside `data`:
```json
{ "items": [ ], "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
```

### Error codes

| HTTP | `code` | When | Suggested UI |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | A field is missing, has the wrong type or is out of range. `message` names the field, e.g. `lat: Number must be less than or equal to 90` | Fix the input |
| 400 | `UNSUPPORTED_MEDIA` | The uploaded file isn't a JPEG, PNG or WebP, or is over 5 MB | Ask for another photo |
| 401 | `UNAUTHORIZED` | No token, or the token is expired or invalid | Refresh the token or sign in again |
| 403 | `FORBIDDEN` | Not an admin (admin routes) | Show "Admin access required" |
| 403 | `INVALID_IMAGE_KEY` | The image key belongs to another user | Upload again |
| 403 | `TOO_FAR` | Reporting from more than 20 m away from the bin | "Move closer to the bin" |
| 404 | `NOT_FOUND` | The bin doesn't exist or was removed | Refresh the list |
| 404 | `INVALID_IMAGE_KEY` | Nothing was uploaded with this key | Upload again |
| 409 | `DUPLICATE_NEARBY` | A bin already exists within 15 m. `details.existingBinId` says which one | Offer to show the existing bin |
| 422 | `NOT_A_BIN` | The AI didn't see a dustbin in the photo | Ask for a clearer photo |
| 429 | `QUOTA_EXCEEDED` | The monthly limit is used up | Show `/me/quota` |
| 500 | `INTERNAL_SERVER_ERROR` | Server problem | "Something went wrong, try again" |

---

## Shared objects

**Bin** (from `/dustbins/nearby`)
```json
{
  "id": "2594b173-c0e0-4607-84b5-799371cdb53f",
  "name": "SmartBin",
  "type": "DRY",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "status": "ACTIVE",
  "missingReports": 0,
  "fillPercent": 0,
  "createdAt": "2026-10-10T03:52:30.321Z",
  "distance": 42.7,
  "imageUrl": "https://smartbin-uploads-bucket.s3.ap-south-1.amazonaws.com/...&X-Amz-Signature=..."
}
```

- `type` is `WET`, `DRY` or `BOTH`.
- `distance` is in metres from the location in the request.
- `imageUrl` is a signed link that works for **1 hour**. Don't save it; fetch the list again to get a fresh one.
- `status` is always `ACTIVE`.
- `fillPercent` is reserved and always `0` for now.

---

## Endpoints for users

### `GET /health`
No login needed. Returns `200` with `{ ok, db: true, timestamp }`, or `503` if the database is down.

### `GET /me`
```json
{ "id": "uuid", "sub": "cognito-sub", "email": "a@b.com", "role": "USER", "groups": [] }
```
`role` is `"ADMIN"` for users in the `ADMIN` group.

### `GET /me/quota`
```json
{
  "month": "2026-10",
  "limits":    { "registrations": 10, "missingReports": 15 },
  "used":      { "registrations": 2,  "missingReports": 3 },
  "remaining": { "registrations": 8,  "missingReports": 12 }
}
```

### Registering a bin: 3 steps

**Step 1: get an upload link.** `GET /dustbins/upload-url?contentType=image/jpeg`

`contentType` must be `image/jpeg`, `image/png` or `image/webp`.

```json
{ "uploadUrl": "https://smartbin-uploads-bucket.s3...&X-Amz-Signature=...", "key": "dustbins/<userId>/<uuid>.jpg" }
```

**Step 2: upload the photo straight to S3.** The photo doesn't go through the API.
```
PUT <uploadUrl>
Content-Type: image/jpeg      ← must match the contentType from step 1
<raw image bytes>
```
- The link expires after **5 minutes**.
- The image must be **5 MB or less**. Resize to about 1280 px on the phone first.
- A `200` from S3 means the upload worked.

**Step 3: register.** `POST /dustbins`
```json
{ "imageKey": "dustbins/<userId>/<uuid>.jpg", "type": "DRY", "latitude": 28.6139, "longitude": 77.2090, "name": "Near gate 2" }
```

- `name` is optional (up to 100 characters); everything else is required.
- Takes **2–4 seconds** because of the AI check, so show a loading state.
- `201`: the new bin, in the same fields as **Bin** above, plus `imageKey` and `createdBy` and without `imageUrl`/`distance`.
- Possible errors:
  - `400 VALIDATION_ERROR`
  - `403 INVALID_IMAGE_KEY`
  - `404 INVALID_IMAGE_KEY`
  - `409 DUPLICATE_NEARBY` (with `existingBinId`)
  - `422 NOT_A_BIN`: the photo is also deleted from S3
  - `429 QUOTA_EXCEEDED`

### `GET /dustbins/nearby?lat=28.61&lng=77.20&radius=500`

- `lat` and `lng` are required. `radius` is optional, in metres, 1–5000.
- **With `radius`:** every bin within that distance, nearest first.
- **Without `radius`:** the **5 nearest** bins.
- `200`: an array of **Bin**.

### `POST /dustbins/:id/report-missing`
```json
{ "lat": 28.6139, "lng": 77.2090 }
```

Send the user's **current GPS position**; it must be within 20 m of the bin.

```json
{ "id": "uuid", "missingReports": 2, "threshold": 3, "removed": false }
```

When `removed` is `true`, the bin was deleted, so take it off the map. `message` says either `"Missing report logged (2/3)."` or `"Dustbin removed after reaching 3 missing reports."`

Possible errors: `400`, `403 TOO_FAR`, `404 NOT_FOUND`, `429 QUOTA_EXCEEDED`.

---

## Endpoints for admins

All of these need an `ADMIN` token. A normal user gets `403 FORBIDDEN`.

"Today" and the daily chart days use **India time (Asia/Kolkata)**.

### `GET /admin/ping`
Returns `200` if the token belongs to an admin. Useful as a check right after login.

### `GET /admin/stats`: dashboard cards
```json
{
  "bins":    { "active": 124, "byType": { "WET": 40, "DRY": 51, "BOTH": 33 }, "atRisk": 7 },
  "new":     { "today": 3, "last7Days": 21, "last30Days": 88 },
  "reports": { "today": 5, "last7Days": 19 },
  "removed": { "today": 1, "last7Days": 4, "total": 12, "byAdmin": 2 },
  "users":   { "total": 56, "newLast7Days": 9 }
}
```

- `atRisk`: active bins with 1 or 2 missing reports.
- `removed.total`: bins removed by 3 user reports.
- `removed.byAdmin`: bins deleted by an admin.

### `GET /admin/stats/timeseries?days=14`: line chart
`days` is 1–90 (default 14). There is one entry per day, oldest first, and days with no activity come back as zeros.
```json
{
  "days": 14,
  "timezone": "Asia/Kolkata",
  "series": [ { "day": "2026-10-10", "registrations": 4, "missingReports": 4, "removals": 1 } ]
}
```

### `GET /admin/bins`: bin table
| Query | Values |
|---|---|
| `page`, `pageSize` | default 1 and 20; `pageSize` up to 100 |
| `type` | `WET`, `DRY` or `BOTH` |
| `reported` | `true`: only bins with at least 1 report. `false`: only bins with none |
| `q` | Search by name (case-insensitive, matches part of the name) |
| `sort` | `newest` (default), `oldest`, `mostReported` |

Each item has all the bin fields, plus `createdBy` (user id), `creatorEmail` and `imageUrl` (signed, 1 hour).

### `GET /admin/bins/map`
Every active bin in one call, with no pages. Use it for the map view.
```json
[ { "id": "uuid", "name": "SmartBin", "type": "WET", "latitude": 28.61, "longitude": 77.20, "missingReports": 0 } ]
```

### `GET /admin/bins/:id`
The same fields as an `/admin/bins` item, plus `timeline`: the bin's last 100 events, newest first (see **Event** below).

Returns `404` if the bin was removed. Its history is still available from `/admin/events?binId=<id>`.

### `PATCH /admin/bins/:id`
Send any combination of these, at least one:
```json
{ "name": "Gate 2 bin", "type": "WET", "resetReports": true }
```

- `resetReports: true` sets missing reports back to 0, for a bin that turned out not to be missing.
- Any other field is rejected with `400`.
- Returns the updated bin.
- Every change is recorded in the bin's history.

### `DELETE /admin/bins/:id`
Deletes the bin and its photo. Returns `{ "id": "uuid", "deleted": true }`.

The bin's history stays, ending with an `ADMIN_DELETE` event. Returns `404` if the bin doesn't exist.

### `GET /admin/events`: activity feed
| Query | Values |
|---|---|
| `page`, `pageSize` | as above |
| `type` | an event type (see below) |
| `binId` | the history of one bin, including removed bins |

**Event**
```json
{
  "id": "uuid",
  "binId": "uuid",
  "userId": "uuid",
  "userEmail": "a@b.com",
  "type": "REMOVED",
  "latitude": 28.61,
  "longitude": 77.20,
  "meta": { "name": "Gate 2 bin", "type": "WET", "missingReports": 3, "registeredAt": "…", "createdBy": "uuid" },
  "createdAt": "2026-10-10T04:01:53.691Z"
}
```

| `type` | Meaning | `meta` |
|---|---|---|
| `REGISTERED` | A user registered the bin | none |
| `MISSING_REPORT` | A user reported it missing. `latitude`/`longitude` are **where the reporter was standing** | `{ reportNumber }` |
| `REMOVED` | Removed after 3 reports | snapshot of the bin |
| `ADMIN_EDIT` | An admin changed the name or type | `{ before, after }` |
| `ADMIN_RESET_REPORTS` | An admin reset the reports to 0 | `{ previousMissingReports }` |
| `ADMIN_DELETE` | An admin deleted the bin | snapshot of the bin |

Tip: `?type=REMOVED` gives a "removed bins" page.

### `GET /admin/users`
Paginated, newest users first.
```json
{ "id": "uuid", "email": "a@b.com", "role": "USER", "points": 0, "createdAt": "…", "registrations": 4, "missingReports": 2, "activeBins": 3 }
```

- `registrations` and `missingReports` count everything the user has ever done.
- `activeBins` counts their bins that still exist.
- A user only appears here after they've used the app once.

---

## Running the API locally

You'll need Docker, Node 20+, AWS credentials and the OpenAI key; ask Karan for `apps/api/.env`.

```sh
docker compose up -d                  # Postgres on localhost:15432
cd packages/db && npx drizzle-kit push
cd ../../apps/api && npm install && npm run dev
```

**CORS:** the API only accepts browser requests from addresses listed in `CORS_ORIGINS` in `apps/api/.env`. The default is `http://localhost:5173,http://localhost:3000`, so add your dev server's address if it's different.
