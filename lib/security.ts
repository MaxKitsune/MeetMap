import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "./db";
import { env } from "./env";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function checkOrigin(request: Request, expected = env().origin) {
  if (request.headers.get("origin") !== expected)
    throw new ApiError(
      403,
      "Diese Anfrage stammt nicht von deinem MeetMap-Server.",
    );
}
export async function owner() {
  const token = (await cookies()).get("meetmap_session")?.value;
  if (!token || !/^[-a-f0-9]{64}$/.test(token)) return null;
  const s = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return s && s.expiresAt > new Date() ? s.user : null;
}
export async function requireOwner() {
  const user = await owner();
  if (!user) throw new ApiError(401, "Bitte melde dich an.");
  return user;
}
export function newSession() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    id: digest(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  };
}
export function sessionResponse(token: string, expiresAt: Date) {
  const r = NextResponse.json({ ok: true });
  r.cookies.set("meetmap_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: env().secure,
    path: "/",
    expires: expiresAt,
  });
  r.headers.set("Cache-Control", "no-store");
  return r;
}
export async function rateLimit(key: string, limit = 12) {
  const now = new Date();
  const result = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "AuthAttempt" ("key","count","windowStart") VALUES (${key},1,${now}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "AuthAttempt"."windowStart" < ${new Date(Date.now() - 900000)} THEN 1 ELSE "AuthAttempt"."count" + 1 END, "windowStart" = CASE WHEN "AuthAttempt"."windowStart" < ${new Date(Date.now() - 900000)} THEN ${now} ELSE "AuthAttempt"."windowStart" END RETURNING "count"`;
  if (result[0].count > limit)
    throw new ApiError(429, "Zu viele Versuche. Bitte warte 15 Minuten.");
}
export async function boundedBody(request: Request, limit = 200_000) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new ApiError(413, "Die Datei oder Anfrage ist zu groß.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new ApiError(413, "Die Datei oder Anfrage ist zu groß.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse(Buffer.from(await boundedBody(request)).toString());
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Ungültige Anfrage.");
  }
}
