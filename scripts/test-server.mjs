import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
process.loadEnvFile(".env");
fs.mkdirSync("work", { recursive: true });
const { PrismaClient } = await import("@prisma/client");
const admin = new PrismaClient();
const exists =
  await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname = 'meetmap_test'`;
if (!exists.length)
  await admin.$executeRawUnsafe('CREATE DATABASE "meetmap_test"');
await admin.$disconnect();
const testUrl = new URL(process.env.DATABASE_URL);
testUrl.pathname = "/meetmap_test";
const env = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  APP_URL: "http://localhost:3001",
  UPLOAD_DIR: "./work/test-uploads",
  NEXT_DIST_DIR: ".next-test",
  NEXT_TELEMETRY_DISABLED: "1",
};
const migration = spawnSync("npm", ["run", "db:migrate"], {
  env,
  stdio: "inherit",
});
if (migration.status) process.exit(migration.status);
if (!fs.existsSync("work/test-credentials.json"))
  fs.writeFileSync(
    "work/test-credentials.json",
    JSON.stringify({
      name: "Alex",
      email: "test-owner@meetmap.local",
      password: crypto.randomBytes(24).toString("hex"),
    }),
    { mode: 0o600 },
  );
const child = spawn("npm", ["run", "dev", "--", "--port", "3001"], {
  env,
  stdio: "inherit",
});
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
