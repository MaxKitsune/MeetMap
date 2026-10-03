import { db } from "@/lib/db";
import { requireOwner } from "@/lib/security";
import { photoReply, photoFailure } from "@/lib/photo-api";
import { suggestPhotoTrips } from "@/lib/photo-matching";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { id: ownerId } = await requireOwner();
    const settings = await db.appSettings.findUniqueOrThrow({ where: { ownerId }, include: { homePlace: true } });
    if (!settings.homePlace || settings.homePlace.ownerId !== ownerId) return photoReply({ suggestions: [], reason: "Bitte zuerst deinen Heimatort in den Einstellungen auswählen." });
    const photos = await db.attachment.findMany({ where: { ownerId, tripId: null, capturedAt: { not: null }, latitude: { not: null }, longitude: { not: null } }, select: { id: true, capturedAt: true, latitude: true, longitude: true, tripId: true }, orderBy: [{ capturedAt: "asc" }, { id: "asc" }], take: 10001 });
    const truncated = photos.length > 10000;
    // Never infer a trip across an unseen section of the user's collection.
    const suggestions = suggestPhotoTrips(photos.slice(0, 10000), settings.homePlace, settings.detectionMinDays, settings.detectionRadiusKm);
    return photoReply({ suggestions, truncated, ...(truncated ? { reason: "Die Auswertung ist auf die ersten 10.000 nicht zugeordneten Fotos begrenzt." } : {}) });
  } catch (error) { return photoFailure(error); }
}
