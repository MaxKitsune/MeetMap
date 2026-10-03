import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const state = vi.hoisted(() => ({ dir: "", create: vi.fn(), trips: vi.fn(), trip: vi.fn() }));
vi.mock("../../lib/env", () => ({ env: () => ({ UPLOAD_DIR: state.dir }) }));
vi.mock("../../lib/db", () => {
  const tx = { attachment: { create: state.create }, trip: { findMany: state.trips, findFirst: state.trip } };
  return { db: { ...tx, $transaction: async (callback: (tx: unknown) => unknown) => callback(tx) } };
});
import { saveImage } from "../../lib/uploads";

beforeEach(async () => {
  state.dir = await mkdtemp(path.join(os.tmpdir(), "meetmap-photo-test-"));
  state.create.mockReset().mockImplementation(async ({ data }) => ({ id: "photo", ...data }));
  state.trips.mockReset().mockResolvedValue([]);
  state.trip.mockReset().mockResolvedValue(null);
});
afterEach(async () => { await rm(state.dir, { recursive: true, force: true }); });

async function imageWithDate() {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: "green" } }).withExif({ IFD2: { DateTimeOriginal: "2026:07:10 12:34:56" } }).jpeg().toBuffer();
}

describe("private image persistence", () => {
  it("keeps ordinary uploads metadata-free and writes stripped originals and thumbnails", async () => {
    const saved = await saveImage(await imageWithDate(), "test.jpg", "owner");
    expect(saved).not.toHaveProperty("capturedAt");
    for (const key of [saved.storageKey, "thumb-" + saved.storageKey]) {
      const metadata = await sharp(await readFile(path.join(state.dir, key))).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
    }
  });
  it("extracts only explicit travel imports and assigns only a unique owned date range", async () => {
    const trip = { id: "one", title: "Trip", startAt: new Date("2026-07-09"), endAt: new Date("2026-07-12") };
    state.trips.mockResolvedValue([trip]);
    const saved = await saveImage(await imageWithDate(), "test.jpg", "owner", { extractMetadata: true, autoAssignTrip: true, source: "travel-upload" });
    expect(saved.capturedAt?.toISOString()).toBe("2026-07-10T12:34:56.000Z");
    expect(saved.tripId).toBe("one");
    expect(state.trips).toHaveBeenCalledWith({ where: { ownerId: "owner" } });
    expect((await sharp(await readFile(path.join(state.dir, saved.storageKey))).metadata()).exif).toBeUndefined();
    state.trips.mockResolvedValue([trip, { ...trip, id: "two" }]);
    const ambiguous = await saveImage(await imageWithDate(), "test.jpg", "owner", { extractMetadata: true, autoAssignTrip: true });
    expect(ambiguous.tripId).toBeNull();
  });
  it("cleans files when assignment fails and rejects unknown and oversized formats", async () => {
    await expect(saveImage(await imageWithDate(), "test.jpg", "owner", { extractMetadata: true, tripId: "foreign" })).rejects.toThrow("Reise nicht gefunden");
    expect(await readdir(state.dir)).toEqual([]);
    await expect(saveImage(Buffer.from("<svg/>"), "test.jpg", "owner")).rejects.toThrow("JPEG");
    await expect(saveImage(Buffer.alloc(12 * 1024 * 1024 + 1), "test.jpg", "owner")).rejects.toThrow("12 MB");
  });
});
