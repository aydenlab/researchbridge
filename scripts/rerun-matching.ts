import "dotenv/config";
import { rerunAllMatching } from "../src/lib/criteria/rerun";

/**
 * Bring everything matching stores up to date for every student and every
 * application: `npm run db:rerun-matching`. Pass --no-model to skip the model
 * (resume readings and written-response analysis), or --limit N to re-run at
 * most N analyses. Safe to repeat: anything
 * whose inputs have not changed is left alone and costs nothing.
 */
async function main() {
  const useModel = !process.argv.includes("--no-model");
  const limitAt = process.argv.indexOf("--limit");
  const analysisLimit = limitAt >= 0 ? Number(process.argv[limitAt + 1]) : undefined;
  const result = await rerunAllMatching({ useModel, analysisLimit });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("matching rerun failed", error);
  process.exit(1);
});
