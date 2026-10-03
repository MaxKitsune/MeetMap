import * as exifr from "exifr";

export type PhotoMetadata = {
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
};

// EXIF without an offset describes camera-local wall time. Keep its calendar
// day in UTC instead of silently applying the server's timezone.
export function photoDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = text.match(/^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return null;
  const [, y, m, d, h = "00", min = "00", sec = "00", fraction, offset] = match;
  const day = `${y}-${m}-${d}`;
  const calendar = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day || +h > 23 || +min > 59 || +sec > 59) return null;
  const date = new Date(`${day}T${h}:${min}:${sec}${fraction ? `.${fraction}` : ""}${offset || "Z"}`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function photoCoordinates(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

export async function extractPhotoMetadata(bytes: Buffer): Promise<PhotoMetadata> {
  try {
    const tags = await exifr.parse(bytes, {
      tiff: true, exif: true, gps: true,
      xmp: false, icc: false, iptc: false, jfif: false,
      reviveValues: false,
      pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "GPSLatitude", "GPSLatitudeRef", "GPSLongitude", "GPSLongitudeRef"],
    });
    const rawDate = tags?.DateTimeOriginal || tags?.CreateDate;
    const offset = typeof tags?.OffsetTimeOriginal === "string" && /^[+-]\d{2}:\d{2}$/.test(tags.OffsetTimeOriginal) ? tags.OffsetTimeOriginal : "";
    return {
      capturedAt: photoDate(typeof rawDate === "string" ? rawDate + offset : rawDate),
      ...photoCoordinates(tags?.latitude, tags?.longitude),
    };
  } catch {
    // Valid image files can contain missing or damaged metadata.
    return { capturedAt: null, latitude: null, longitude: null };
  }
}

export function metadataWarnings(metadata: PhotoMetadata) {
  const warnings: string[] = [];
  if (!metadata.capturedAt) warnings.push("Kein verlässliches Aufnahmedatum gefunden. Bitte bei Bedarf ergänzen.");
  if (metadata.latitude === null || metadata.longitude === null) warnings.push("Keine GPS-Koordinaten gefunden. Der Ort kann manuell ergänzt werden.");
  return warnings;
}
