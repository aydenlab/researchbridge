import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";

(process.env as Record<string, string>).NODE_ENV = "test";
process.env.SESSION_SECRET = "researchbridge_test_secret_value_0123456789";
process.env.EMAIL_PROVIDER = "console";
delete process.env.DATABASE_URL;
delete process.env.ANTHROPIC_API_KEY;

const client = new PGlite();
const db = drizzle(client, { schema });

await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });

(globalThis as Record<string, unknown>).__rbDb = db;
(globalThis as Record<string, unknown>).__rbDriver = "pglite";
(globalThis as Record<string, unknown>).__rbTestClient = client;
