import { spawn } from "node:child_process";
import "dotenv/config";

function log(event, fields = {}) {
  console.log(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...fields }));
}

function warn(event, fields = {}) {
  console.warn(JSON.stringify({ level: "warn", event, ts: new Date().toISOString(), ...fields }));
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

log("startup_configuration", {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.APP_URL ?? "(not set)",
  port: process.env.PORT ?? "3000",
  databaseConfigured,
  adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS?.trim()),
  anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  emailProvider: process.env.EMAIL_PROVIDER ?? "console",
});

if (!databaseConfigured) {
  warn("startup_database_missing", {
    message:
      "DATABASE_URL is not set. On Railway, open this service, go to Variables, and add DATABASE_URL = ${{Postgres.DATABASE_URL}} using the name of your database service. The site will start but every page that reads data will fail.",
  });
} else {
  log("startup_migrations_begin");
  const code = await run("npx", ["tsx", "src/db/migrate.ts"]);
  if (code === 0) {
    log("startup_migrations_complete");
  } else {
    warn("startup_migrations_failed", {
      exitCode: code,
      message:
        "Migrations did not apply. The server is starting anyway so the logs and /api/ready remain reachable, but data pages will fail until this is resolved.",
    });
  }
}

if (databaseConfigured && process.env.DEMO_CONTENT_ENABLED === "true") {
  log("startup_demo_content_begin");
  const demoCode = await run("npx", ["tsx", "scripts/demo-content.ts"]);
  if (demoCode === 0) {
    log("startup_demo_content_complete");
  } else {
    warn("startup_demo_content_failed", {
      exitCode: demoCode,
      message: "Demo content did not load. This never blocks startup and never affects real data.",
    });
  }
}

const server = spawn("npx", ["next", "start"], { stdio: "inherit", shell: process.platform === "win32" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("close", (code) => process.exit(code ?? 0));
server.on("error", (error) => {
  warn("startup_server_failed", { message: String(error) });
  process.exit(1);
});
