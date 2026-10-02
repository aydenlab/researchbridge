import "dotenv/config";
import { refreshStaleEvidence } from "../src/lib/evidence/refresh";

/**
 * Read every student's resume and research history that has not been read, or
 * has changed: `npm run db:refresh-evidence`. On start this runs without the
 * model so a deploy is never held up; pass --model to include the model
 * reading, which the server otherwise catches up on an hour at a time.
 */
async function main() {
  const useModel = process.argv.includes("--model");
  const result = await refreshStaleEvidence({ useModel, limit: 5000 });
  console.log(
    `evidence refreshed: ${result.updated} of ${result.candidates} students${useModel ? `, ${result.modelCalls} model calls` : ""}`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("evidence refresh failed", error);
  process.exit(1);
});
