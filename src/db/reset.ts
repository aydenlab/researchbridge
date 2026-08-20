import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`create schema public`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  console.log("schema reset");
  process.exit(0);
}

main().catch((error) => {
  console.error("reset failed", error);
  process.exit(1);
});
