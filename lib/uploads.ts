import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { env } from "./env";
import { ApiError } from "./security";
import { db } from "./db";
import { Prisma } from "@prisma/client";
import { extractPhotoMetadata, type PhotoMetadata } from "./photo-metadata";
import { matchingPhotoTrips } from "./photo-matching";

export type ImageSaveOptions = {
  extractMetadata?: boolean;
  fallbackMetadata?: Partial<PhotoMetadata>;
  source?: "travel-upload" | "immich";
  sourceAssetId?: string;
  sourcePeople?: string[];
  tripId?: string | null;
  autoAssignTrip?: boolean;
};

export async function saveImage(bytes: Buffer, name: string, ownerId: string, options: ImageSaveOptions = {}) {
  if (bytes.length > 12 * 1024 * 1024)
    throw new ApiError(413, "Bilder dürfen höchstens 12 MB groß sein.");
  const type = await fileTypeFromBuffer(bytes);
  if (
    !type ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type.mime)
  )
    throw new ApiError(
      415,
      "Bitte ein JPEG-, PNG-, WebP- oder AVIF-Bild auswählen.",
    );
  let result;
  try {
    result = await sharp(bytes, {
      limitInputPixels: 40_000_000,
      animated: false,
    })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ApiError(415, "Das Bild ist beschädigt oder hat zu viele Pixel.");
  }
  // Decode first. Metadata is only read for an explicitly requested travel
  // import; the ordinary upload endpoint retains its previous behaviour.
  const extracted = options.extractMetadata ? await extractPhotoMetadata(bytes) : null;
  const metadata = extracted ? {
    capturedAt: extracted.capturedAt ?? options.fallbackMetadata?.capturedAt ?? null,
    latitude: extracted.latitude ?? options.fallbackMetadata?.latitude ?? null,
    longitude: extracted.longitude ?? options.fallbackMetadata?.longitude ?? null,
  } : null;
  const storageKey = randomUUID() + ".webp";
  const dir = env().UPLOAD_DIR;
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(path.join(dir, storageKey), result.data, { mode: 0o600 });
    await writeFile(
      path.join(dir, "thumb-" + storageKey),
      await sharp(result.data)
        .resize({
          width: 600,
          height: 500,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer(),
      { mode: 0o600 },
    );
    const data = {
        ownerId,
        storageKey,
        name: name.slice(0, 200),
        mime: "image/webp",
        size: result.data.length,
        hash: createHash("sha256").update(result.data).digest("hex"),
        width: result.info.width,
        height: result.info.height,
        ...(metadata || {}),
        ...(options.source ? { source: options.source } : {}),
        ...(options.sourceAssetId ? { sourceAssetId: options.sourceAssetId } : {}),
        sourcePeople: [...new Set(options.sourcePeople || [])].slice(0, 100),
    };
    if (!options.extractMetadata) return await db.attachment.create({ data });
    const createTravelImage = () => db.$transaction(async tx => {
      let tripId: string | null = null;
      if (options.tripId) {
        const trip = await tx.trip.findFirst({ where: { id: options.tripId, ownerId } });
        if (!trip) throw new ApiError(404, "Reise nicht gefunden.");
        if (metadata?.capturedAt && !matchingPhotoTrips(metadata.capturedAt, [trip]).length) throw new ApiError(400, "Das Aufnahmedatum liegt außerhalb der gewählten Reise.");
        tripId = trip.id;
      } else if (options.autoAssignTrip && options.tripId !== null && metadata?.capturedAt) {
        const matches = matchingPhotoTrips(metadata.capturedAt, await tx.trip.findMany({ where: { ownerId } }));
        if (matches.length === 1) tripId = matches[0].id;
      }
      return tx.attachment.create({ data: { ...data, tripId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    for (let attempt = 0; ; attempt++) {
      try { return await createTravelImage(); }
      catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 2) throw error;
      }
    }
  } catch (e) {
    await removeImage(storageKey);
    throw e;
  }
}
export async function removeImage(key: string) {
  await Promise.allSettled([
    unlink(path.join(env().UPLOAD_DIR, key)),
    unlink(path.join(env().UPLOAD_DIR, "thumb-" + key)),
  ]);
}
export async function imageBytes(key: string, thumbnail: boolean) {
  return readFile(
    path.join(env().UPLOAD_DIR, (thumbnail ? "thumb-" : "") + key),
  );
}
