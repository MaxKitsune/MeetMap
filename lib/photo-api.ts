import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "./security";
import { photoDate } from "./photo-metadata";

export const photoReply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
export function photoFailure(error: unknown) {
  if (error instanceof ApiError) return photoReply({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return photoReply({ error: "Bitte Datum, Koordinaten und Auswahl prüfen." }, 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) return photoReply({ error: "Die Daten wurden parallel geändert. Bitte erneut versuchen." }, 409);
  return photoReply({ error: "Der Fotoimport konnte nicht verarbeitet werden. Bitte erneut versuchen." }, 500);
}
export const capturedAtSchema = z.string().max(50).refine(v => photoDate(v) !== null, "Ungültiges Aufnahmedatum").transform(v => photoDate(v)!);
export const photoMetadataSchema = z.object({
  capturedAt: capturedAtSchema.nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  tripId: z.string().min(1).max(100).nullable().optional(),
}).strict().refine(v => (v.latitude === undefined && v.longitude === undefined) || (v.latitude === null && v.longitude === null) || (typeof v.latitude === "number" && typeof v.longitude === "number"), "Koordinaten bitte als Paar angeben.");
