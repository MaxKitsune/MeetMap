import { z } from "zod";
import { ApiError } from "./security";
import { photoCoordinates, photoDate } from "./photo-metadata";

export const immichAssetId = z.uuid();
export function immichConfig() {
  const value = process.env.IMMICH_URL?.trim();
  const key = process.env.IMMICH_API_KEY?.trim();
  if (!value && !key) return null;
  if (!value || !key) throw new ApiError(503, "Bitte IMMICH_URL und IMMICH_API_KEY auf dem Server vollständig konfigurieren.");
  let base: URL;
  try { base = new URL(value); } catch { throw new ApiError(503, "Die Immich-Serveradresse ist ungültig."); }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new ApiError(503, "Die Immich-Serveradresse muss eine HTTP(S)-Adresse ohne Zugangsdaten oder Suchparameter sein.");
  base.pathname = base.pathname.replace(/\/+$/, "").replace(/\/api$/, "") + "/api/";
  return { base, key };
}

async function immichRequest(endpoint: string, limit: number, payload?: unknown) {
  const config = immichConfig();
  if (!config) throw new ApiError(503, "Immich ist noch nicht eingerichtet.");
  // Only server-configured targets and code-generated paths are accepted.
  // Never follow redirects with the API key, even to the same origin.
  const url = new URL(endpoint, config.base);
  if (url.origin !== config.base.origin || !url.pathname.startsWith(config.base.pathname)) throw new ApiError(400, "Ungültiger Immich-Pfad.");
  try {
    const response = await fetch(url, {
      method: payload === undefined ? "GET" : "POST", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { "x-api-key": config.key, Accept: "application/json", ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if ([401, 403].includes(response.status)) throw new ApiError(502, "Immich verweigert den Zugriff. Bitte API-Schlüssel und Rechte asset.read / asset.download prüfen.");
      if (response.status >= 300 && response.status < 400) throw new ApiError(502, "Immich leitet die Anfrage um. Bitte die endgültige Serveradresse konfigurieren.");
      if (response.status === 404) throw new ApiError(404, "Immich-Foto oder API-Endpunkt nicht gefunden.");
      throw new ApiError(502, "Immich konnte die Anfrage nicht verarbeiten.");
    }
    if (Number(response.headers.get("content-length") || 0) > limit) { await response.body?.cancel(); throw new ApiError(413, "Die Immich-Datei oder Antwort ist zu groß (Bilder maximal 12 MB)."); }
    const reader = response.body?.getReader();
    if (!reader) throw new ApiError(502, "Immich hat eine leere Antwort gesendet.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ApiError(413, "Die Immich-Datei oder Antwort ist zu groß (Bilder maximal 12 MB)."); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Immich ist nicht erreichbar oder hat nicht rechtzeitig geantwortet.");
  }
}

async function immichJson(endpoint: string, payload?: unknown): Promise<unknown> {
  const bytes = await immichRequest(endpoint, 4 * 1024 * 1024, payload);
  try { return JSON.parse(bytes.toString("utf8")); } catch { throw new ApiError(502, "Immich hat eine ungültige Antwort gesendet."); }
}

const assetSchema = z.object({
  id: immichAssetId, type: z.string(), originalFileName: z.string().max(2000),
  localDateTime: z.string().nullish(), fileCreatedAt: z.string().nullish(), isTrashed: z.boolean().optional(),
  exifInfo: z.object({ dateTimeOriginal: z.string().nullish(), latitude: z.number().nullish(), longitude: z.number().nullish(), fileSizeInByte: z.number().nullish() }).nullish(),
  people: z.array(z.object({ name: z.string().max(2000) })).max(1000).optional(),
});
export function immichAssetPreview(raw: unknown) {
  const asset = assetSchema.parse(raw);
  return {
    id: asset.id, name: asset.originalFileName.slice(0, 200),
    capturedAt: photoDate(asset.exifInfo?.dateTimeOriginal) ?? photoDate(asset.fileCreatedAt) ?? photoDate(asset.localDateTime),
    ...photoCoordinates(asset.exifInfo?.latitude, asset.exifInfo?.longitude),
    people: [...new Set((asset.people || []).map(p => p.name.trim().slice(0, 200)).filter(Boolean))].slice(0, 100),
    type: asset.type, isTrashed: asset.isTrashed === true,
  };
}

export async function immichStatus() {
  let configured = false;
  try {
    configured = !!(process.env.IMMICH_URL?.trim() || process.env.IMMICH_API_KEY?.trim());
    if (!immichConfig()) return { configured: false, connected: false, status: "not-configured", message: "Optional: IMMICH_URL und IMMICH_API_KEY auf dem Server setzen." };
    await immichJson("search/metadata", { type: "IMAGE", size: 1, page: 1, withDeleted: false });
    return { configured: true, connected: true, status: "connected" };
  } catch (error) {
    return { configured, connected: false, status: "unavailable", message: error instanceof ApiError ? error.message : "Die Immich-Verbindung konnte nicht geprüft werden." };
  }
}

export async function searchImmichPhotos(start: Date, end: Date, page: number, size: number) {
  // The documented flat/page API remains supported in Immich 2.x and 3.x.
  // Immich 3.2 adds cursor/filter APIs; keeping page supports existing servers.
  const raw = await immichJson("search/metadata", { type: "IMAGE", takenAfter: start.toISOString(), takenBefore: end.toISOString(), order: "asc", page, size, withExif: true, withPeople: true, withDeleted: false });
  const response = z.object({ assets: z.object({ items: z.array(z.unknown()).max(1000), nextPage: z.union([z.string(), z.number()]).nullish() }) }).safeParse(raw);
  if (!response.success) throw new ApiError(502, "Die Immich-Version liefert ein nicht unterstütztes Suchformat.");
  let assets;
  try { assets = response.data.assets.items.map(immichAssetPreview).filter(a => a.type === "IMAGE" && !a.isTrashed); }
  catch { throw new ApiError(502, "Die Immich-Version liefert nicht unterstützte Fotodaten."); }
  const next = Number(response.data.assets.nextPage);
  return { assets: assets.slice(0, size), nextPage: response.data.assets.nextPage != null && Number.isInteger(next) && next > page && next <= 10000 ? next : null };
}

export async function downloadImmichPhoto(id: string) {
  immichAssetId.parse(id);
  let asset;
  try { asset = immichAssetPreview(await immichJson(`assets/${id}`)); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(502, "Immich liefert nicht unterstützte Fotodaten."); }
  if (asset.type !== "IMAGE" || asset.isTrashed) throw new ApiError(400, "Nur vorhandene Bilder können importiert werden.");
  const bytes = await immichRequest(`assets/${id}/original`, 12 * 1024 * 1024);
  return { asset, bytes };
}
