import { getDb, evalRuns, photoChecks, eq, and, desc, gte, sql, count } from "@smartbin/db";
import { checkDustbinImage } from "../../common/ai/vision.js";
import { config } from "../../common/config/config.js";
import { ApiError } from "../../common/http/ApiError.js";
import { deleteImageObject, getImageObject, userImagePrefix } from "../../common/storage/s3.js";
import { loadCases, readCaseImage, type EvalCase } from "./dataset.js";

export interface EvalResult {
  file: string;
  image: string;
  expect: EvalCase["expect"];
  hard: boolean;
  note: string;
  source: string;
  author: string;
  licence: string;
  accepted: boolean;
  confidence: number;
  reason: string;
  ms: number;
  correct: boolean;
}

export interface EvalSummary {
  total: number;
  correct: number;
  accuracy: number;
  fakes: { total: number; rejected: number };
  realBins: { total: number; accepted: number };
  hard: { total: number; correct: number };
  // Rows: what the photo really is. Columns: what the AI decided.
  matrix: { binAccepted: number; binRejected: number; fakeAccepted: number; fakeRejected: number };
  avgMs: number;
  // The bar a run must clear: no fake accepted and no clear (non-hard) dustbin rejected
  passed: boolean;
}

const CONCURRENCY = 5;
const TRY_LIMIT_PER_DAY = 20;

function modelName(): string {
  return config.VISION_PROVIDER === "openai" ? config.OPENAI_MODEL : config.VISION_PROVIDER === "bedrock" ? config.BEDROCK_MODEL_ID : "off";
}

function summarize(results: EvalResult[]): EvalSummary {
  const fakes = results.filter((r) => r.expect === "not-bin");
  const bins = results.filter((r) => r.expect === "bin");
  const clearBins = bins.filter((r) => !r.hard);
  const hard = results.filter((r) => r.hard);
  const correct = results.filter((r) => r.correct).length;
  const fakeAccepted = fakes.filter((r) => r.accepted).length;
  return {
    total: results.length,
    correct,
    accuracy: results.length ? correct / results.length : 0,
    fakes: { total: fakes.length, rejected: fakes.length - fakeAccepted },
    realBins: { total: clearBins.length, accepted: clearBins.filter((r) => r.accepted).length },
    hard: { total: hard.length, correct: hard.filter((r) => r.correct).length },
    matrix: {
      binAccepted: bins.filter((r) => r.accepted).length,
      binRejected: bins.filter((r) => !r.accepted).length,
      fakeAccepted,
      fakeRejected: fakes.length - fakeAccepted,
    },
    avgMs: results.length ? Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length) : 0,
    passed: fakeAccepted === 0 && clearBins.every((r) => r.accepted),
  };
}

// Runs every labelled photo through the same check the API uses for new bins, and saves the run
export async function runVisionEval(triggeredBy: string | null) {
  const cases = loadCases();
  const started = Date.now();
  const results: EvalResult[] = [];

  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      cases.slice(i, i + CONCURRENCY).map(async (c): Promise<EvalResult> => {
        const t0 = Date.now();
        const check = await checkDustbinImage(readCaseImage(c), "image/jpeg");
        return {
          file: c.file,
          image: c.image,
          expect: c.expect,
          hard: c.hard ?? false,
          note: c.note,
          source: c.source,
          author: c.author,
          licence: c.licence,
          accepted: check.accepted,
          confidence: check.confidence,
          reason: check.reason,
          ms: Date.now() - t0,
          correct: check.accepted === (c.expect === "bin"),
        };
      })
    );
    results.push(...batch);
  }

  const summary = summarize(results);
  const [run] = await getDb()
    .insert(evalRuns)
    .values({
      kind: "vision",
      provider: config.VISION_PROVIDER,
      model: modelName(),
      triggeredBy,
      durationMs: Date.now() - started,
      summary,
      results,
    })
    .returning();
  return run!;
}

// Public: the latest run plus how many photos people have tried themselves
export async function getLatestVisionEval() {
  const db = getDb();
  const [[latest], [runs], [tries]] = await Promise.all([
    db.select().from(evalRuns).where(eq(evalRuns.kind, "vision")).orderBy(desc(evalRuns.createdAt)).limit(1),
    db.select({ total: count() }).from(evalRuns).where(eq(evalRuns.kind, "vision")),
    db
      .select({
        total: count(),
        accepted: sql<number>`count(*) filter (where ${photoChecks.accepted})`.mapWith(Number),
      })
      .from(photoChecks),
  ]);

  return {
    latest: latest
      ? {
          id: latest.id,
          provider: latest.provider,
          model: latest.model,
          durationMs: latest.durationMs,
          createdAt: latest.createdAt,
          summary: latest.summary as EvalSummary,
          results: latest.results as EvalResult[],
        }
      : null,
    runs: runs!.total,
    tries: { total: tries!.total, accepted: tries!.accepted, limitPerDay: TRY_LIMIT_PER_DAY },
    currentModel: { provider: config.VISION_PROVIDER, model: modelName() },
  };
}

// "Try your own photo": check an uploaded photo without creating a bin, then delete it
export async function tryOwnPhoto(userId: string, imageKey: string) {
  if (!imageKey.startsWith(userImagePrefix(userId))) {
    throw ApiError.forbidden("This image key does not belong to you.", "INVALID_IMAGE_KEY");
  }

  const db = getDb();
  const [used] = await db
    .select({ n: count() })
    .from(photoChecks)
    .where(and(eq(photoChecks.userId, userId), gte(photoChecks.createdAt, sql`now() - interval '24 hours'`)));
  if (used!.n >= TRY_LIMIT_PER_DAY) {
    await deleteImageObject(imageKey);
    throw ApiError.tooManyRequests(`You've used all ${TRY_LIMIT_PER_DAY} photo checks for today. Try again tomorrow.`, "QUOTA_EXCEEDED");
  }

  try {
    const image = await getImageObject(imageKey);
    const t0 = Date.now();
    const check = await checkDustbinImage(image.bytes, image.contentType);
    await db.insert(photoChecks).values({ userId, accepted: check.accepted, confidence: check.confidence, reason: check.reason });
    return {
      accepted: check.accepted,
      confidence: check.confidence,
      reason: check.reason,
      ms: Date.now() - t0,
      triesLeft: TRY_LIMIT_PER_DAY - used!.n - 1,
    };
  } finally {
    // The photo is only for this check; never kept
    await deleteImageObject(imageKey);
  }
}
