# How SmartBin keeps fake bins off the map

A bin only goes on the map if it gets past every layer below. Each layer is enforced by the API, not just the app, and two test scripts prove it.

**For judges and visitors: the public page `/evals`** shows the latest evaluation run with every test photo, the model's verdict, confidence and reason, plus a box to try your own photo. Admins can re-run the evaluation live from that page.

| # | Layer | What it stops | Where |
|---|---|---|---|
| 1 | **Sign-in required** (Cognito) | Anonymous spam | `common/auth/middleware.ts` |
| 2 | **Live camera only** in the app | Old photos, internet images, gallery uploads | `apps/web/src/components/CameraCapture.tsx` |
| 3 | **Upload link only for JPEG, PNG or WebP**, 5 minutes, into the user's own folder | Other file types, uploading into someone else's folder | `common/storage/s3.ts` |
| 4 | **Photo must be yours** (key must be in your own folder) | Reusing someone else's photo | `modules/dustbin/service.ts` |
| 5 | **File must really be an image** (checked from its bytes, not the claimed type) | A text file or anything else renamed `.jpg`. It's deleted on the spot | `detectImageType` in `common/storage/s3.ts` |
| 6 | **AI photo check** (gpt-4.1-mini, Bedrock when enabled): only a *purpose-made bin standing in a public place* passes, with confidence ≥ 0.7. The rule is applied in code from the model's structured answer | Look-alikes (buckets, post boxes, hydrants, barrels), garbage piles or bags with no bin, drawings. Rejected photos are deleted | `common/ai/openai.ts` |
| 7 | **No other bin within 15 m** | The same bin registered twice | `modules/dustbin/service.ts` |
| 8 | **Monthly limit per user** (admin-set, default 10 registrations); only accepted bins count | Bulk registration from one account | `modules/user/quota.ts`, `/admin/settings` |
| 9 | **Missing reports need you within 20 m** of the bin, and are limited per month | Removing real bins from home | `modules/dustbin/service.ts` |

## Test 1: does the AI tell bins from look-alikes?

```sh
cd apps/api
npm run eval:vision
```

Runs 20 labelled photos from Wikimedia Commons (`apps/api/src/modules/evals/vision-cases.json`, images in `apps/web/public/evals`) through the exact check the API uses, and saves the run so `/evals` shows it. It prints each verdict, confidence and the model's reason, and **fails if any non-dustbin is accepted or a clear dustbin is rejected**.

Latest result (gpt-4.1-mini, same result on 3 runs in a row):

```
Non-dustbins rejected : 12/12   (fakes that got through: 0)
Clear dustbins accepted: 6/6
Hard cases            : bin-bamboo-india.jpg → rejected, bin-far-away-park.jpg → accepted
Overall accuracy      : 19/20 (95%), about 1.2 s per photo
PASS
```

The 12 non-dustbins include deliberate traps: a plastic bucket, a dirty bucket, a red post box, a fire hydrant, an old barrel, a black bag full of rubbish and two garbage dumps.

**The trade-off we chose:** earlier versions let the model accept "improvised" bins (drums, barrels) when it saw waste in them. It then claimed a bin liner in an empty barrel and accepted a bag of rubbish. So now only purpose-made bins pass. The cost is that a bamboo basket bin (a real eco-bin in Assam) is rejected, which is why it's listed as a hard case.

## Test 2: can a fake bin get in through the API?

```sh
cd apps/api
npm run test:anti-fake                                  # local API
API_URL=https://<deployed-api>/v1 npm run test:anti-fake
```

Tries every way in with two temporary users, then deletes everything it created:

```
✔ No login → refused  → 401
✔ Upload link for text/html → refused  → 400 VALIDATION_ERROR
✔ Upload link for application/pdf → refused  → 400 VALIDATION_ERROR
✔ Upload link for image/gif → refused  → 400 VALIDATION_ERROR
✔ Register with someone else's uploaded photo → refused  → 403 INVALID_IMAGE_KEY
✔ Register with a photo that was never uploaded → refused  → 404 INVALID_IMAGE_KEY
✔ Text file disguised as a JPEG → refused  → 400 That file isn't a real JPEG, PNG or WebP photo.
✔   …and it was deleted (can't be retried)  → 404 INVALID_IMAGE_KEY
✔ Photo of a plastic bucket → rejected by the AI  → 422 NOT_A_BIN
✔   …and the photo was deleted  → 404 INVALID_IMAGE_KEY
✔ Real dustbin photo → accepted  → 201
✔ Another bin 5 m away → refused as a duplicate  → 409 DUPLICATE_NEARBY
✔ Impossible coordinates (latitude 123) → refused  → 400
✔ Report it missing from 1 km away → refused  → 403 TOO_FAR
✔ Monthly limit: only the 1 accepted bin was counted (rejections are free)
15/15 checks passed
```

With `AUTH_MODE=cognito` it creates two temporary Cognito users, so it needs AWS credentials that can manage the user pool. Against a deployed API, the two test users and the test bin's history stay in that database.

## Known limits

- **The camera rule is enforced by the app, not the API.** Someone calling the API directly can upload any real photo of a real bin, for example one from the internet. Layers 4–9 still apply: it must pass the AI check, sit 15 m from every other bin, and fit the monthly limit.
- **GPS is reported by the phone** and can be spoofed with developer tools. The 15 m and 20 m rules limit what a spoofer can do, but don't prove presence.
- **The AI is a filter, not proof.** One clear photo of a real bin passes wherever it was taken. Ideas for later: compare the photo's capture time to the request, or ask a second user to confirm.
