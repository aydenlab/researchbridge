import "dotenv/config";
import { runWeeklyDigest } from "../src/lib/notifications/digest";

/**
 * Run the weekly roll-up by hand: `npm run digest:weekly`.
 *
 * Useful for testing against the console email provider, and as the thing a
 * platform scheduler runs if hitting the HTTP endpoint is inconvenient.
 */
async function main() {
  const result = await runWeeklyDigest();
  console.log(
    `weekly digest sent: ${result.researchersNotified} researchers, ${result.studentsNotified} students, ${result.failures} failures`,
  );
  process.exit(result.failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("weekly digest failed", error);
  process.exit(1);
});
