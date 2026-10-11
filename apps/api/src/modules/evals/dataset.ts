import { readFileSync } from "node:fs";
import path from "node:path";

export interface EvalCase {
  file: string;
  expect: "bin" | "not-bin";
  hard?: boolean;
  note: string;
  source: string;
  author: string;
  licence: string;
  /** Path on the web app, e.g. /evals/bin-street.jpg */
  image: string;
}

// The photos live in the web app's public folder so the /evals page and the API use the same files.
// The API runs from apps/api (dev and pm2), so the default is the sibling web app.
const IMAGES_DIR = process.env.EVAL_IMAGES_DIR ?? path.resolve(process.cwd(), "../web/public/evals");

let cases: EvalCase[] | undefined;

export function loadCases(): EvalCase[] {
  cases ??= JSON.parse(readFileSync(path.join(__dirname, "vision-cases.json"), "utf8")).cases as EvalCase[];
  return cases;
}

export function readCaseImage(c: EvalCase): Uint8Array {
  return new Uint8Array(readFileSync(path.join(IMAGES_DIR, c.file)));
}
