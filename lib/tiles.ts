import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { ApiError, boundedBody } from "./security";
export async function tile(z: number, x: number, y: number) {
  if (
    ![z, x, y].every(Number.isInteger) ||
    z < 0 ||
    z > 17 ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z
  )
    throw new ApiError(400, "Ungültige Kartenkachel.");
  const dir = path.join(env().UPLOAD_DIR, ".tiles");
  const file = path.join(dir, `${z}-${x}-${y}.png`);
  try {
    const info = await stat(file);
    if (info.mtimeMs > Date.now() - 7 * 86400000) return readFile(file);
  } catch {}
  const template =
    process.env.TILE_URL_TEMPLATE ||
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const url = template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
  if (!/^https?:\/\//.test(url))
    throw new ApiError(500, "Ungültige Tile-Konfiguration.");
  const r = await fetch(url, {
    headers: { "User-Agent": "MeetMap/1.0 private self-hosted map viewer" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok)
    throw new ApiError(
      502,
      "Kartendetails sind vorübergehend nicht erreichbar.",
    );
  const bytes = await boundedBody(
    new Request("http://localhost", {
      method: "POST",
      body: r.body,
      duplex: "half",
    } as RequestInit),
    2 * 1024 * 1024,
  );
  await mkdir(dir, { recursive: true });
  await writeFile(file, bytes);
  return Buffer.from(bytes);
}
