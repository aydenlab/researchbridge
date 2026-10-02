import "dotenv/config";
import { rescoreDeterministicCriteria } from "../src/lib/criteria/rescore";

/**
 * Re-evaluate every rule-based criterion on every submitted application:
 * `npm run db:rescore-criteria`. Runs on every start as well, and is safe to
 * repeat: it re-reads what each student submitted and only writes results that
 * changed.
 */
async function main() {
  const result = await rescoreDeterministicCriteria();
  console.log(
    `criteria rescored: ${result.changed} of ${result.evaluated} results changed across ${result.applications} applications`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("criteria rescore failed", error);
  process.exit(1);
});
