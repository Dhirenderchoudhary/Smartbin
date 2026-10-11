// Tries every way to sneak a fake bin into SmartBin through the real API, and checks each is blocked.
//
//   npm run test:anti-fake                                  # against the local API (http://localhost:3000/v1)
//   API_URL=https://<your-api>/v1 npm run test:anti-fake    # against a deployed API
//
// Sign-in follows AUTH_MODE in apps/api/.env: with "cognito" it creates two temporary Cognito users
// (needs AWS credentials allowed to manage the pool) and deletes them afterwards; with "dev" the
// token is just an email (the second user must be in DEV_ADMIN_EMAILS).
// Uses the labelled test photos in apps/web/public/evals. Calls the AI check twice (a fraction of a cent).
import { randomBytes } from "node:crypto";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { config } from "../src/common/config/config.js";
import { loadCases, readCaseImage } from "../src/modules/evals/dataset.js";

const API = process.env.API_URL ?? `http://localhost:${config.PORT}/v1`;
const results: boolean[] = [];

function check(label: string, ok: boolean, detail = "") {
  results.push(ok);
  console.log(`${ok ? "✔" : "✘ FAIL"} ${label}${detail ? `  → ${detail}` : ""}`);
}

async function call(path: string, token: string | null, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(API + path, {
    method: init.method ?? "GET",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, error: json?.error as { code: string; message: string; details?: Record<string, unknown> } | undefined };
}

// Ask for an upload link and upload these bytes, claiming the given content type
async function upload(token: string, bytes: Uint8Array, contentType = "image/jpeg"): Promise<string> {
  const link = await call(`/dustbins/upload-url?contentType=${encodeURIComponent(contentType)}`, token);
  if (link.status !== 200) throw new Error(`upload-url failed: ${link.status} ${link.error?.message}`);
  const put = await fetch(link.data.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: Buffer.from(bytes) });
  if (!put.ok) throw new Error(`photo upload failed: ${put.status}`);
  return link.data.key;
}

// --- test users
const cognito = new CognitoIdentityProviderClient({ region: config.AWS_REGION });
const created: string[] = [];

async function cognitoUser(admin: boolean): Promise<string> {
  const email = `smartbin-antifake-${randomBytes(4).toString("hex")}@example.com`;
  const password = `Aa1!${randomBytes(12).toString("base64url")}`;
  const pool = config.COGNITO_USER_POOL_ID;
  await cognito.send(new AdminCreateUserCommand({
    UserPoolId: pool, Username: email, MessageAction: "SUPPRESS",
    UserAttributes: [{ Name: "email", Value: email }, { Name: "email_verified", Value: "true" }],
  }));
  created.push(email);
  await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: pool, Username: email, Password: password, Permanent: true }));
  if (admin) await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: pool, Username: email, GroupName: "ADMIN" }));
  const auth = await cognito.send(new InitiateAuthCommand({
    ClientId: config.MOBILE_CLIENT_ID, AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: email, PASSWORD: password },
  }));
  return auth.AuthenticationResult!.AccessToken!;
}

async function tokens(): Promise<{ user: string; admin: string }> {
  if (config.AUTH_MODE === "dev") {
    const admin = config.DEV_ADMIN_EMAILS.split(",")[0]?.trim();
    if (!admin) throw new Error("AUTH_MODE=dev: set DEV_ADMIN_EMAILS so the cleanup user is an admin");
    return { user: `antifake-${randomBytes(3).toString("hex")}@smartbin.local`, admin };
  }
  return { user: await cognitoUser(false), admin: await cognitoUser(true) };
}

async function main() {
  console.log(`\nAnti-fake checks against ${API} (auth: ${config.AUTH_MODE})\n`);
  const cases = loadCases();
  const photo = async (file: string) => readCaseImage(cases.find((c) => c.file === file)!);
  const [realBin, realBin2, bucket] = await Promise.all([photo("bin-street.jpg"), photo("bin-wet-dry-india.jpg"), photo("not-plastic-bucket.jpg")]);

  const { user, admin } = await tokens();
  const me = await call("/me", user);
  const adminMe = await call("/me", admin);
  const quotaBefore = (await call("/me/quota", user)).data;
  // A random spot in the Gulf of Guinea, so the 15 m duplicate rule can't hit a real bin
  const spot = { latitude: 0.2 + Math.random() * 0.6, longitude: 0.2 + Math.random() * 0.6 };
  let binId: string | null = null;

  try {
    // 1. Who you are
    let r = await call("/me", null);
    check("No login → refused", r.status === 401, `${r.status}`);

    // 2. What you can upload
    for (const type of ["text/html", "application/pdf", "image/gif"]) {
      r = await call(`/dustbins/upload-url?contentType=${encodeURIComponent(type)}`, user);
      check(`Upload link for ${type} → refused`, r.status === 400, `${r.status} ${r.error?.code}`);
    }

    // 3. Whose photo it is
    const othersKey = await upload(admin, realBin);
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: othersKey, type: "DRY", ...spot } });
    check("Register with someone else's uploaded photo → refused", r.status === 403 && r.error?.code === "INVALID_IMAGE_KEY", `${r.status} ${r.error?.code}`);

    r = await call("/dustbins", user, { method: "POST", body: { imageKey: `dustbins/${me.data.id}/never-uploaded.jpg`, type: "DRY", ...spot } });
    check("Register with a photo that was never uploaded → refused", r.status === 404 && r.error?.code === "INVALID_IMAGE_KEY", `${r.status} ${r.error?.code}`);

    // 4. Whether it's really a photo
    const textKey = await upload(user, new TextEncoder().encode("definitely a dustbin, trust me"), "image/jpeg");
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: textKey, type: "DRY", ...spot } });
    check("Text file disguised as a JPEG → refused", r.status === 400 && r.error?.code === "UNSUPPORTED_MEDIA", `${r.status} ${r.error?.message}`);
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: textKey, type: "DRY", ...spot } });
    check("  …and it was deleted (can't be retried)", r.status === 404, `${r.status} ${r.error?.code}`);

    // 5. Whether the AI sees a dustbin
    const bucketKey = await upload(user, bucket);
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: bucketKey, type: "DRY", ...spot } });
    check("Photo of a plastic bucket → rejected by the AI", r.status === 422 && r.error?.code === "NOT_A_BIN", `${r.status} ${r.error?.code}`);
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: bucketKey, type: "DRY", ...spot } });
    check("  …and the photo was deleted", r.status === 404, `${r.status} ${r.error?.code}`);

    // 6. A real bin goes through
    const binKey = await upload(user, realBin);
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: binKey, type: "DRY", name: "anti-fake test bin", ...spot } });
    check("Real dustbin photo → accepted", r.status === 201, `${r.status} ${r.error?.message ?? ""}`);
    binId = r.data?.id ?? null;

    // 7. The same bin twice
    const dupKey = await upload(user, realBin2);
    const fiveMetresAway = { latitude: spot.latitude + 0.000045, longitude: spot.longitude };
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: dupKey, type: "WET", ...fiveMetresAway } });
    check("Another bin 5 m away → refused as a duplicate", r.status === 409 && r.error?.details?.existingBinId === binId, `${r.status} ${r.error?.code}`);

    // 8. Bad data
    r = await call("/dustbins", user, { method: "POST", body: { imageKey: dupKey, type: "DRY", latitude: 123, longitude: 77 } });
    check("Impossible coordinates (latitude 123) → refused", r.status === 400 && r.error?.code === "VALIDATION_ERROR", `${r.status} ${r.error?.message}`);

    // 9. Reporting a bin you're not near
    if (binId) {
      r = await call(`/dustbins/${binId}/report-missing`, user, { method: "POST", body: { lat: spot.latitude + 0.009, lng: spot.longitude } });
      check("Report it missing from 1 km away → refused", r.status === 403 && r.error?.code === "TOO_FAR", `${r.status} ${r.error?.code}`);
    }

    // 10. Only the real registration counted against the monthly limit
    const quotaAfter = (await call("/me/quota", user)).data;
    const used = quotaBefore.remaining.registrations - quotaAfter.remaining.registrations;
    check("Monthly limit: only the 1 accepted bin was counted (rejections are free)", used === 1, `${used} used, ${quotaAfter.remaining.registrations}/${quotaAfter.limits.registrations} left`);
  } finally {
    if (binId) await call(`/admin/bins/${binId}`, admin, { method: "DELETE" });
    await cleanup([me.data?.id, adminMe.data?.id].filter(Boolean));
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  // Exit explicitly: the database pool used for cleanup would keep Node running
  process.exit(passed === results.length ? 0 : 1);
}

// Leftover uploads (the photo used for the "someone else's photo" and duplicate checks) and test users
async function cleanup(userIds: string[]) {
  if (config.STORAGE_MODE === "s3") {
    const s3 = new S3Client({ region: config.AWS_REGION });
    for (const id of userIds) {
      const list = await s3.send(new ListObjectsV2Command({ Bucket: config.S3_BUCKET_NAME, Prefix: `dustbins/${id}/` }));
      if (list.Contents?.length) {
        await s3.send(new DeleteObjectsCommand({ Bucket: config.S3_BUCKET_NAME, Delete: { Objects: list.Contents.map((o) => ({ Key: o.Key! })) } }));
      }
    }
  }
  for (const email of created) {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: config.COGNITO_USER_POOL_ID, Username: email })).catch(() => undefined);
  }
  // The API keeps the test users' rows and the bin's history; tidy them only on a local database
  if (/localhost|127\.0\.0\.1/.test(API)) {
    const { getDb, sql } = await import("@smartbin/db");
    const db = getDb();
    for (const id of userIds) {
      await db.execute(sql`delete from bin_events where user_id = ${id}`);
      await db.execute(sql`delete from user_monthly_usage where user_id = ${id}`);
      await db.execute(sql`delete from users where id = ${id} and (email like 'smartbin-antifake-%' or email like 'antifake-%')`);
    }
  } else {
    console.log("\nNote: the two test users and the test bin's history stay in the deployed database.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
