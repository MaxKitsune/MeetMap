import { Prisma } from "@prisma/client";
import { db } from "./db";
import { attachmentSelect } from "./data";
import { saveImage, type ImageSaveOptions } from "./uploads";
import { metadataWarnings } from "./photo-metadata";
import { matchingPhotoTrips } from "./photo-matching";
import { ApiError } from "./security";

export async function photoTripSuggestions(ownerId: string, capturedAt: Date | null) {
  if (!capturedAt) return [];
  return matchingPhotoTrips(capturedAt, await db.trip.findMany({ where: { ownerId }, select: { id: true, title: true, startAt: true, endAt: true } }));
}

export async function importTravelImage(bytes: Buffer, name: string, ownerId: string, options: ImageSaveOptions) {
  const identity = options.sourceAssetId && options.source ? { ownerId_source_sourceAssetId: { ownerId, source: options.source, sourceAssetId: options.sourceAssetId } } : null;
  const existing = identity ? await db.attachment.findUnique({ where: identity, select: attachmentSelect }) : null;
  let duplicate = !!existing;
  let photo = existing;
  if (!photo) {
    try {
      const saved = await saveImage(bytes, name, ownerId, { ...options, extractMetadata: true, autoAssignTrip: true });
      photo = await db.attachment.findFirstOrThrow({ where: { id: saved.id, ownerId }, select: attachmentSelect });
    } catch (error) {
      // The database unique key is the final authority, including concurrent
      // imports. saveImage removes its own newly written files on failure.
      if (identity && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        photo = await db.attachment.findUnique({ where: identity, select: attachmentSelect });
        duplicate = !!photo;
      }
      if (!photo) throw error;
    }
  }
  const tripSuggestions = photo.tripId ? [] : await photoTripSuggestions(ownerId, photo.capturedAt);
  const warnings = metadataWarnings(photo);
  if (tripSuggestions.length > 1) warnings.push("Mehrere Reisen passen zum Datum. Bitte die Reise selbst auswählen.");
  return { name, photo, duplicate, warnings, tripSuggestions };
}

export function importError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return "Die Reise wurde parallel geändert. Bitte dieses Foto erneut importieren.";
  return "Dieses Foto konnte nicht importiert werden. Bitte erneut versuchen.";
}
