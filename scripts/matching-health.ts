import "dotenv/config";
import { matchingHealth } from "../src/lib/criteria/rerun";

/** Report anything matching has left out of date: `npm run db:matching-health`. */
async function main() {
  console.log(JSON.stringify(await matchingHealth(), null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("matching health check failed", error);
  process.exit(1);
});
