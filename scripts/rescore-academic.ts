import "dotenv/config";
import { rescoreAcademicCriteria } from "../src/lib/criteria/rescore";

/**
 * Re-evaluate academic standing on every submitted application:
 * `npm run db:rescore-academic`. Runs on every start as well, and is safe to
 * repeat, because it only re-reads what each student submitted.
 */
async function main() {
  const result = await rescoreAcademicCriteria();
  console.log(`academic standing rescored: ${result.results} results across ${result.applications} applications`);
  process.exit(0);
}

main().catch((error) => {
  console.error("academic rescore failed", error);
  process.exit(1);
});
