import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { extractPhotoMetadata, photoDate } from "../../lib/photo-metadata";
import { matchingPhotoTrips, suggestPhotoTrips } from "../../lib/photo-matching";

// Small real TIFF EXIF block embedded in a decoded JPEG, including rational GPS.
export async function exifPhoto(date = "2026:07:10 00:30:00", offset = "+02:00") {
  const tiff = Buffer.alloc(197);
  tiff.write("II", 0); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => { tiff.writeUInt16LE(tag, at); tiff.writeUInt16LE(type, at + 2); tiff.writeUInt32LE(count, at + 4); tiff.writeUInt32LE(value, at + 8); };
  tiff.writeUInt16LE(2, 8);
  entry(10, 0x8769, 4, 1, 38); entry(22, 0x8825, 4, 1, 68);
  tiff.writeUInt16LE(2, 38);
  entry(40, 0x9003, 2, 20, 122); entry(52, 0x9011, 2, 7, 142);
  tiff.writeUInt16LE(4, 68);
  entry(70, 1, 2, 2, 78); entry(82, 2, 5, 3, 149); entry(94, 3, 2, 2, 69); entry(106, 4, 5, 3, 173);
  tiff.write(date, 122); tiff.write(offset, 142);
  [46, 30, 0, 11, 18, 0].forEach((number, index) => { tiff.writeUInt32LE(number, 149 + index * 8); tiff.writeUInt32LE(1, 153 + index * 8); });
  const payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const marker = Buffer.alloc(4); marker.writeUInt16BE(0xffe1); marker.writeUInt16BE(payload.length + 2, 2);
  const jpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).jpeg().toBuffer();
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}

describe("private photo metadata and trip evidence", () => {
  it("reads capture timestamp with timezone and rational GPS from actual JPEG EXIF", async () => {
    const metadata = await extractPhotoMetadata(await exifPhoto());
    expect(metadata.capturedAt?.toISOString()).toBe("2026-07-09T22:30:00.000Z");
    expect(metadata.latitude).toBeCloseTo(46.5);
    expect(metadata.longitude).toBeCloseTo(11.3);
  });
  it("keeps the camera wall date when EXIF has no timezone and rejects impossible dates", () => {
    expect(photoDate("2026:07:10 00:30:00")?.toISOString()).toBe("2026-07-10T00:30:00.000Z");
    expect(photoDate("2026-02-30")).toBeNull();
    expect(photoDate("2026-07-01T29:00:00Z")).toBeNull();
    expect(photoDate(123)).toBeNull();
  });
  it("leaves missing and malformed metadata unset without inventing today's date", async () => {
    const jpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: "blue" } }).jpeg().toBuffer();
    expect(await extractPhotoMetadata(jpeg)).toEqual({ capturedAt: null, latitude: null, longitude: null });
    expect(await extractPhotoMetadata(Buffer.from("broken EXIF"))).toEqual({ capturedAt: null, latitude: null, longitude: null });
  });
  it("matches inclusive UTC trip days and preserves ambiguous matches", () => {
    const trip = { id: "one", title: "One", startAt: new Date("2026-07-10"), endAt: new Date("2026-07-12") };
    expect(matchingPhotoTrips(new Date("2026-07-12T23:59:00Z"), [trip])).toHaveLength(1);
    expect(matchingPhotoTrips(new Date("2026-07-13"), [trip])).toHaveLength(0);
    expect(matchingPhotoTrips(new Date("2026-07-11"), [trip, { ...trip, id: "two" }])).toHaveLength(2);
    expect(matchingPhotoTrips(null, [trip])).toEqual([]);
  });
  it("requires distinct away days and breaks groups at date gaps, home and distant places", () => {
    const home = { latitude: 48.1, longitude: 11.5 };
    const p = (id: string, day: string, extra = {}) => ({ id, capturedAt: new Date(day), latitude: 46.5, longitude: 11.3, tripId: null, ...extra });
    const photos = [p("a", "2026-07-10"), p("b", "2026-07-10T14:00:00Z")];
    expect(suggestPhotoTrips(photos, home)).toEqual([]);
    const result = suggestPhotoTrips([...photos, p("c", "2026-07-11"), p("d", "2026-07-13"), p("assigned", "2026-07-14", { tripId: "trip" })], home);
    expect(result).toHaveLength(1);
    expect(result[0].attachmentIds).toEqual(["a", "b", "c"]);
    expect(result[0].evidence.uniqueDays).toBe(2);
    expect(suggestPhotoTrips([p("a", "2026-07-10"), p("home", "2026-07-10T12:00:00Z", home), p("b", "2026-07-11")], home)).toEqual([]);
    expect(suggestPhotoTrips([p("a", "2026-07-10"), p("b", "2026-07-11", { latitude: 42, longitude: 9 })], home)).toEqual([]);
  });
});
