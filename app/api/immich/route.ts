import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachmentSelect } from "@/lib/data";
import { ApiError, checkOrigin, jsonBody, rateLimit, requireOwner } from "@/lib/security";
import { photoReply, photoFailure } from "@/lib/photo-api";
import { photoDate, metadataWarnings } from "@/lib/photo-metadata";
import { importError, importTravelImage, photoTripSuggestions } from "@/lib/photo-import";
import { downloadImmichPhoto, immichAssetId, immichStatus, searchImmichPhotos } from "@/lib/immich";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { id: ownerId } = await requireOwner();
    await rateLimit("immich-read-" + ownerId, 200);
    const query = request.nextUrl.searchParams;
    if (!query.has("start") && !query.has("end")) return photoReply(await immichStatus());
    const startText = query.get("start") || "";
    const endText = query.get("end") || "";
    const start = photoDate(startText), end = photoDate(endText);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startText) || !/^\d{4}-\d{2}-\d{2}$/.test(endText) || !start || !end || end < start || end.getTime() - start.getTime() > 366 * 86400000) throw new ApiError(400, "Bitte einen gültigen Zeitraum von maximal einem Jahr auswählen.");
    end.setUTCHours(23, 59, 59, 999);
    const page = z.coerce.number().int().min(1).max(10000).parse(query.get("page") || 1);
    const size = z.coerce.number().int().min(1).max(100).parse(query.get("size") || 30);
    const result = await searchImmichPhotos(start, end, page, size);
    const imported = new Set((await db.attachment.findMany({ where: { ownerId, source: "immich", sourceAssetId: { in: result.assets.map(a => a.id) } }, select: { sourceAssetId: true } })).map(a => a.sourceAssetId));
    return photoReply({ configured: true, connected: true, assets: result.assets.map(({ type: _type, isTrashed: _trashed, ...a }) => ({ ...a, imported: imported.has(a.id) })), nextPage: result.nextPage });
  } catch (error) { return photoFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const { id: ownerId } = await requireOwner();
    await rateLimit("immich-import-" + ownerId, 100);
    const values = z.object({ assetIds: z.array(immichAssetId).min(1).max(10), tripId: z.string().min(1).max(100).optional() }).strict().parse(await jsonBody(request));
    if (values.tripId && !await db.trip.findFirst({ where: { id: values.tripId, ownerId }, select: { id: true } })) throw new ApiError(404, "Reise nicht gefunden.");
    const results = [];
    const errors: { name: string; error: string }[] = [];
    for (const id of [...new Set(values.assetIds)]) {
      try {
        const existing = await db.attachment.findUnique({ where: { ownerId_source_sourceAssetId: { ownerId, source: "immich", sourceAssetId: id } }, select: attachmentSelect });
        if (existing) {
          results.push({ name: existing.name, photo: existing, duplicate: true, warnings: metadataWarnings(existing), tripSuggestions: existing.tripId ? [] : await photoTripSuggestions(ownerId, existing.capturedAt) });
          continue;
        }
        const { asset, bytes } = await downloadImmichPhoto(id);
        results.push(await importTravelImage(bytes, asset.name, ownerId, { source: "immich", sourceAssetId: id, sourcePeople: asset.people, tripId: values.tripId, fallbackMetadata: { capturedAt: asset.capturedAt, latitude: asset.latitude, longitude: asset.longitude } }));
      } catch (error) { errors.push({ name: id, error: importError(error) }); }
    }
    return photoReply({ photos: results.map(r => r.photo), results, errors, ...(results.length ? {} : { error: errors.map(e => `${e.name}: ${e.error}`).join(" ") }) }, results.length ? 201 : 422);
  } catch (error) { return photoFailure(error); }
}
