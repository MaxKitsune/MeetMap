import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
// CI supplies its own environment; never load a developer's credentials there.
if (!process.env.CI && fs.existsSync(".env")) process.loadEnvFile(".env");
const testUrl = new URL(process.env.DATABASE_URL);
if (
  testUrl.protocol !== "postgresql:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(testUrl.hostname) ||
  testUrl.search ||
  (process.env.CI && testUrl.pathname !== "/meetmap_test")
) {
  throw new Error(
    "Tests require a loopback PostgreSQL URL without query parameters; CI must use /meetmap_test.",
  );
}
testUrl.pathname = "/meetmap_test";
if (!process.env.CI) {
  // Use the maintenance database, never the personal database in DATABASE_URL.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const { PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl.toString() } },
  });
  try {
    const exists =
      await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname = 'meetmap_test'`;
    if (!exists.length)
      await admin.$executeRawUnsafe('CREATE DATABASE "meetmap_test"');
  } finally {
    await admin.$disconnect();
  }
}
fs.mkdirSync("work", { recursive: true });
const env = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  APP_URL: "http://localhost:3001",
  UPLOAD_DIR: "./work/test-uploads",
  NEXT_DIST_DIR: ".next-test",
  NEXT_TELEMETRY_DISABLED: "1",
};
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env, stdio: "inherit", timeout: 120_000 },
);
if (migration.error || migration.signal || migration.status !== 0) {
  console.error(
    "Test database migration failed.",
    migration.error?.message || migration.signal || "",
  );
  process.exit(migration.status || 1);
}
if (process.env.CI || !fs.existsSync("work/test-credentials.json"))
  fs.writeFileSync(
    "work/test-credentials.json",
    JSON.stringify({
      name: "Alex",
      email: "test-owner@meetmap.local",
      password: crypto.randomBytes(24).toString("hex"),
    }),
    { mode: 0o600 },
  );
// Spawn Next directly so its exit status and signals reach the caller.
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "localhost", "--port", "3001"],
  { env, stdio: "inherit" },
);
child.on("error", (error) => {
  console.error("Test server failed to start:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
