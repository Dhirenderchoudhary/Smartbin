// How well does the AI photo check tell dustbins from look-alikes?
//
//   npm run eval:vision
//
// Runs every labelled photo (src/modules/evals/vision-cases.json, images in apps/web/public/evals)
// through the same check the API uses for new bins, prints the verdict, confidence and reason, and
// saves the run so the public /evals page shows it. Fails (exit 1) if any non-dustbin is accepted or
// a clear dustbin is rejected; "hard" cases are reported only. About 2 cents with gpt-4.1-mini.
import { runVisionEval, type EvalResult, type EvalSummary } from "../src/modules/evals/service.js";

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

async function main() {
  console.log("\nRunning the dustbin photo check on the labelled test set…\n");
  const run = await runVisionEval(null);
  const results = run.results as EvalResult[];
  const s = run.summary as EvalSummary;

  console.log(`Model: ${run.provider} / ${run.model}\n`);
  console.log(`    ${pad("photo", 28)} ${pad("expected", 9)} ${pad("verdict", 9)} conf  reason`);
  for (const r of results) {
    const mark = r.correct ? "✔" : r.hard ? "~" : "✘";
    console.log(`${mark}   ${pad(r.file, 28)} ${pad(r.expect, 9)} ${pad(r.accepted ? "ACCEPT" : "REJECT", 9)} ${r.confidence.toFixed(2)}  ${r.reason}`);
  }

  console.log(`
Non-dustbins rejected  : ${s.fakes.rejected}/${s.fakes.total}   (fakes that got through: ${s.fakes.total - s.fakes.rejected})
Clear dustbins accepted: ${s.realBins.accepted}/${s.realBins.total}
Hard cases right       : ${s.hard.correct}/${s.hard.total}
Overall accuracy       : ${s.correct}/${s.total} (${Math.round(s.accuracy * 100)}%), average ${s.avgMs} ms per photo
Saved as run ${run.id} (shown on /evals)
${s.passed ? "PASS" : "FAIL: a non-dustbin got through or a clear dustbin was rejected."}`);
  process.exit(s.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
