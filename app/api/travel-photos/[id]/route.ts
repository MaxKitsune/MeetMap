import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { attachmentSelect } from "@/lib/data";
import { ApiError, checkOrigin, jsonBody, requireOwner } from "@/lib/security";
import { photoReply, photoFailure, photoMetadataSchema } from "@/lib/photo-api";
import { matchingPhotoTrips } from "@/lib/photo-matching";
import { photoTripSuggestions } from "@/lib/photo-import";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { id: ownerId } = await requireOwner();
    const { id } = await context.params;
    const patch = photoMetadataSchema.parse(await jsonBody(request));
    const photo = await db.$transaction(async tx => {
      const existing = await tx.attachment.findFirst({ where: { id, ownerId } });
      if (!existing) throw new ApiError(404, "Foto nicht gefunden.");
      const capturedAt = patch.capturedAt === undefined ? existing.capturedAt : patch.capturedAt;
      const tripId = patch.tripId === undefined ? existing.tripId : patch.tripId;
      if (existing.memoryId && patch.tripId !== undefined && patch.tripId !== existing.tripId) {
        const memory = await tx.memory.findFirst({ where: { id: existing.memoryId, ownerId }, select: { tripId: true } });
        if (memory && memory.tripId !== tripId) throw new ApiError(409, "Dieses Foto gehört zu einer Erinnerung. Bitte zuerst deren Reisezuordnung bearbeiten oder das Foto dort lösen.");
      }
      if (tripId) {
        const trip = await tx.trip.findFirst({ where: { id: tripId, ownerId } });
        if (!trip) throw new ApiError(404, "Reise nicht gefunden.");
        if (capturedAt && !matchingPhotoTrips(capturedAt, [trip]).length) throw new ApiError(400, "Das Aufnahmedatum liegt außerhalb der Reise. Bitte zuerst die Zuordnung lösen oder eine passende Reise wählen.");
      }
      return tx.attachment.update({ where: { id, ownerId }, data: patch, select: attachmentSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return photoReply({ photo, tripSuggestions: photo.tripId ? [] : await photoTripSuggestions(ownerId, photo.capturedAt) });
  } catch (error) { return photoFailure(error); }
}
