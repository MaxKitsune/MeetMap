import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { attachmentSelect } from "@/lib/data";
import { ApiError, boundedBody, checkOrigin, requireOwner, rateLimit } from "@/lib/security";
import { photoReply, photoFailure, photoMetadataSchema } from "@/lib/photo-api";
import { importError, importTravelImage } from "@/lib/photo-import";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { id: ownerId } = await requireOwner();
    const tripId = request.nextUrl.searchParams.get("tripId");
    const holidayPeriodId = request.nextUrl.searchParams.get("holidayPeriodId");
    const unassigned = request.nextUrl.searchParams.get("unassigned") === "true";
    const photos = await db.attachment.findMany({
      where: { ownerId, ...(tripId ? { tripId } : unassigned ? { tripId: null } : {}), ...(holidayPeriodId ? { trip: { holidayPeriodId, ownerId } } : {}), OR: [{ source: { not: "upload" } }, { capturedAt: { not: null } }, { tripId: { not: null } }] },
      select: attachmentSelect, orderBy: [{ capturedAt: "desc" }, { id: "desc" }], take: 1001,
    });
    return photoReply({ photos: photos.slice(0, 1000), truncated: photos.length > 1000 });
  } catch (error) { return photoFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const { id: ownerId } = await requireOwner();
    await rateLimit("travel-upload-" + ownerId, 100);
    const bytes = await boundedBody(request, 64 * 1024 * 1024);
    let form: FormData;
    try {
      form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") || "" }, body: bytes as BodyInit }).formData();
    } catch { throw new ApiError(400, "Bitte Bilder als Formulardaten senden."); }
    const files = [...form.getAll("files"), ...form.getAll("file")];
    if (!files.length || files.length > 10 || files.some(file => !(file instanceof File))) throw new ApiError(400, "Bitte zwischen einem und zehn Bildern auswählen.");
    const fields: Record<string, unknown> = {};
    for (const key of ["capturedAt", "latitude", "longitude", "tripId"]) {
      const value = form.get(key);
      if (value !== null && value !== "") fields[key] = key === "latitude" || key === "longitude" ? Number(value) : value;
    }
    const { tripId, ...fallbackMetadata } = photoMetadataSchema.parse(fields);
    if (tripId && !await db.trip.findFirst({ where: { id: tripId, ownerId }, select: { id: true } })) throw new ApiError(404, "Reise nicht gefunden.");
    const results = [];
    const errors: { name: string; error: string }[] = [];
    for (const file of files as File[]) {
      try {
        if (file.size > 12 * 1024 * 1024) throw new ApiError(413, "Bilder dürfen höchstens 12 MB groß sein.");
        results.push(await importTravelImage(Buffer.from(await file.arrayBuffer()), file.name, ownerId, { source: "travel-upload", tripId, fallbackMetadata }));
      } catch (error) { errors.push({ name: file.name, error: importError(error) }); }
    }
    return photoReply({ photos: results.map(r => r.photo), results, errors, ...(results.length ? {} : { error: errors.map(e => `${e.name}: ${e.error}`).join(" ") }) }, results.length ? 201 : 422);
  } catch (error) { return photoFailure(error); }
}
