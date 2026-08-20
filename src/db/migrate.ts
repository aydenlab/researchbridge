import "dotenv/config";
import path from "node:path";
import { db, activeDriver } from "./index";

async function main() {
  const folder = path.join(process.cwd(), "drizzle");
  if (activeDriver() === "postgres") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as never, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: folder });
  }
  console.log(`migrations applied via ${activeDriver()}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("migration failed", error);
  process.exit(1);
});
